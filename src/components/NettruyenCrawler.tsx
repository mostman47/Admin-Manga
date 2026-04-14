import React, { useState } from "react";
import { Search, Image as ImageIcon, Loader2, ExternalLink, ShieldAlert, Zap, Code, BrainCircuit } from "lucide-react";
import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import { TokenUsage } from "../types";

interface NettruyenCrawlerProps {
  onSelectImage: (base64: string) => void;
  onUsageUpdate: (usage: TokenUsage) => void;
}

export const NettruyenCrawler: React.FC<NettruyenCrawlerProps> = ({ onSelectImage, onUsageUpdate }) => {
  const [url, setUrl] = useState("");
  const [htmlInput, setHtmlInput] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [useSelenium, setUseSelenium] = useState(false);
  const [headless, setHeadless] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [debugImage, setDebugImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError(null);
    setDebugImage(null);
    
    let statusMsg = "Bypassing robot checker...";
    if (useSelenium) {
      statusMsg = "Launching Selenium WebDriver...";
    } else if (isAdvanced) {
      statusMsg = `Launching stealth browser (${headless ? "Headless" : "Visible"})...`;
    }
    
    setStatus(statusMsg);
    setImages([]);

    try {
      let endpoint = "/api/crawl-nettruyen";
      if (useSelenium) {
        endpoint = "/api/crawl-selenium";
      } else if (isAdvanced) {
        endpoint = "/api/crawl-playwright";
      }
      
      const response = await axios.post(endpoint, { url, headless });
      
      if (response.data.debugImage) {
        setDebugImage(response.data.debugImage);
      }

      setImages(response.data.images);
      setStatus(null);
      if (response.data.images.length === 0) {
        setError(response.data.error || (isAdvanced ? "Advanced crawler couldn't find images. Try 'AI Extraction' mode." : "No images found. Try 'Advanced Mode' or 'AI Extraction'."));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to bypass robot checker. Nettruyen has strong protection.");
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiExtract = async () => {
    if (!htmlInput) return;
    setIsLoading(true);
    setError(null);
    setStatus("AI is analyzing HTML...");
    
    try {
      // We'll call Gemini directly from frontend as per guidelines
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
          { text: `HTML SOURCE:\n${htmlInput.substring(0, 50000)}` } // Limit to 50k chars for safety
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

  const handleImageSelect = async (imgUrl: string) => {
    try {
      setStatus("Fetching image via proxy...");
      // Use the exact chapter URL as the referer, as some sites check for specific paths
      const refererUrl = url || "https://nettruyenviet10.com/";
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}&referer=${encodeURIComponent(refererUrl)}`;
      const response = await axios.get(proxyUrl, { responseType: 'blob' });
      
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
                <Zap size={12} className={isAdvanced ? "fill-current" : ""} /> {isAdvanced ? "Advanced Mode ON" : "Enable Advanced Mode"}
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
          
          {status && (
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
