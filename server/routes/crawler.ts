import { Router } from "express";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { crawlGeneral, crawlNettruyen } from "../services/crawlerService.ts";
import { crawlWithPlaywright } from "../services/playwrightService.ts";
import { crawlWithSelenium } from "../services/seleniumService.ts";

const REAL_CHROME_DIR = path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
const CRAWLER_PROFILE_DIR = path.join(os.homedir(), ".admin-manga-chrome-profile");

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
  const { url, headless = true, skipBypass = false, browser = "chromium" } = req.body;
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
    }, skipBypass, browser);
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

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

router.post("/launch-chrome", async (_req, res) => {
  const chromePath = CHROME_PATHS.find(p => fs.existsSync(p));
  if (!chromePath) {
    return res.status(500).json({ error: "Chrome not found. Install Google Chrome first." });
  }

  // Kill existing Chrome so the new instance owns the debug port.
  try { execSync("taskkill /F /IM chrome.exe", { stdio: "ignore" }); } catch (_) {}

  // Wait briefly for processes to fully exit.
  await new Promise(r => setTimeout(r, 1500));

  // Launch Chrome detached so it outlives this request.
  spawn(chromePath, ["--remote-debugging-port=9222", "--restore-last-session"], {
    detached: true,
    stdio: "ignore",
  }).unref();

  // Poll until the debug port responds (up to 10s).
  const start = Date.now();
  while (Date.now() - start < 10000) {
    try {
      const { default: axios } = await import("axios");
      await axios.get("http://127.0.0.1:9222/json/version", { timeout: 1000 });
      return res.json({ success: true });
    } catch (_) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  res.status(500).json({ error: "Chrome launched but debug port did not open in time. Try again." });
});

// Copies cookies + encryption key from real Chrome into the isolated crawler profile.
// This transfers Cloudflare trust history so the crawler is treated as a returning visitor.
//
// fs.readFileSync opens with O_RDONLY + FILE_SHARE_READ|WRITE|DELETE on Windows,
// which is compatible with Chrome's SQLite byte-range locking — unlike CopyFileW.
router.post("/sync-chrome-cookies", (_req, res) => {
  try {
    const destNetworkDir = path.join(CRAWLER_PROFILE_DIR, "Default", "Network");
    fs.mkdirSync(destNetworkDir, { recursive: true });

    // Local State holds the DPAPI-encrypted AES key Chrome uses to decrypt cookies.
    const srcLocalState = path.join(REAL_CHROME_DIR, "Local State");
    fs.writeFileSync(
      path.join(CRAWLER_PROFILE_DIR, "Local State"),
      fs.readFileSync(srcLocalState)
    );

    // Cookies file — try the modern path first (Chrome 96+), fall back to legacy.
    const modernCookies = path.join(REAL_CHROME_DIR, "Default", "Network", "Cookies");
    const legacyCookies = path.join(REAL_CHROME_DIR, "Default", "Cookies");
    const srcCookies = fs.existsSync(modernCookies) ? modernCookies : legacyCookies;
    const destCookies = path.join(destNetworkDir, "Cookies");

    fs.writeFileSync(destCookies, fs.readFileSync(srcCookies));

    // WAL/SHM sidecar files — best-effort.
    for (const ext of ["-wal", "-shm"]) {
      if (fs.existsSync(srcCookies + ext)) {
        try { fs.writeFileSync(destCookies + ext, fs.readFileSync(srcCookies + ext)); } catch (_) {}
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Sync Cookies]", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
