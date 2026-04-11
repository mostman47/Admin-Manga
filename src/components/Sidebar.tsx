import React from "react";
import { X, Image as ImageIcon, RefreshCw, ChevronRight, BarChart3, Cpu, MousePointer2, Trash2 } from "lucide-react";
import { TextBlock, Language, TokenUsage } from "../types";

interface SidebarProps {
  blocks: TextBlock[];
  isProcessing: boolean;
  isCleaning: boolean;
  selectedLang: Language;
  usage: TokenUsage;
  isAiEnabled: boolean;
  onToggleAi: () => void;
  onReset: () => void;
  onRescan: () => void;
  onSelectLang: (lang: Language) => void;
  onUpdateBlock: (index: number, updates: Partial<TextBlock>) => void;
  onDeleteBlock: (index: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  blocks,
  isProcessing,
  isCleaning,
  selectedLang,
  usage,
  isAiEnabled,
  onToggleAi,
  onReset,
  onRescan,
  onSelectLang,
  onUpdateBlock,
  onDeleteBlock,
}) => {
  // Estimated cost based on Gemini 1.5 Flash pricing:
  // Input: $0.075 / 1M tokens
  // Output: $0.30 / 1M tokens
  const estimatedCost = (usage.promptTokens * 0.000000075) + (usage.candidatesTokens * 0.0000003);

  return (
    <aside className="space-y-6 sticky top-24">
      <div className="bg-white p-6 rounded-2xl border border-[#141414]/10 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold uppercase text-sm tracking-widest opacity-50">Controls</h3>
          <button 
            onClick={onReset}
            className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* AI Toggle */}
          <button 
            onClick={onToggleAi}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              isAiEnabled 
                ? "bg-[#141414] text-white border-[#141414]" 
                : "bg-white text-[#141414] border-[#141414]/20"
            }`}
          >
            <div className="flex items-center gap-3">
              {isAiEnabled ? <Cpu size={18} /> : <MousePointer2 size={18} />}
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider">
                  {isAiEnabled ? "AI Mode: ON" : "Manual Mode"}
                </p>
                <p className="text-[10px] opacity-60">
                  {isAiEnabled ? "Auto-detect & Translate" : "Draw boxes manually"}
                </p>
              </div>
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${isAiEnabled ? "bg-green-500" : "bg-gray-300"}`}>
              <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-all ${isAiEnabled ? "right-1" : "left-1"}`} />
            </div>
          </button>

          <div className="p-4 bg-[#F5F5F0] rounded-xl border border-[#141414]/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="opacity-50" />
                <span className="text-xs font-bold uppercase opacity-50">Status</span>
              </div>
              {!isProcessing && isAiEnabled && (
                <button 
                  onClick={onRescan}
                  className="text-[10px] uppercase font-bold text-[#141414]/40 hover:text-[#141414] flex items-center gap-1"
                >
                  <RefreshCw size={10} /> Re-scan
                </button>
              )}
            </div>
            <p className="text-sm font-bold">
              {isProcessing ? "Processing..." : isCleaning ? "Cleaning..." : `${blocks.length} text blocks`}
            </p>
          </div>

          {!isAiEnabled && blocks.length > 0 && (
            <div className="p-4 bg-[#F5F5F0] rounded-xl border border-[#141414]/5 space-y-3 max-h-[300px] overflow-y-auto">
              <span className="text-xs font-bold uppercase opacity-50">Manual Editor</span>
              {blocks.map((block, idx) => (
                <div key={idx} className="p-3 bg-white rounded-lg border border-[#141414]/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold opacity-40">Block #{idx + 1}</span>
                    <button onClick={() => onDeleteBlock(idx)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <textarea 
                    className="w-full text-xs p-2 bg-[#F5F5F0] rounded border-none focus:ring-1 focus:ring-[#141414] resize-none"
                    rows={2}
                    value={selectedLang === "vi" ? block.translation_vi : block.translation_hi}
                    onChange={(e) => onUpdateBlock(idx, { 
                      [selectedLang === "vi" ? "translation_vi" : "translation_hi"]: e.target.value 
                    })}
                    placeholder="Enter translation..."
                  />
                </div>
              ))}
            </div>
          )}

          <div className="p-4 bg-[#F5F5F0] rounded-xl border border-[#141414]/5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold uppercase opacity-50">Modes</span>
            </div>
            <div className="space-y-2">
              {[
                { id: "vi", label: "Vietnamese" },
                { id: "hi", label: "Hindi" },
                { id: "clean", label: "Clean Art (Inpaint)" }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onSelectLang(mode.id as Language)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    selectedLang === mode.id 
                      ? "bg-[#141414] text-white border-[#141414]" 
                      : "bg-white text-[#141414] border-[#141414]/10 hover:border-[#141414]/30"
                  }`}
                >
                  <span className="text-xs font-bold uppercase">{mode.label}</span>
                  <ChevronRight size={14} className={selectedLang === mode.id ? "opacity-100" : "opacity-30"} />
                </button>
              ))}
            </div>
          </div>

          {/* Usage Analysis */}
          {isAiEnabled && usage.totalTokens > 0 && (
            <div className="p-4 bg-[#141414] text-white rounded-xl border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="opacity-50" />
                <span className="text-xs font-bold uppercase opacity-50">Usage Analysis</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase tracking-wider">
                  <span className="opacity-50">Prompt Tokens</span>
                  <span className="font-mono">{usage.promptTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-wider">
                  <span className="opacity-50">Candidate Tokens</span>
                  <span className="font-mono">{usage.candidatesTokens.toLocaleString()}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-xs font-bold">
                  <span className="uppercase tracking-widest opacity-50">Est. Cost</span>
                  <span className="text-green-400 font-mono">${estimatedCost.toFixed(6)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-[#141414]/10 shadow-xl">
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 mb-2">Powered by Gemini AI</p>
        <p className="text-xs leading-relaxed opacity-70">
          Using Gemini 3.1 Flash Lite for ultra-efficient text detection and translation, and Gemini 2.5 Flash for professional-grade art reconstruction.
        </p>
      </div>
    </aside>
  );
};
