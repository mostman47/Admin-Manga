import React, { useState } from "react";
import { Search, Image as ImageIcon, Loader2, ExternalLink, Download } from "lucide-react";
import axios from "axios";

interface CrawlerProps {
  onSelectImage: (base64: string) => void;
}

export const Crawler: React.FC<CrawlerProps> = ({ onSelectImage }) => {
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError(null);
    setImages([]);

    try {
      const response = await axios.post("/api/crawl", { url });
      setImages(response.data.images);
      if (response.data.images.length === 0) {
        setError("No images found on this page.");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to crawl the URL.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = async (imgUrl: string) => {
    try {
      // Use the proxy route to bypass CORS and hotlink protection
      const refererUrl = url || new URL(imgUrl).origin;
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}&referer=${encodeURIComponent(refererUrl)}`;
      const response = await axios.get(proxyUrl, { responseType: 'blob' });
      
      const reader = new FileReader();
      reader.onloadend = () => {
        onSelectImage(reader.result as string);
      };
      reader.readAsDataURL(response.data);
    } catch (err) {
      console.error("Failed to fetch image via proxy:", err);
      alert("Failed to fetch image. The site might have strong anti-bot protection.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white p-8 rounded-3xl shadow-2xl border border-[#141414]/10 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Search className="text-[#141414]/40" size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2 uppercase italic font-serif">Image Scrawler</h2>
        <p className="text-[#141414]/60 text-sm mb-8">Enter a URL to extract all images for translation.</p>

        <form onSubmit={handleCrawl} className="flex gap-2">
          <input 
            type="url" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/manga-page"
            className="flex-1 px-6 py-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#141414] text-sm font-bold"
            required
          />
          <button 
            type="submit"
            disabled={isLoading}
            className="px-8 py-4 bg-[#141414] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            Scrawl
          </button>
        </form>

        {error && (
          <p className="mt-4 text-red-500 text-xs font-bold uppercase tracking-wider">{error}</p>
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
