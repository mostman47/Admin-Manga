export async function crawlWithPlaywright(url: string, headless: boolean = true) {
  const { chromium } = await import("playwright");
  let browser;
  try {
    console.log(`[Playwright] Launching browser (headless: ${headless}) for: ${url}`);
    browser = await chromium.launch({ 
      headless: headless,
      args: ["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process"]
    });
    
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 1000 },
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      }
    });
    
    const page = await context.newPage();
    page.on("console", msg => console.log(`[Browser Console] ${msg.text()}`));
    
    console.log(`[Playwright] Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "commit", timeout: 60000 });

    console.log(`[Playwright] Checking for challenges...`);
    const challengeSelectors = ["iframe[src*='challenges.cloudflare.com']", "#challenge-form", "#cf-challenge"];
    for (const sel of challengeSelectors) {
      if (await page.$(sel)) {
        console.log(`[Playwright] Detected challenge: ${sel}. Waiting for it to be resolved...`);
        await page.waitForFunction(`(s) => !document.querySelector(s)`, sel, { timeout: 30000 }).catch(() => {});
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
