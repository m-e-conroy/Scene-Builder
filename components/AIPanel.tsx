
import React from 'react';
import { Sparkles, Sliders, Image as ImageIcon, Loader2, Info, Maximize2 } from 'lucide-react';

interface AIPanelProps {
  prompt: string;
  setPrompt: (p: string) => void;
  strength: number;
  setStrength: (s: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  resultImage: string | null;
  onOpenPreview: () => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ 
  prompt, setPrompt, strength, setStrength, onGenerate, isGenerating, resultImage, onOpenPreview 
}) => {
  return (
    <div className="w-80 h-full bg-[#111] border-l border-[#222] flex flex-col pointer-events-auto overflow-y-auto">
      <div className="p-4 border-b border-[#222]">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sparkles size={14} className="text-blue-400" /> Neural Renderer
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase font-bold mb-2 flex justify-between">
              Creative Prompt
              <span className="text-blue-500 font-mono text-[8px]">GEMINI 2.5 FLASH</span>
            </label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe materials, lighting, and mood..."
              className="w-full h-32 bg-[#0a0a0a] border border-[#222] rounded-md p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none leading-relaxed transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1">
                <Sliders size={12} /> Transform Strength
              </label>
              <span className="text-[10px] text-blue-400 font-mono">{(strength * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full accent-blue-600 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer"
            />
            <div className="mt-2 flex items-start gap-2 bg-blue-500/5 p-2 rounded border border-blue-500/10">
              <Info size={12} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-[9px] text-gray-400 leading-tight">
                {strength < 0.35 
                  ? "Rigid: Keeps exact 3D silhouettes. Best for product shots." 
                  : strength > 0.75 
                  ? "Fluid: Uses scene as a loose sketch. Best for concept art."
                  : "Balanced: Maintains layout but reimagines every surface."}
              </p>
            </div>
          </div>

          <button 
            onClick={onGenerate}
            disabled={isGenerating || !prompt}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-xl
              ${isGenerating || !prompt 
                ? 'bg-[#222] text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.02] active:scale-95 shadow-blue-500/10'}`}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" /> TRANSFORMING...
              </>
            ) : (
              <>
                <ImageIcon size={16} /> GENERATE RENDER
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 flex-1">
        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-3">AI Output</label>
        {resultImage ? (
          <div 
            onClick={onOpenPreview}
            className="relative group rounded-lg overflow-hidden border border-[#333] shadow-2xl bg-black cursor-zoom-in"
          >
            <img src={resultImage} alt="AI Result" className="w-full aspect-square object-cover" />
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <Maximize2 size={24} className="text-white mb-2" />
               <span className="text-white text-[10px] font-black uppercase tracking-widest">Open High-Res Preview</span>
            </div>
          </div>
        ) : (
          <div className="aspect-square bg-[#0a0a0a] rounded-lg border-2 border-dashed border-[#222] flex flex-col items-center justify-center p-6 text-center text-gray-700">
            <div className="w-12 h-12 rounded-full bg-[#151515] flex items-center justify-center mb-4">
              <Sparkles size={20} className="opacity-20" />
            </div>
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Awaiting Input</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPanel;
