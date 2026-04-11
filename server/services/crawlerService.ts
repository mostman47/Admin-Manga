import axios from "axios";
import * as cheerio from "cheerio";

export async function crawlGeneral(url: string) {
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
  const srcAttributes = ["src", "data-src", "data-original", "data-lazy-src", "data-srcset", "data-cdn"];

  $("img").each((_, el) => {
    srcAttributes.forEach(attr => {
      const val = $(el).attr(attr);
      if (val) {
        try {
          const cleanVal = val.trim().split(" ")[0];
          const absoluteUrl = new URL(cleanVal, url).href;
          images.push(absoluteUrl);
        } catch (e) {}
      }
    });
  });

  return Array.from(new Set(images)).filter(img => 
    img.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || img.includes("image") || img.includes("cdn")
  );
}

export async function crawlNettruyen(url: string) {
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

  $(".reading-detail img, .page-chapter img").each((_, el) => {
    const src = $(el).attr("data-original") || $(el).attr("src") || $(el).attr("data-src");
    if (src) {
      try {
        const absoluteUrl = new URL(src, url).href;
        images.push(absoluteUrl);
      } catch (e) {}
    }
  });

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

  return Array.from(new Set(images));
}
