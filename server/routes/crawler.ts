import { Router } from "express";
import { crawlGeneral, crawlNettruyen } from "../services/crawlerService.ts";
import { crawlWithPlaywright } from "../services/playwrightService.ts";

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

  try {
    const result = await crawlWithPlaywright(url, headless);
    res.json(result);
  } catch (error: any) {
    console.error("[Playwright Error]", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
