import React, { useRef, useEffect } from "react";
import { Upload, Languages } from "lucide-react";
import { motion } from "motion/react";

interface ImageUploaderProps {
  onUpload: (base64: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                onUpload(reader.result as string);
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [onUpload]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] border-2 border-dashed border-[#141414]/20 rounded-3xl bg-white/50 hover:bg-white/80 transition-colors cursor-pointer group relative overflow-hidden"
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="grid grid-cols-12 h-full w-full">
          {Array.from({ length: 144 }).map((_, i) => (
            <div key={i} className="border border-[#141414] aspect-square" />
          ))}
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-20 h-20 bg-[#141414] rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500 shadow-2xl">
          <Upload size={32} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Upload Manga Page</h2>
          <p className="text-[#141414]/60 max-w-xs">
            Select an image or <span className="font-bold text-[#141414]">paste from clipboard (Ctrl+V)</span> to automatically extract and translate text.
          </p>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
      </div>
    </motion.div>
  );
};
