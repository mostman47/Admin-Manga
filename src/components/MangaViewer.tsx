import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { TextBlock, Language, ImageSize } from "../types";

interface MangaViewerProps {
  image: string;
  cleanedImage: string | null;
  blocks: TextBlock[];
  selectedLang: Language;
  isProcessing: boolean;
  isCleaning: boolean;
  isAiEnabled: boolean;
  onAddBlock: (block: TextBlock) => void;
}

export const MangaViewer: React.FC<MangaViewerProps> = ({
  image,
  cleanedImage,
  blocks,
  selectedLang,
  isProcessing,
  isCleaning,
  isAiEnabled,
  onAddBlock,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  const updateImageSize = () => {
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAiEnabled || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    setCurrentPos({
      x: Math.max(0, Math.min(e.clientX - rect.left, imageSize.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, imageSize.height)),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const xmin = Math.min(startPos.x, currentPos.x);
    const xmax = Math.max(startPos.x, currentPos.x);
    const ymin = Math.min(startPos.y, currentPos.y);
    const ymax = Math.max(startPos.y, currentPos.y);

    // Only add if it's a meaningful box
    if (xmax - xmin > 10 && ymax - ymin > 10) {
      const normalizedBlock: TextBlock = {
        text: "Manual Entry",
        box_2d: [
          (ymin / imageSize.height) * 1000,
          (xmin / imageSize.width) * 1000,
          (ymax / imageSize.height) * 1000,
          (xmax / imageSize.width) * 1000,
        ],
        translation_vi: "Nhập bản dịch...",
        translation_hi: "अनुवाद दर्ज करें...",
        background_color: "#FFFFFF",
      };
      onAddBlock(normalizedBlock);
    }
  };

  useEffect(() => {
    window.addEventListener("resize", updateImageSize);
    return () => window.removeEventListener("resize", updateImageSize);
  }, []);

  const getFontSize = (width: number, height: number, text: string) => {
    const area = width * height;
    const charCount = text.length || 1;
    const baseSize = Math.sqrt(area / charCount) * 0.95;
    return Math.min(Math.max(baseSize, 11), 32);
  };

  // Determine which image to show as the base
  const baseImage = (selectedLang !== "original" && cleanedImage) ? cleanedImage : image;

  return (
    <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#141414]/10">
      <div 
        className={`relative inline-block w-full ${!isAiEnabled ? "cursor-crosshair" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDrawing(false)}
      >
        <img 
          ref={imageRef}
          src={baseImage} 
          alt="Manga Page" 
          className="w-full h-auto block select-none"
          onLoad={updateImageSize}
          draggable={false}
        />

        {/* Drawing Preview */}
        {isDrawing && (
          <div 
            className="absolute border-2 border-[#141414] bg-[#141414]/10 z-50 pointer-events-none"
            style={{
              top: Math.min(startPos.y, currentPos.y),
              left: Math.min(startPos.x, currentPos.x),
              width: Math.abs(currentPos.x - startPos.x),
              height: Math.abs(currentPos.y - startPos.y),
            }}
          />
        )}
        
        {/* Overlay Text Blocks */}
        {(selectedLang === "vi" || selectedLang === "hi") && blocks.map((block, idx) => {
          const [ymin, xmin, ymax, xmax] = block.box_2d;
          const top = (ymin / 1000) * imageSize.height;
          const left = (xmin / 1000) * imageSize.width;
          const width = ((xmax - xmin) / 1000) * imageSize.width;
          const height = ((ymax - ymin) / 1000) * imageSize.height;
          
          const translation = selectedLang === "vi" ? block.translation_vi : block.translation_hi;
          const fontSize = getFontSize(width, height, translation);

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute flex items-center justify-center text-center leading-tight overflow-hidden"
              style={{
                top: top - 2,
                left: left - 2,
                width: width + 4,
                height: height + 4,
                // If we have a cleaned image, we assume the bubble is preserved but empty.
                // We only use background color if cleanedImage is missing to hide original text.
                backgroundColor: cleanedImage ? "transparent" : (block.background_color || "#FFFFFF"),
                zIndex: 10,
                padding: "4px",
                pointerEvents: "none"
              }}
            >
              <span 
                className="font-comic font-bold text-black break-words hyphens-auto"
                style={{ 
                  fontSize: `${fontSize}px`,
                  textShadow: "0 0 2px white, 0 0 4px white" 
                }}
              >
                {translation}
              </span>
            </motion.div>
          );
        })}

        {/* Original mode guides */}
        {selectedLang === "original" && blocks.map((block, idx) => {
          const [ymin, xmin, ymax, xmax] = block.box_2d;
          const top = (ymin / 1000) * imageSize.height;
          const left = (xmin / 1000) * imageSize.width;
          const width = ((xmax - xmin) / 1000) * imageSize.width;
          const height = ((ymax - ymin) / 1000) * imageSize.height;
          return (
            <div 
              key={idx}
              className="absolute border border-dashed border-red-500/50 z-10 pointer-events-none"
              style={{ top, left, width, height }}
            />
          );
        })}

        {(isProcessing || isCleaning) && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white z-[100]">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="font-bold tracking-widest uppercase italic text-center px-6">
              {isCleaning ? "AI is reconstructing the art behind the text..." : "Scanning & Translating..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
