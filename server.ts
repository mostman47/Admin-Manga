import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";

import { chromium } from "playwright";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" })); // Increase limit for HTML/Image data

  // ... existing routes ...

  // Advanced Playwright Crawler (Best for bypassing robot checkers)
  app.post("/api/crawl-playwright", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    let browser;
    try {
      console.log(`[Playwright] Launching browser for: ${url}`);
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 1000 },
      });
      const page = await context.newPage();

      // Log browser console messages to server console
      page.on("console", msg => console.log(`[Browser Console] ${msg.text()}`));
      page.on("requestfailed", request => console.log(`[Browser Request Failed] ${request.url()}: ${request.failure()?.errorText}`));

      console.log(`[Playwright] Navigating to ${url}...`);
      // Use 'domcontentloaded' instead of 'networkidle' to avoid timeouts from ads/trackers
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      console.log(`[Playwright] DOM loaded. Waiting for stability...`);

      // Wait for a few seconds for dynamic content
      await page.waitForTimeout(5000);

      // Scroll to trigger lazy loading with more feedback
      console.log(`[Playwright] Scrolling to trigger lazy loading...`);
      await page.evaluate(async () => {
        for (let i = 0; i < 15; i++) {
          window.scrollBy(0, window.innerHeight);
          await new Promise(r => setTimeout(r, 400));
        }
      });

      // Find manga images
      const imageSelectors = [".reading-detail img", ".page-chapter img", "#chapter_content img", ".box_doc img"];
      let images: string[] = [];

      console.log(`[Playwright] Searching for images...`);
      for (const selector of imageSelectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`[Playwright] Found ${elements.length} images with selector: ${selector}`);
          for (let i = 0; i < elements.length; i++) {
            try {
              const el = elements[i];
              // Ensure element is visible
              await el.scrollIntoViewIfNeeded();
              
              // Take a screenshot of the element
              const buffer = await el.screenshot({ type: "jpeg", quality: 80 });
              images.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
              
              if (i % 5 === 0) console.log(`[Playwright] Captured ${i + 1}/${elements.length} images...`);
            } catch (e: any) {
              console.error(`[Playwright] Screenshot failed for image ${i}:`, e.message);
            }
          }
          break; 
        }
      }

      if (images.length === 0) {
        console.log(`[Playwright] No images found with specific selectors. Trying generic search...`);
        const allImgs = await page.$$("img");
        for (const img of allImgs) {
          const src = await img.getAttribute("src") || "";
          if (src.includes("nettruyen") || src.includes("kcgsbok")) {
            const buffer = await img.screenshot({ type: "jpeg", quality: 80 });
            images.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
          }
        }
      }

      console.log(`[Playwright] Successfully captured ${images.length} images.`);
      await browser.close();
      res.json({ images });
    } catch (error: any) {
      console.error("[Playwright Error]", error.message);
      if (browser) await browser.close();
      
      const isCloud = process.env.NODE_ENV === "production" || !process.env.HOME?.includes("/home/");
      let errorMsg = error.message;
      
      if (isCloud) {
        errorMsg = "Advanced Crawler requires local setup. Please follow the instructions in LOCAL_SETUP.md.";
      } else if (error.message.includes("timeout")) {
        errorMsg = "The site took too long to load. Try again or check your internet connection.";
      }
      
      res.status(500).json({ error: errorMsg });
    }
  });

  // API Route for crawling
  app.post("/api/crawl", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": new URL(url).origin,
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const images: string[] = [];

      // Manga sites often use lazy loading attributes
      const srcAttributes = ["src", "data-src", "data-original", "data-lazy-src", "data-srcset", "data-cdn"];

      $("img").each((_, el) => {
        srcAttributes.forEach(attr => {
          const val = $(el).attr(attr);
          if (val) {
            try {
              // Handle potential space-separated values in srcset
              const cleanVal = val.trim().split(" ")[0];
              const absoluteUrl = new URL(cleanVal, url).href;
              images.push(absoluteUrl);
            } catch (e) {
              // Skip invalid URLs
            }
          }
        });
      });

      // Filter unique and likely valid image URLs
      const uniqueImages = Array.from(new Set(images)).filter(img => 
        img.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || img.includes("image") || img.includes("cdn")
      );

      res.json({ images: uniqueImages });
    } catch (error: any) {
      console.error("Crawl error:", error.message);
      res.status(500).json({ error: `Failed to crawl the URL: ${error.message}` });
    }
  });

  // Specialized route for Nettruyen with extra stealth
  app.post("/api/crawl-nettruyen", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      // Nettruyen often requires specific headers and sometimes a mobile UA is better
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "max-age=0",
          "Upgrade-Insecure-Requests": "1",
          "Referer": "https://www.google.com/",
        },
        timeout: 20000,
      });

      const $ = cheerio.load(response.data);
      const images: string[] = [];

      // Nettruyen specific selectors
      $(".reading-detail img, .page-chapter img").each((_, el) => {
        const src = $(el).attr("data-original") || $(el).attr("src") || $(el).attr("data-src");
        if (src) {
          try {
            const absoluteUrl = new URL(src, url).href;
            images.push(absoluteUrl);
          } catch (e) {}
        }
      });

      // Fallback to general img search if specific ones fail
      if (images.length === 0) {
        $("img").each((_, el) => {
          const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original");
          if (src && !src.includes("logo") && !src.includes("icon")) {
            try {
              const absoluteUrl = new URL(src, url).href;
              images.push(absoluteUrl);
            } catch (e) {}
          }
        });
      }

      res.json({ images: Array.from(new Set(images)) });
    } catch (error: any) {
      console.error("Nettruyen Crawl error:", error.message);
      res.status(500).json({ error: `Nettruyen robot checker blocked us: ${error.message}` });
    }
  });

  // Proxy route to bypass CORS for images
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    const customReferer = req.query.referer as string;
    if (!imageUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
          "Referer": customReferer || new URL(imageUrl).origin,
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
        timeout: 15000,
      });

      const contentType = response.headers["content-type"] || "image/jpeg";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      res.send(response.data);
    } catch (error: any) {
      console.error("Proxy error:", error.message);
      res.status(500).send(`Failed to fetch image: ${error.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
