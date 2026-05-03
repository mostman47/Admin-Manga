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
  const { default: stealth } = await import("puppeteer-extra-plugin-stealth");

  // @ts-ignore
  chromium.use(stealth());

  let browser;
  try {
    // Use real installed Chrome instead of Playwright's bundled Chromium.
    // Cloudflare fingerprints the browser binary — Playwright's Chromium has
    // automation markers that Turnstile detects even with the stealth plugin.
    // Real Chrome passes those checks because it has the correct fingerprint.
    log(`[Browser] Launching real Chrome (channel: chrome, headless: ${headless})`);
    browser = await chromium.launch({
      channel: "chrome",
      headless: headless,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9,vi;q=0.8" },
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    const page = await context.newPage();
    page.on("console", msg => console.log(`[Page Console] ${msg.text()}`));

    // ── Navigate ──────────────────────────────────────────────────────────
    // Fire navigation without awaiting — Cloudflare challenge pages never settle
    log(`[Navigate] Firing navigation (non-blocking)...`);
    page.goto(url, { timeout: 0 }).catch(() => {});

    // Wait until we can see SOMETHING on the page (challenge text or manga content)
    log(`[Navigate] Waiting for page to render (max 20s)...`);
    await page.waitForSelector(
      "h2.ch-title, .reading-detail, .page-chapter, #chapter_content, .box_doc, body",
      { timeout: 20000 }
    ).catch(() => log(`[Navigate] Selector wait timed out — continuing`));

    await page.waitForTimeout(2000);
    const initTitle = await page.title().catch(() => "?");
    const initUrl   = page.url();
    log(`[Navigate] Page loaded. Title: "${initTitle}" | URL: ${initUrl}`);

    // ── Detect whether Cloudflare challenge is active ─────────────────────
    // Detection uses page title or the h2 text visible on the challenge page
    const isChallengePage = async (): Promise<boolean> => {
      try {
        const title = await page.title();
        if (title.includes("Just a moment") || title.includes("Attention Required")) return true;
        const h2 = await page.$("h2.ch-title");
        if (h2) return true;
        return false;
      } catch {
        return false;
      }
    };

    // ── Click the Turnstile checkbox via keyboard accessibility ─────────────
    // Cloudflare must allow keyboard navigation (Tab/Space) for WCAG compliance.
    // We click a mid-page position first to ensure focus is inside the viewport,
    // then Tab into the iframe and Space to check the checkbox.
    const tryClickCheckbox = async (scanNum: number) => {
      log(`[Challenge] --- Attempt ${scanNum}: click → Tab → Space ---`);

      await page.bringToFront();
      await page.waitForTimeout(500);

      // Click mid-page to give the browser a focused window (Tab won't work otherwise)
      const clickTargets = [[300, 150], [183, 250], [500, 300]] as const;
      const [cx, cy] = clickTargets[scanNum % clickTargets.length];
      log(`[Challenge] Clicking [${cx}, ${cy}] to focus page...`);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(2000); // let Cloudflare fully load

      // Tab into the Turnstile iframe — Cloudflare places the checkbox as the
      // first focusable element inside its iframe, so one Tab usually lands on it
      log(`[Challenge] Pressing Tab to focus Turnstile checkbox...`);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);

      // Space activates the focused checkbox
      log(`[Challenge] Pressing Space to check the box...`);
      await page.keyboard.press("Space");
      log(`[Challenge] Space sent — waiting for Cloudflare to verify...`);
    };

    // ── Scan loop: check every 5s if "Performing security verification" is present ──
    const SCAN_INTERVAL_MS = 3000;
    const MAX_SCANS = 40; // ~2 minutes max

    log(`[Challenge] Starting scan loop (interval: 3s, max: ${MAX_SCANS} scans)...`);

    for (let scan = 1; scan <= MAX_SCANS; scan++) {
      const challenged = await isChallengePage();
      const pageTitle  = await page.title().catch(() => "?");
      log(`[Challenge] Scan ${scan}/${MAX_SCANS} — title: "${pageTitle}" — challenged: ${challenged}`);

      if (!challenged) {
        log(`[Challenge] No challenge detected — page is clean!`);
        break;
      }

      log(`[Challenge] Challenge is active — trying to click the checkbox...`);
      await tryClickCheckbox(scan);

      if (scan < MAX_SCANS) {
        log(`[Challenge] Waiting 3s before next scan...`);
        await page.waitForTimeout(SCAN_INTERVAL_MS);

        // Quick check mid-wait to exit early if challenge resolved
        const resolvedEarly = !(await isChallengePage());
        if (resolvedEarly) {
          log(`[Challenge] Challenge resolved during wait! Proceeding.`);
          break;
        }
      }
    }

    // ── Wait for manga content ────────────────────────────────────────────
    log(`[Content] Waiting for manga content selectors...`);
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

    // ── Force lazy images ─────────────────────────────────────────────────
    log(`[Images] Forcing lazy-loaded images to reveal...`);
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

    // ── Screenshot each manga image element ───────────────────────────────
    const imageSelectors = [".reading-detail img", ".page-chapter img", "#chapter_content img", ".box_doc img"];
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
          } catch (e) {}
        }
        break;
      }
    }

    if (images.length === 0) {
      log(`[Images] No images found — saving debug screenshot`);
      const dbgBuf = await page.screenshot({ fullPage: true, type: "jpeg", quality: 50 });
      await browser.close();
      log(`[Done] Browser closed.`);
      return {
        images: [],
        debugImage: `data:image/jpeg;base64,${dbgBuf.toString("base64")}`,
        error: "No images found. Check the debug screenshot.",
      };
    }

    log(`[Done] Captured ${images.length} images. Closing browser.`);
    await browser.close();
    return { images };

  } catch (error: any) {
    log(`[Error] ${error.message}`);
    if (browser) await browser.close();
    throw error;
  }
}
