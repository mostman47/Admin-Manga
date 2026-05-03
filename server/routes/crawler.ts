import { Router } from "express";
import { crawlGeneral, crawlNettruyen } from "../services/crawlerService.ts";
import { crawlWithPlaywright } from "../services/playwrightService.ts";
import { crawlWithSelenium } from "../services/seleniumService.ts";

const router = Router();

router.post("/crawl", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const images = await crawlGeneral(url);
    res.json({ images });
  } catch (error: any) {
    console.error("Crawl error:", error.message);
    res.status(500).json({ error: `Failed to crawl the URL: ${error.message}` });
  }
});

router.post("/crawl-nettruyen", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const images = await crawlNettruyen(url);
    res.json({ images });
  } catch (error: any) {
    console.error("Nettruyen Crawl error:", error.message);
    res.status(500).json({ error: `Nettruyen robot checker blocked us: ${error.message}` });
  }
});

router.post("/crawl-playwright", async (req, res) => {
  const { url, headless = true } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  // Stream logs back to the client as Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await crawlWithPlaywright(url, headless, (msg) => {
      send({ type: "log", message: msg });
    });
    send({ type: "result", ...result });
  } catch (error: any) {
    console.error("[Playwright Error]", error.message);
    send({ type: "error", message: error.message });
  } finally {
    res.end();
  }
});

router.post("/crawl-selenium", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const result = await crawlWithSelenium(url);
    res.json(result);
  } catch (error: any) {
    console.error("[Selenium Error]", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
