import { Builder, By, until, WebDriver } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";
import "chromedriver";

export async function crawlWithSelenium(url: string) {
  let driver: WebDriver | null = null;
  try {
    console.log(`[Selenium] Launching browser for: ${url}`);
    const options = new chrome.Options();
    options.addArguments("--headless=new");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--window-size=1920,1080");
    options.addArguments("--disable-gpu");
    options.addArguments("--disable-extensions");
    options.addArguments("--disable-web-security");
    options.addArguments("--ignore-certificate-errors");
    options.addArguments("--allow-running-insecure-content");
    // Some sites detect headless chrome, try to spoof user agent
    options.addArguments("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    options.addArguments("--disable-blink-features=AutomationControlled");
    options.excludeSwitches("enable-automation");

    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    console.log(`[Selenium] Navigating to ${url}...`);
    await driver.get(url);

    // Hide automation
    await driver.executeScript(`
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    `);

    console.log(`[Selenium] Checking for challenges...`);
    // Wait for body to be present
    await driver.wait(until.elementLocated(By.css("body")), 15000);

    // Look for Cloudflare challenge
    try {
      let frames: any[] = [];
      for (let i = 0; i < 5; i++) {
        console.log(`[Selenium] Searching for Cloudflare iframe (Attempt ${i + 1})...`);
        frames = await driver.findElements(By.css("iframe[src*='challenges.cloudflare.com']"));
        if (frames.length > 0) break;
        await driver.sleep(2000);
      }
      
      if (frames.length > 0) {
        console.log(`[Selenium] Detected Cloudflare challenge. Attempting to resolve...`);
        const iframe = frames[0];
        
        // Switch to frame
        await driver.switchTo().frame(iframe);
        
        try {
          // Try to click checkbox using Actions for more realism
          console.log(`[Selenium] Waiting for checkbox inside iframe...`);
          const checkbox = await driver.wait(until.elementLocated(By.css('input[type="checkbox"], #challenge-stage, #challenge-form, body')), 10000);
          
          const actions = driver.actions({ bridge: true });
          // Move to element and click
          await actions.move({ origin: checkbox }).pause(1000).press().pause(200).release().perform();
          console.log(`[Selenium] Performed physical click on challenge element.`);
        } catch (innerE) {
          console.log(`[Selenium] Could not find specific checkbox, attempting generic click in frame center...`);
          const actions = driver.actions({ bridge: true });
          await actions.move({ x: 30, y: 30 }).pause(500).press().release().perform();
        }
        
        // Switch back to main content
        await driver.switchTo().defaultContent();
        console.log(`[Selenium] Waiting for redirect after click...`);
        await driver.sleep(10000); 
      } else {
        console.log(`[Selenium] No Cloudflare iframe found on first check.`);
      }
    } catch (e) {
      console.log(`[Selenium] Challenge resolution step error: ${e.message}`);
      await driver.switchTo().defaultContent();
    }

    console.log(`[Selenium] Waiting for manga content...`);
    const contentSelectors = [".reading-detail", ".page-chapter", "#chapter_content", ".box_doc"];
    let contentFound = false;
    for (const selector of contentSelectors) {
      try {
        await driver.wait(until.elementLocated(By.css(selector)), 15000);
        contentFound = true;
        console.log(`[Selenium] Found content with selector: ${selector}`);
        break;
      } catch (e) {}
    }

    if (!contentFound) {
      console.log("[Selenium] Content selectors not found within 15s.");
      const title = await driver.getTitle();
      console.log(`[Selenium] Current Page Title: ${title}`);
      const bodySnippet = await driver.executeScript("return document.body.innerText.substring(0, 200);");
      console.log(`[Selenium] Page Text Snippet: ${bodySnippet}`);
    }

    // Scroll to load images
    console.log(`[Selenium] Scrolling to render images...`);
    for (let i = 0; i < 10; i++) {
      await driver.executeScript("window.scrollBy(0, 1000);");
      await driver.sleep(500);
    }

    const imageSelectors = [".reading-detail img", ".page-chapter img", "#chapter_content img", ".box_doc img"];
    let images: string[] = [];

    for (const selector of imageSelectors) {
      const elements = await driver.findElements(By.css(selector));
      if (elements.length > 0) {
        console.log(`[Selenium] Found ${elements.length} images with selector: ${selector}`);
        for (let i = 0; i < elements.length; i++) {
          try {
            const el = elements[i];
            // Scroll to element
            await driver.executeScript("arguments[0].scrollIntoView(true);", el);
            await driver.sleep(200);
            
            // Capture screenshot of element
            const base64 = await el.takeScreenshot();
            images.push(`data:image/jpeg;base64,${base64}`);
            
            if ((i + 1) % 10 === 0) console.log(`[Selenium] Captured ${i + 1}/${elements.length}...`);
          } catch (e) {}
        }
        break;
      }
    }

    if (images.length === 0) {
      console.log(`[Selenium] No images found. Taking debug screenshot...`);
      const debugBase64 = await driver.takeScreenshot();
      await driver.quit();
      return {
        images: [],
        debugImage: `data:image/jpeg;base64,${debugBase64}`,
        error: "No images found via Selenium. Check debug screenshot."
      };
    }

    console.log(`[Selenium] Successfully captured ${images.length} images.`);
    await driver.quit();
    return { images };
  } catch (error: any) {
    console.error("[Selenium Error]", error.message);
    if (driver) await driver.quit();
    throw error;
  }
}
