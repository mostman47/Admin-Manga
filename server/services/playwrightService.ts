export async function crawlWithPlaywright(url: string, headless: boolean = true) {
  const { chromium } = await import("playwright");
  let browser;
  try {
    console.log(`[Playwright] Launching browser (headless: ${headless}) for: ${url}`);
    browser = await chromium.launch({ 
      headless: headless,
      args: [
        "--disable-web-security", 
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-blink-features=AutomationControlled"
      ]
    });
    
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 1000 },
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      },
      deviceScaleFactor: 1,
    });
    
    const page = await context.newPage();
    // Hide automation
    await page.evaluate(`() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    }`);

    page.on("console", msg => console.log(`[Browser Console] ${msg.text()}`));
    
    console.log(`[Playwright] Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    console.log(`[Playwright] Checking for challenges...`);
    const challengeSelectors = ["iframe[src*='challenges.cloudflare.com']", "#challenge-form", "#cf-challenge"];
    for (const sel of challengeSelectors) {
      const challengeElement = await page.$(sel);
      if (challengeElement) {
        console.log(`[Playwright] Detected challenge: ${sel}. Attempting to resolve...`);
        
        // If it's the Cloudflare Turnstile iframe, try to click the checkbox
        if (sel.includes("iframe")) {
          try {
            const box = await challengeElement.boundingBox();
            if (box) {
              // Move mouse to the box first to simulate human
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await page.waitForTimeout(500);

              // Click the approximate location of the checkbox (usually left-ish)
              const clickX = box.x + 30;
              const clickY = box.y + box.height / 2;
              console.log(`[Playwright] Clicking challenge iframe at: ${clickX}, ${clickY}`);
              await page.mouse.click(clickX, clickY);
              await page.waitForTimeout(3000); // Wait for challenge to start resolving
            }
          } catch (e) {
            console.log(`[Playwright] Failed to click challenge iframe: ${e.message}`);
          }
        }

        console.log(`[Playwright] Waiting for challenge to disappear or navigation...`);
        const currentUrl = page.url();
        await Promise.race([
          page.waitForFunction(`(s) => !document.querySelector(s)`, sel, { timeout: 45000 }),
          page.waitForURL((u) => u.toString() !== currentUrl, { timeout: 45000 }),
          page.waitForNavigation({ waitUntil: "networkidle", timeout: 45000 })
        ]).catch(() => {
          console.log(`[Playwright] Challenge ${sel} still present or no navigation after 45s.`);
        });
      }
    }

    console.log(`[Playwright] Waiting for manga content...`);
    const contentSelectors = [".reading-detail", ".page-chapter", "#chapter_content", ".box_doc"];
    await Promise.any(contentSelectors.map(s => page.waitForSelector(s, { timeout: 20000 }))).catch(() => {
      console.log("[Playwright] Content selectors not found within 20s.");
    });

    await page.evaluate(`() => {
      const imgs = document.querySelectorAll("img");
      imgs.forEach(img => {
        const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src");
        if (dataSrc) {
          img.setAttribute("src", dataSrc);
          img.style.display = "block";
          img.style.minHeight = "500px";
        }
      });
    }`);

    console.log(`[Playwright] Scrolling to render images...`);
    await page.evaluate(`async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      for (let i = 0; i < 20; i++) {
        window.scrollBy(0, 800);
        await delay(500);
      }
    }`);

    const imageSelectors = [".reading-detail img", ".page-chapter img", "#chapter_content img", ".box_doc img"];
    let images: string[] = [];

    console.log(`[Playwright] Capturing screenshots of images...`);
    for (const selector of imageSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`[Playwright] Found ${elements.length} images with selector: ${selector}`);
        for (let i = 0; i < elements.length; i++) {
          try {
            const el = elements[i];
            await el.scrollIntoViewIfNeeded();
            await page.waitForTimeout(200);
            const buffer = await el.screenshot({ type: "jpeg", quality: 85 });
            images.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
            if ((i + 1) % 10 === 0) console.log(`[Playwright] Captured ${i + 1}/${elements.length}...`);
          } catch (e) {}
        }
        break; 
      }
    }

    if (images.length === 0) {
      console.log(`[Playwright] No images found. Taking debug screenshot...`);
      const debugBuffer = await page.screenshot({ fullPage: true, type: "jpeg", quality: 50 });
      const debugBase64 = `data:image/jpeg;base64,${debugBuffer.toString("base64")}`;
      await browser.close();
      return { 
        images: [], 
        debugImage: debugBase64,
        error: "No images found. Check the debug screenshot to see if the page is blocked." 
      };
    }

    console.log(`[Playwright] Successfully captured ${images.length} images.`);
    await browser.close();
    return { images };
  } catch (error: any) {
    console.error("[Playwright Error]", error.message);
    if (browser) await browser.close();
    throw error;
  }
}
