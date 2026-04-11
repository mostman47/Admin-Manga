export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface TextBlock {
  text: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] (0-1000)
  translation_vi: string;
  translation_hi: string;
  background_color: string;
}

export type Language = "vi" | "hi" | "original" | "clean";

export interface ImageSize {
  width: number;
  height: number;
}
