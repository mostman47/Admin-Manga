import React, { useState, useRef, useEffect } from "react";
import { Search, Image as ImageIcon, Loader2, ExternalLink, ShieldAlert, Zap, Code, BrainCircuit, Terminal, RefreshCw } from "lucide-react";
import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import { TokenUsage } from "../types";

interface NettruyenCrawlerProps {
  onSelectImage: (base64: string) => void;
  onUsageUpdate: (usage: TokenUsage) => void;
}

const LOG_COLORS: Record<string, string> = {
  "[Browser]":   "text-blue-400",
  "[Navigate]":  "text-yellow-400",
  "[Challenge]": "text-orange-400",
  "[Content]":   "text-cyan-400",
  "[Images]":    "text-green-400",
  "[Done]":      "text-emerald-400",
  "[Error]":     "text-red-400",
  "[Page":       "text-white/40",
};

function getLogColor(msg: string): string {
  for (const [prefix, cls] of Object.entries(LOG_COLORS)) {
    if (msg.startsWith(prefix)) return cls;
  }
  return "text-white/70";
}

function LaunchChromeButton() {
  const [state, setState] = useState<"idle" | "launching" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const launch = async () => {
    setState("launching");
    try {
      await axios.post("/api/launch-chrome");
      setState("done");
      setMsg("Chrome launched with debug port — click Advanced to crawl.");
    } catch (err: any) {
      setState("error");
      setMsg(err.response?.data?.error || "Failed to launch Chrome.");
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={launch}
        disabled={state === "launching"}
        className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
          state === "done"  ? "bg-emerald-500 text-white" :
          state === "error" ? "bg-red-500 text-white" :
          "bg-white text-[#141414] hover:bg-white/90"
        } disabled:opacity-50`}
      >
        {state === "launching" && <Loader2 size={11} className="animate-spin" />}
        {state === "done"      ? "Chrome Ready" :
         state === "error"     ? "Launch Failed" :
         state === "launching" ? "Launching..." : "Launch Chrome with Debug Port"}
      </button>
      {msg && <p className={`text-[9px] ${state === "error" ? "text-red-400" : "text-emerald-400"}`}>{msg}</p>}
    </div>
  );
}

export const NettruyenCrawler: React.FC<NettruyenCrawlerProps> = ({ onSelectImage, onUsageUpdate }) => {
  const [url, setUrl] = useState("https://nettruyenviet10.com/truyen-tranh/thuan-tuy-bat-luong/chuong-10");
  const [htmlInput, setHtmlInput] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(true);
  const [useSelenium, setUseSelenium] = useState(false);
  const [headless, setHeadless] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [debugImage, setDebugImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [browser, setBrowser] = useState<"chromium" | "firefox" | "webkit" | "live" | "edge">("chromium");

  const logPanelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log panel to bottom on new entries
  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError(null);
    setDebugImage(null);
    setImages([]);
    setLogs([]);

    if (useSelenium) {
      setStatus("Launching Selenium WebDriver...");
      try {
        const response = await axios.post("/api/crawl-selenium", { url, headless });
        if (response.data.debugImage) setDebugImage(response.data.debugImage);
        setImages(response.data.images);
        setStatus(null);
        if (response.data.images.length === 0) {
          setError(response.data.error || "Selenium couldn't find images.");
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "Selenium failed.");
        setStatus(null);
      } finally {
        setIsLoading(false);
      }
    } else if (isAdvanced) {
      // Playwright path: stream SSE logs from server
      setStatus("Connecting to stealth browser...");
      try {
        const response = await fetch("/api/crawl-playwright", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, headless, browser }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "log") {
                // Skip raw browser console noise
                if (data.message.startsWith("[Page Console]")) continue;
                setLogs(prev => [...prev, data.message]);
                setStatus(data.message);
              } else if (data.type === "result") {
                if (data.debugImage) setDebugImage(data.debugImage);
                setImages(data.images || []);
                if (!data.images?.length) {
                  setError(data.error || "Advanced crawler couldn't find images. Try AI Extraction.");
                }
                setStatus(null);
              } else if (data.type === "error") {
                setError(data.message);
                setStatus(null);
              }
            } catch (_) {}
          }
        }
      } catch (err: any) {
        setError(err.message || "Stream connection failed.");
        setStatus(null);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Basic bypass path: plain axios
      setStatus("Bypassing robot checker...");
      try {
        const response = await axios.post("/api/crawl-nettruyen", { url });
        if (response.data.debugImage) setDebugImage(response.data.debugImage);
        setImages(response.data.images);
        setStatus(null);
        if (response.data.images.length === 0) {
          setError(response.data.error || "No images found. Try Advanced Mode or AI Extraction.");
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to bypass robot checker. Nettruyen has strong protection.");
        setStatus(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAiExtract = async () => {
    if (!htmlInput) return;
    setIsLoading(true);
    setError(null);
    setStatus("AI is analyzing HTML...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const model = "gemini-3.1-flash-lite-preview";

      const prompt = `
        Analyze the provided HTML source code from a manga website.
        Extract ALL image URLs that belong to the manga chapter content.
        Ignore logos, icons, ads, and UI elements.
        Look for patterns like 'data-original', 'data-src', or images inside reading containers.
        Return a JSON array of strings (the URLs).
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [
          { text: prompt },
          { text: `HTML SOURCE:\n${htmlInput.substring(0, 50000)}` }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      if (response.usageMetadata) {
        onUsageUpdate({
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        });
      }

      const extractedImages = JSON.parse(response.text || "[]");
      setImages(extractedImages);
      setStatus(null);
      if (extractedImages.length === 0) {
        setError("AI couldn't find any manga images in the provided HTML.");
      }
    } catch (err) {
      console.error("AI Extraction error:", err);
      setError("AI failed to extract images. Make sure you pasted the correct HTML source.");
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncCookies = async () => {
    setSyncStatus("syncing");
    try {
      await axios.post("/api/sync-chrome-cookies");
      setSyncStatus("done");
      setTimeout(() => setSyncStatus("idle"), 4000);
    } catch (err: any) {
      setSyncStatus("error");
      setError(err.response?.data?.error || "Failed to sync cookies.");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  };

  const handleImageSelect = async (imgUrl: string) => {
    try {
      setStatus("Fetching image via proxy...");
      const refererUrl = url || "https://nettruyenviet10.com/";
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}&referer=${encodeURIComponent(refererUrl)}`;
      const response = await axios.get(proxyUrl, { responseType: "blob" });

      const reader = new FileReader();
      reader.onloadend = () => {
        onSelectImage(reader.result as string);
        setStatus(null);
      };
      reader.readAsDataURL(response.data);
    } catch (err) {
      console.error("Failed to fetch image via proxy:", err);
      setError("Failed to fetch image. The site might have strong anti-bot protection.");
      setStatus(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white p-8 rounded-3xl shadow-2xl border border-[#141414]/10 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-[#141414] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
          <ShieldAlert className="text-white" size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2 uppercase italic font-serif">Nettruyen Stealth Scrawler</h2>
        <p className="text-[#141414]/60 text-sm mb-8">Specialized crawler for sites with robot checkers like Nettruyen.</p>

        <form onSubmit={handleCrawl} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://nettruyenviet10.com/truyen-tranh/..."
              className="flex-1 px-6 py-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#141414] text-sm font-bold"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-4 bg-[#141414] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center gap-2 shadow-lg"
            >
              {isLoading && !showManual ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
              {isAdvanced ? "Advanced" : "Bypass"}
            </button>
            {isAdvanced && (
              <button
                type="button"
                disabled={isLoading}
                onClick={async (e) => {
                  e.preventDefault();
                  if (!url) return;
                  setIsLoading(true);
                  setError(null);
                  setDebugImage(null);
                  setImages([]);
                  setLogs([]);
                  setStatus("Opening browser (no auto-click)...");
                  try {
                    const response = await fetch("/api/crawl-playwright", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url, headless: false, skipBypass: true, browser }),
                    });
                    if (!response.ok || !response.body) throw new Error(`Server error: ${response.status}`);
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = "";
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      buffer += decoder.decode(value, { stream: true });
                      const parts = buffer.split("\n\n");
                      buffer = parts.pop() || "";
                      for (const part of parts) {
                        const line = part.trim();
                        if (!line.startsWith("data: ")) continue;
                        try {
                          const data = JSON.parse(line.slice(6));
                          if (data.type === "log") setLogs(prev => [...prev, data.message]);
                          else if (data.type === "result") {
                            if (data.debugImage) setDebugImage(data.debugImage);
                            setImages(data.images || []);
                          } else if (data.type === "error") setError(data.message);
                        } catch (_) {}
                      }
                    }
                  } catch (err: any) {
                    setError(err.message || "Test browser failed.");
                  } finally {
                    setIsLoading(false);
                    setStatus(null);
                  }
                }}
                className="px-5 py-4 bg-[#F5F5F0] text-[#141414] rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                title="Open browser without auto-clicking — inspect what Cloudflare sees"
              >
                <Search size={16} />
                Test
              </button>
            )}
          </div>

          <div className="flex justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUseSelenium(!useSelenium);
                  if (!useSelenium) setIsAdvanced(false);
                }}
                className={`text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all ${useSelenium ? "text-blue-600 opacity-100" : "opacity-40 hover:opacity-100"}`}
              >
                <Code size={12} className={useSelenium ? "fill-current" : ""} /> {useSelenium ? "Selenium Mode ON" : "Use Selenium Mode"}
              </button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdvanced(!isAdvanced);
                  if (!isAdvanced) setUseSelenium(false);
                }}
                className={`text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all ${isAdvanced ? "text-green-600 opacity-100" : "opacity-40 hover:opacity-100"}`}
              >
                <Zap size={12} className={isAdvanced ? "fill-current" : ""} />
                {isAdvanced ? "Advanced Mode ON" : "Enable Advanced Mode"}
              </button>
              {isAdvanced && (
                <button
                  type="button"
                  onClick={() => setHeadless(!headless)}
                  className="text-[9px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 flex items-center gap-1"
                >
                  {headless ? "Headless: ON (Hidden)" : "Headless: OFF (Visible)"}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 hover:opacity-100 flex items-center gap-2 transition-opacity"
            >
              <Code size={12} /> {showManual ? "Hide AI Extraction" : "Use AI Extraction"}
            </button>
          </div>

          {/* Browser selector */}
          {isAdvanced && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex justify-center gap-2">
                {(["chromium", "firefox", "webkit", "live", "edge"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrowser(b)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                      browser === b
                        ? "bg-[#141414] text-white border-[#141414]"
                        : "bg-transparent text-[#141414]/40 border-[#141414]/10 hover:text-[#141414] hover:border-[#141414]/30"
                    }`}
                  >
                    {b === "chromium" ? "Chrome" : b === "firefox" ? "Firefox" : b === "webkit" ? "Safari" : b === "live" ? "My Chrome" : "My Edge"}
                  </button>
                ))}
              </div>

              {/* Live Chrome setup instructions */}
              {(browser === "live" || browser === "edge") && (
                <div className="w-full p-4 bg-[#141414] rounded-2xl text-left animate-in fade-in duration-300 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    Your real {browser === "edge" ? "Edge" : "Chrome"} profile
                  </p>
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Opens your actual {browser === "edge" ? "Edge" : "Chrome"} with all cookies, logins, and Cloudflare trust. {browser === "edge" ? "Edge" : "Chrome"} will be closed briefly while the crawler runs, then you can reopen it normally.
                  </p>
                  <p className="text-[9px] text-amber-400/80 leading-relaxed">
                    ⚠ Save any open work in {browser === "edge" ? "Edge" : "Chrome"} before crawling.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sync Chrome Cookies */}
          {isAdvanced && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleSyncCookies}
                disabled={syncStatus === "syncing"}
                className={`text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all px-4 py-2 rounded-xl border ${
                  syncStatus === "done"
                    ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                    : syncStatus === "error"
                    ? "text-red-500 border-red-200 bg-red-50"
                    : "text-[#141414]/50 border-[#141414]/10 hover:text-[#141414] hover:border-[#141414]/30 bg-transparent"
                }`}
              >
                <RefreshCw size={11} className={syncStatus === "syncing" ? "animate-spin" : ""} />
                {syncStatus === "syncing" && "Syncing cookies..."}
                {syncStatus === "done" && "Cookies synced! Cloudflare trust imported"}
                {syncStatus === "error" && "Sync failed — see error below"}
                {syncStatus === "idle" && "Sync Chrome Cookies"}
              </button>
            </div>
          )}

          {/* Real-time Log Panel — shown during/after advanced mode crawl */}
          {isAdvanced && logs.length > 0 && (
            <div className="text-left animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Terminal size={11} className="opacity-40" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">Browser Log</span>
                <span className="ml-auto text-[9px] font-mono opacity-30">{logs.length} events</span>
              </div>
              <div
                ref={logPanelRef}
                className="bg-[#0D0D0D] rounded-2xl p-4 max-h-52 overflow-y-auto space-y-1 border border-white/5 scrollbar-thin"
              >
                {logs.map((msg, idx) => (
                  <div key={idx} className="flex gap-3 items-start font-mono text-[10px] leading-relaxed">
                    <span className="text-white/20 shrink-0 select-none tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className={`${getLogColor(msg)} break-all`}>{msg}</span>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 items-center font-mono text-[10px]">
                    <span className="text-white/20 shrink-0">··</span>
                    <span className="text-white/30 animate-pulse">waiting...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {showManual && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 bg-[#141414] rounded-2xl text-white text-left">
                <div className="flex items-center gap-2 mb-3">
                  <BrainCircuit size={16} className="text-green-400" />
                  <span className="text-xs font-bold uppercase tracking-widest">AI Extraction Mode</span>
                </div>
                <p className="text-[10px] opacity-60 mb-4 leading-relaxed">
                  If the direct bypass fails, open the manga page in your browser, right-click &gt; "View Page Source", copy everything (Ctrl+A, Ctrl+C), and paste it below. AI will find the hidden image URLs for you.
                </p>

                {htmlInput && (
                  <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold opacity-50">Estimated AI Cost</span>
                    <span className="text-[10px] font-mono text-green-400">
                      ~${(htmlInput.length / 4 * 0.000000075).toFixed(6)}
                    </span>
                  </div>
                )}

                <textarea
                  value={htmlInput}
                  onChange={(e) => setHtmlInput(e.target.value)}
                  placeholder="Paste HTML source code here..."
                  className="w-full h-32 bg-white/10 rounded-xl p-4 text-[10px] font-mono border border-white/10 focus:ring-1 focus:ring-green-400 resize-none mb-4"
                />
                <button
                  type="button"
                  onClick={handleAiExtract}
                  disabled={isLoading || !htmlInput}
                  className="w-full py-3 bg-green-500 text-[#141414] rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-green-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading && showManual ? <Loader2 className="animate-spin" size={14} /> : <BrainCircuit size={14} />}
                  Extract with AI
                </button>
              </div>
            </div>
          )}

          {status && !isAdvanced && (
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#141414]/40 animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              {status}
            </div>
          )}
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100 text-center">
            <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
              <ShieldAlert size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Access Denied</span>
            </div>
            <p className="text-red-500 text-xs font-bold uppercase tracking-wider leading-relaxed">{error}</p>
            <p className="text-[10px] text-red-400 mt-2 uppercase font-bold">Try refreshing the page or using a different chapter link.</p>

            {debugImage && (
              <div className="mt-4 p-2 bg-white rounded-xl border border-red-200">
                <p className="text-[8px] uppercase font-bold opacity-40 mb-2">Debug Screenshot (What the crawler sees):</p>
                <img src={debugImage} alt="Debug View" className="w-full rounded-lg shadow-sm" />
              </div>
            )}
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="group relative bg-white rounded-2xl overflow-hidden border border-[#141414]/10 shadow-lg hover:shadow-2xl transition-all cursor-pointer"
              onClick={() => handleImageSelect(img)}
            >
              <img
                src={img}
                alt={`Scrawled ${idx}`}
                className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-[#141414]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-white text-center p-4">
                  <ImageIcon size={24} className="mx-auto mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Translate This</p>
                </div>
              </div>
              <a
                href={img}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
