export async function crawlWithPlaywright(url: string, headless: boolean = true) {
  const { chromium } = await import("playwright-extra");
  const { default: stealth } = await import("puppeteer-extra-plugin-stealth");
  
  // @ts-ignore
  chromium.use(stealth());

  let browser;
  try {
    console.log(`[Playwright] Launching stealth browser (headless: ${headless}) for: ${url}`);
    browser = await chromium.launch({ 
      headless: headless,
      args: [
        "--disable-web-security", 
        "--disable-features=IsolateOrigins,site-per-process",
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
    page.on("console", msg => console.log(`[Browser Console] ${msg.text()}`));
    
    console.log(`[Playwright] Navigating to ${url}...`);
    // Use a more natural navigation
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch(e => {
      console.log(`[Playwright] Navigation timeout/error (continuing anyway): ${e.message}`);
    });

    console.log(`[Playwright] Checking for challenges...`);
    const challengeSelectors = ["iframe[src*='challenges.cloudflare.com']", "#challenge-form", "#cf-challenge"];
    
    // Try to resolve challenges multiple times if needed
    for (let attempt = 0; attempt < 2; attempt++) {
      let foundChallenge = false;
      for (const sel of challengeSelectors) {
        const challengeElement = await page.$(sel);
        if (challengeElement) {
          foundChallenge = true;
          console.log(`[Playwright] Detected challenge: ${sel} (Attempt ${attempt + 1}). Attempting to resolve...`);
          
          if (sel.includes("iframe")) {
            try {
              const box = await challengeElement.boundingBox();
              if (box) {
                // Human-like mouse movement
                console.log(`[Playwright] Moving mouse to challenge...`);
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
                await page.waitForTimeout(800);

                const clickX = box.x + 30 + Math.random() * 10;
                const clickY = box.y + box.height / 2 + (Math.random() * 4 - 2);
                
                console.log(`[Playwright] Clicking challenge checkbox at: ${clickX}, ${clickY}`);
                await page.mouse.click(clickX, clickY, { delay: 50 + Math.random() * 100 });
                await page.waitForTimeout(5000); 
              }
            } catch (e) {
              console.log(`[Playwright] Failed to interact with challenge: ${e.message}`);
            }
          }
        }
      }
      if (!foundChallenge) break;
      await page.waitForTimeout(2000);
    }

    console.log(`[Playwright] Waiting for content or navigation...`);
    // Wait for the specific content selectors we expect
    const contentSelectors = [".reading-detail", ".page-chapter", "#chapter_content", ".box_doc"];
    try {
      await Promise.race([
        Promise.any(contentSelectors.map(s => page.waitForSelector(s, { timeout: 30000 }))),
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 })
      ]);
    } catch (e) {
      console.log("[Playwright] Content not found or no navigation after challenge resolution.");
    }

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
