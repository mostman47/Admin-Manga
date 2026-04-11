/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from "react";
import { Languages } from "lucide-react";
import { TextBlock, Language, TokenUsage } from "./types";
import { processImage, cleanArt } from "./services/gemini";
import { ImageUploader } from "./components/ImageUploader";
import { MangaViewer } from "./components/MangaViewer";
import { Sidebar } from "./components/Sidebar";
import { Crawler } from "./components/Crawler";
import { NettruyenCrawler } from "./components/NettruyenCrawler";

type Page = "translate" | "crawl" | "nettruyen";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("translate");
  const [image, setImage] = useState<string | null>(null);
  const [cleanedImage, setCleanedImage] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>("vi");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<TokenUsage>({ promptTokens: 0, candidatesTokens: 0, totalTokens: 0 });
  const [isAiEnabled, setIsAiEnabled] = useState(true);

  const handleUpload = useCallback(async (base64: string) => {
    setImage(base64);
    setCleanedImage(null);
    setBlocks([]);
    setError(null);
    setUsage({ promptTokens: 0, candidatesTokens: 0, totalTokens: 0 });
    setCurrentPage("translate"); // Switch to translate view if we upload an image
    
    if (!isAiEnabled) return;

    setIsProcessing(true);
    try {
      const { blocks: detectedBlocks, usage: detectionUsage } = await processImage(base64);
      setBlocks(detectedBlocks);
      setUsage(prev => ({
        promptTokens: prev.promptTokens + detectionUsage.promptTokens,
        candidatesTokens: prev.candidatesTokens + detectionUsage.candidatesTokens,
        totalTokens: prev.totalTokens + detectionUsage.totalTokens,
      }));
      
      // Automatically trigger cleaning
      setIsCleaning(true);
      const { image: cleaned, usage: cleaningUsage } = await cleanArt(base64);
      if (cleaned) {
        setCleanedImage(cleaned);
      }
      setUsage(prev => ({
        promptTokens: prev.promptTokens + cleaningUsage.promptTokens,
        candidatesTokens: prev.candidatesTokens + cleaningUsage.candidatesTokens,
        totalTokens: prev.totalTokens + cleaningUsage.totalTokens,
      }));
    } catch (err) {
      console.error("Error processing image:", err);
      setError("Failed to process the image. Please try again.");
    } finally {
      setIsProcessing(false);
      setIsCleaning(false);
    }
  }, [isAiEnabled]);

  const handleRescan = async () => {
    if (!image) return;
    setIsProcessing(true);
    try {
      const { blocks: detectedBlocks, usage: detectionUsage } = await processImage(image);
      setBlocks(detectedBlocks);
      setUsage(prev => ({
        promptTokens: prev.promptTokens + detectionUsage.promptTokens,
        candidatesTokens: prev.candidatesTokens + detectionUsage.candidatesTokens,
        totalTokens: prev.totalTokens + detectionUsage.totalTokens,
      }));
    } catch (err) {
      console.error("Error rescanning image:", err);
      setError("Failed to rescan the image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddManualBlock = (block: TextBlock) => {
    setBlocks(prev => [...prev, block]);
  };

  const handleUpdateBlock = (index: number, updates: Partial<TextBlock>) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...updates } : b));
  };

  const handleDeleteBlock = (index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setImage(null);
    setCleanedImage(null);
    setBlocks([]);
    setError(null);
    setSelectedLang("vi");
    setUsage({ promptTokens: 0, candidatesTokens: 0, totalTokens: 0 });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#5A5A40] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#141414]/10 bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-[#141414] text-white p-2 rounded-lg">
              <Languages size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight uppercase italic font-serif">Manga Translation</h1>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setCurrentPage("translate")}
              className={`text-xs font-bold uppercase tracking-widest transition-all ${currentPage === "translate" ? "opacity-100 underline underline-offset-8 decoration-2" : "opacity-40 hover:opacity-100"}`}
            >
              Translation
            </button>
            <button 
              onClick={() => setCurrentPage("crawl")}
              className={`text-xs font-bold uppercase tracking-widest transition-all ${currentPage === "crawl" ? "opacity-100 underline underline-offset-8 decoration-2" : "opacity-40 hover:opacity-100"}`}
            >
              Scrawler
            </button>
            <button 
              onClick={() => setCurrentPage("nettruyen")}
              className={`text-xs font-bold uppercase tracking-widest transition-all ${currentPage === "nettruyen" ? "opacity-100 underline underline-offset-8 decoration-2" : "opacity-40 hover:opacity-100"}`}
            >
              Nettruyen
            </button>
          </nav>
        </div>
        
        {image && currentPage === "translate" && (
          <div className="flex items-center gap-2 bg-[#E4E3E0] p-1 rounded-full border border-[#141414]/10">
            {(["original", "vi", "hi", "clean"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
                  selectedLang === lang 
                    ? "bg-[#141414] text-white shadow-lg" 
                    : "text-[#141414]/60 hover:text-[#141414]"
                }`}
              >
                {lang === "original" ? "Original" : lang === "vi" ? "Vietnamese" : lang === "hi" ? "Hindi" : "Clean Art"}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-12">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {currentPage === "crawl" ? (
          <Crawler onSelectImage={handleUpload} />
        ) : currentPage === "nettruyen" ? (
          <NettruyenCrawler 
            onSelectImage={handleUpload} 
            onUsageUpdate={(newUsage) => setUsage(prev => ({
              promptTokens: prev.promptTokens + newUsage.promptTokens,
              candidatesTokens: prev.candidatesTokens + newUsage.candidatesTokens,
              totalTokens: prev.totalTokens + newUsage.totalTokens,
            }))}
          />
        ) : !image ? (
          <ImageUploader onUpload={handleUpload} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 items-start">
            <MangaViewer 
              image={image}
              cleanedImage={cleanedImage}
              blocks={blocks}
              selectedLang={selectedLang}
              isProcessing={isProcessing}
              isCleaning={isCleaning}
              isAiEnabled={isAiEnabled}
              onAddBlock={handleAddManualBlock}
            />

            <Sidebar 
              blocks={blocks}
              isProcessing={isProcessing}
              isCleaning={isCleaning}
              selectedLang={selectedLang}
              usage={usage}
              isAiEnabled={isAiEnabled}
              onToggleAi={() => setIsAiEnabled(!isAiEnabled)}
              onReset={reset}
              onRescan={handleRescan}
              onSelectLang={setSelectedLang}
              onUpdateBlock={handleUpdateBlock}
              onDeleteBlock={handleDeleteBlock}
            />
          </div>
        )}
      </main>
    </div>
  );
}
