import path from "path";
import os from "os";
import type { Page } from "playwright";

export type BrowserChoice = "chromium" | "firefox" | "webkit" | "live" | "edge";

const REAL_CHROME_USER_DATA_DIR = path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data");

const PROFILE_DIRS: Record<string, string> = {
  // Isolated profile — Profile 2 cookies are copied in at launch time.
  chromium: path.join(os.homedir(), ".admin-manga-chrome-profile"),
  firefox:  path.join(os.homedir(), ".admin-manga-firefox-profile"),
  webkit:   path.join(os.homedir(), ".admin-manga-webkit-profile"),
};

const USER_AGENTS: Record<string, string> = {
  chromium: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  firefox:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0",
  webkit:   "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

const CLICK_POSITIONS = [
  [183, 250],
  [300, 150],
  [400, 200],
  [183, 310],
] as const;

// ── Shared image extraction logic ─────────────────────────────────────────────
async function extractImages(page: Page, log: (msg: string) => void) {
  const contentSelectors = [".reading-detail", ".page-chapter", "#chapter_content", ".box_doc"];
  log(`[Content] Waiting for manga content...`);
  try {
    await Promise.race([
      Promise.any(contentSelectors.map(s => page.waitForSelector(s, { timeout: 30000 }))),
      page.waitForLoadState("networkidle", { timeout: 30000 }),
    ]);
    log(`[Content] Content container found!`);
  } catch {
    log(`[Content] No content selector matched — proceeding anyway`);
  }

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

  const imageSelectors = [
    ".reading-detail img",
    ".page-chapter img",
    "#chapter_content img",
    ".box_doc img",
  ];
  const images: string[] = [];

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

  return images;
}

// Isolated profile dirs — separate from the real browser's User Data, so no lock conflict.
// Real Chrome/Edge engine is still used via `channel`, giving a trusted fingerprint.
// On first use: sign in to Nettruyen manually when the browser opens. Cookies are saved.
const LIVE_PROFILE_DIRS = {
  live: path.join(os.homedir(), ".playwright-chrome-profile"),
  edge: path.join(os.homedir(), ".playwright-edge-profile"),
};

const REAL_BROWSER_CONFIGS = {
  live: { channel: "chrome" as const, label: "Chrome" },
  edge: { channel: "msedge" as const, label: "Edge" },
};

// ── My Chrome / My Edge — isolated profile + real browser engine ──────────────
async function crawlWithLiveChrome(
  url: string,
  log: (msg: string) => void,
  headless: boolean,
  skipBypass: boolean,
  browserType: "live" | "edge" = "live"
) {
  const { chromium } = await import("playwright");
  const cfg = REAL_BROWSER_CONFIGS[browserType];
  const profileDir = LIVE_PROFILE_DIRS[browserType];

  log(`[Browser] Launching real ${cfg.label} (headless: ${headless})...`);
  log(`[Browser] Profile: ${profileDir}`);
  log(`[Browser] Tip: On first run, sign in to Nettruyen — cookies are saved for future runs.`);

  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      channel: cfg.channel,
      headless,
      args: [
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  } catch (err: any) {
    throw new Error(`Failed to launch ${cfg.label}: ${err.message}`);
  }

  log(`[Browser] Context ready.`);
  const page = context.pages()[0] ?? await context.newPage();
  await page.bringToFront();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  try {
    log(`[Navigate] Navigating to ${url}`);
    const gotoErr = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      .then(() => null).catch((err: Error) => err.message);
    if (gotoErr) log(`[Navigate] goto error: ${gotoErr}`);

    log(`[Navigate] Waiting 5s for page to settle...`);
    await page.waitForTimeout(5000);

    const title = await page.title().catch(() => "?");
    log(`[Navigate] Title: "${title}"`);

    const isChallengePage = async (): Promise<boolean> => {
      try {
        const t = await page.title();
        return t.includes("Just a moment") || t.includes("Attention Required");
      } catch { return false; }
    };

    if (skipBypass) {
      const challenged = await isChallengePage();
      if (challenged) log(`[Challenge] Challenge present — skip-bypass mode, no auto-clicks`);
      await page.waitForTimeout(60000);
    } else {
      const MAX_ATTEMPTS = 4;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const challenged = await isChallengePage();
        if (!challenged) {
          log(`[Challenge] No challenge — profile trusted!`);
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
        log(`[Challenge] Space sent — waiting 5s...`);
        await page.waitForTimeout(5000);

        const t = await page.title().catch(() => "?");
        log(`[Challenge] Title after attempt ${attempt}: "${t}"`);
      }
    }

    const images = await extractImages(page, log);

    if (images.length === 0) {
      log(`[Images] No images found — saving debug screenshot`);
      const dbgBuf = await page.screenshot({ fullPage: true, type: "jpeg", quality: 50 });
      await context.close();
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
    if (context) await context.close().catch(() => {});
    throw error;
  }
}

// ── Standard Playwright launch (chromium / firefox / webkit) ─────────────────
export async function crawlWithPlaywright(
  url: string,
  headless: boolean = true,
  onLog: (msg: string) => void = () => {},
  skipBypass: boolean = false,
  browser: BrowserChoice = "chromium"
) {
  const log = (msg: string) => {
    console.log(msg);
    onLog(msg);
  };

  if (browser === "live" || browser === "edge") {
    return crawlWithLiveChrome(url, log, headless, skipBypass, browser);
  }

  const extra = await import("playwright-extra");

  let browserEngine: typeof extra.chromium;
  if (browser === "firefox") {
    browserEngine = extra.firefox as any;
  } else if (browser === "webkit") {
    browserEngine = extra.webkit as any;
  } else {
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
    extra.chromium.use(StealthPlugin());
    browserEngine = extra.chromium;
  }

  const chromiumArgs = browser === "chromium"
    ? ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check", "--disable-features=ChromeWhatsNewUI"]
    : [];
  const ignoreArgs = browser === "chromium" ? ["--enable-automation"] : [];

  // For chromium: sync Profile 2 cookies into the isolated profile before launch.
  // Profile 2 is not open in Chrome so its files aren't locked — readable without killing Chrome.
  if (browser === "chromium") {
    const { mkdirSync, readFileSync, writeFileSync, existsSync } = await import("fs");
    const srcLocalState = path.join(REAL_CHROME_USER_DATA_DIR, "Local State");
    const srcCookies    = path.join(REAL_CHROME_USER_DATA_DIR, "Profile 2", "Network", "Cookies");
    const srcCookiesAlt = path.join(REAL_CHROME_USER_DATA_DIR, "Profile 2", "Cookies");
    const destDir       = PROFILE_DIRS["chromium"];
    const destNetDir    = path.join(destDir, "Default", "Network");

    mkdirSync(destNetDir, { recursive: true });
    try {
      writeFileSync(path.join(destDir, "Local State"), readFileSync(srcLocalState));
      const src = existsSync(srcCookies) ? srcCookies : srcCookiesAlt;
      writeFileSync(path.join(destNetDir, "Cookies"), readFileSync(src));
      log(`[Browser] Profile 2 cookies synced to isolated profile`);
    } catch (e: any) {
      log(`[Browser] Cookie sync skipped: ${e.message}`);
    }
  }

  let context: Awaited<ReturnType<typeof browserEngine.launchPersistentContext>> | undefined;
  try {
    log(`[Browser] Launching ${browser} (headless: ${headless})`);

    context = await browserEngine.launchPersistentContext(PROFILE_DIRS[browser], {
      headless,
      ignoreDefaultArgs: ignoreArgs,
      args: chromiumArgs,
      userAgent: USER_AGENTS[browser],
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9,vi;q=0.8" },
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    const page = await context.newPage();
    await page.bringToFront();

    log(`[Navigate] Navigating to ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      .catch((err) => log(`[Navigate] goto: ${err.message}`));

    const currentUrl = page.url();
    log(`[Navigate] Current URL: ${currentUrl}`);

    log(`[Navigate] Waiting 5s for page to initialize...`);
    await page.waitForTimeout(5000);

    const initTitle = await page.title().catch(() => "?");
    log(`[Navigate] Title: "${initTitle}"`);

    const isChallengePage = async (): Promise<boolean> => {
      try {
        const title = await page.title();
        return title.includes("Just a moment") || title.includes("Attention Required");
      } catch {
        return false;
      }
    };

    if (skipBypass) {
      log(`[Challenge] Skip-bypass mode — browser is open, no auto-clicks`);
      await page.waitForTimeout(60000);
    } else {
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
    }

    const images = await extractImages(page, log);

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
