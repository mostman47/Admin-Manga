import path from "path";
import os from "os";

// Persistent profile — Cloudflare builds trust over multiple sessions via cookies.
// A fresh context every run looks like a brand-new identity and spikes the bot score.
const PROFILE_DIR = path.join(os.homedir(), ".admin-manga-chrome-profile");

// Click positions to try in order. The goal is to focus the viewport before Tab.
// Different positions handle cases where Tab first lands on a Privacy Policy link.
const CLICK_POSITIONS = [
  [183, 250],
  [300, 150],
  [400, 200],
  [183, 310],
] as const;

export async function crawlWithPlaywright(
  url: string,
  headless: boolean = true,
  onLog: (msg: string) => void = () => {}
) {
  const log = (msg: string) => {
    console.log(msg);
    onLog(msg);
  };

  const { chromium } = await import("playwright-extra");

  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  try {
    log(`[Browser] Launching persistent Chrome profile (headless: ${headless})`);

    // Persistent context reuses the same Chrome user data dir across crawl runs.
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: "chrome",
      headless,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-features=ChromeWhatsNewUI",
      ],
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9,vi;q=0.8" },
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    // Patch the automation markers Cloudflare's JS challenge reads before any page load.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      (window as any).chrome = {
        runtime: {},
        loadTimes: () => {},
        csi: () => {},
        app: {},
      };
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    });

    const page = await context.newPage();

    // ── Navigate ──────────────────────────────────────────────────────────────
    // Don't await — Cloudflare challenge pages never reach networkidle.
    log(`[Navigate] Navigating to ${url}`);
    page.goto(url, { timeout: 0 }).catch(() => {});

    // Wait for any visible DOM element to appear (challenge or real content).
    await page
      .waitForSelector("body", { timeout: 20000 })
      .catch(() => log(`[Navigate] body wait timed out — continuing`));

    // Give Cloudflare 5s to fully initialize its JS challenge before we interact.
    // Interacting too early means Tab lands in the wrong place.
    log(`[Navigate] Waiting 5s for Cloudflare to initialize...`);
    await page.waitForTimeout(5000);

    const initTitle = await page.title().catch(() => "?");
    log(`[Navigate] Title: "${initTitle}"`);

    // ── Challenge detection ────────────────────────────────────────────────────
    const isChallengePage = async (): Promise<boolean> => {
      try {
        const title = await page.title();
        return title.includes("Just a moment") || title.includes("Attention Required");
      } catch {
        return false;
      }
    };

    // ── Bypass loop — up to 4 attempts, one per click position ────────────────
    // Proven timing from working skill:
    //   click → wait 2s → Tab → wait 1s → Space → wait 5s → check title
    const MAX_ATTEMPTS = 4;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const challenged = await isChallengePage();
      if (!challenged) {
        log(`[Challenge] No challenge — page is clean!`);
        break;
      }

      const [cx, cy] = CLICK_POSITIONS[(attempt - 1) % CLICK_POSITIONS.length];
      log(`[Challenge] Attempt ${attempt}/${MAX_ATTEMPTS} — click [${cx},${cy}] → Tab → Space`);

      await page.bringToFront();
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(2000);

      await page.keyboard.press("Tab");
      await page.waitForTimeout(1000);

      await page.keyboard.press("Space");
      log(`[Challenge] Space sent — waiting 5s for Cloudflare to verify...`);
      await page.waitForTimeout(5000);

      const title = await page.title().catch(() => "?");
      log(`[Challenge] Title after attempt ${attempt}: "${title}"`);
    }

    // ── Wait for manga content ────────────────────────────────────────────────
    log(`[Content] Waiting for manga content...`);
    const contentSelectors = [".reading-detail", ".page-chapter", "#chapter_content", ".box_doc"];
    try {
      await Promise.race([
        Promise.any(contentSelectors.map(s => page.waitForSelector(s, { timeout: 30000 }))),
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
      ]);
      log(`[Content] Content container found!`);
    } catch {
      log(`[Content] No content selector matched — proceeding anyway`);
    }

    // ── Force lazy images ─────────────────────────────────────────────────────
    log(`[Images] Forcing lazy-loaded images...`);
    await page.evaluate(`() => {
      document.querySelectorAll("img").forEach(img => {
        const s = img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src");
        if (s) { img.src = s; img.style.display = "block"; img.style.minHeight = "500px"; }
      });
    }`);

    log(`[Images] Scrolling to render all images...`);
    await page.evaluate(`async () => {
      const d = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 20; i++) { window.scrollBy(0, 800); await d(500); }
    }`);

    // ── Screenshot each manga image element ───────────────────────────────────
    const imageSelectors = [
      ".reading-detail img",
      ".page-chapter img",
      "#chapter_content img",
      ".box_doc img",
    ];
    let images: string[] = [];

    log(`[Images] Searching for manga image elements...`);
    for (const selector of imageSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        log(`[Images] Found ${elements.length} images via "${selector}"`);
        for (let i = 0; i < elements.length; i++) {
          try {
            const el = elements[i];
            await el.scrollIntoViewIfNeeded();
            await page.waitForTimeout(200);
            const buf = await el.screenshot({ type: "jpeg", quality: 85 });
            images.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
            if ((i + 1) % 5 === 0 || i === elements.length - 1) {
              log(`[Images] Captured ${i + 1}/${elements.length}...`);
            }
          } catch (_) {}
        }
        break;
      }
    }

    if (images.length === 0) {
      log(`[Images] No images found — saving debug screenshot`);
      const dbgBuf = await page.screenshot({ fullPage: true, type: "jpeg", quality: 50 });
      await context.close();
      log(`[Done] Browser closed.`);
      return {
        images: [],
        debugImage: `data:image/jpeg;base64,${dbgBuf.toString("base64")}`,
        error: "No images found. Check the debug screenshot.",
      };
    }

    log(`[Done] Captured ${images.length} images. Closing browser.`);
    await context.close();
    return { images };

  } catch (error: any) {
    log(`[Error] ${error.message}`);
    if (context) await context.close();
    throw error;
  }
}
