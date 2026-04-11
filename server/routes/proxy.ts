import { Router } from "express";
import axios from "axios";

const router = Router();

router.get("/proxy-image", async (req, res) => {
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
    res.set("Cache-Control", "public, max-age=3600");
    res.send(response.data);
  } catch (error: any) {
    console.error("Proxy error:", error.message);
    res.status(500).send(`Failed to fetch image: ${error.message}`);
  }
});

export default router;
