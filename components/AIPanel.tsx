import React from 'react';
import { Sparkles, Sliders, Image as ImageIcon, Loader2, Info, Maximize2, Sun, Trash2, Upload } from 'lucide-react';

interface AIPanelProps {
  prompt: string;
  setPrompt: (p: string) => void;
  strength: number;
  setStrength: (s: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  resultImage: string | null;
  onOpenPreview: () => void;
  lightingReference: string | null;
  setLightingReference: (url: string | null) => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ 
  prompt, setPrompt, strength, setStrength, onGenerate, isGenerating, resultImage, onOpenPreview,
  lightingReference, setLightingReference
}) => {
  
  const handleLightingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLightingReference(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
              className="w-full h-24 bg-[#0a0a0a] border border-[#222] rounded-md p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none leading-relaxed transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 uppercase font-bold mb-2 flex justify-between items-center">
              <span className="flex items-center gap-1"><Sun size={10} /> Lighting Reference</span>
              {lightingReference && <span className="text-[8px] text-green-500 font-mono">ACTIVE</span>}
            </label>
            
            <div className={`relative w-full h-16 rounded-md border-2 border-dashed transition-all overflow-hidden group
              ${lightingReference ? 'border-green-500/50 bg-green-500/10' : 'border-[#222] bg-[#0a0a0a] hover:border-blue-500/50'}`}>
              
              {lightingReference ? (
                <>
                  <img src={lightingReference} alt="Light Ref" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60">
                     <button 
                        onClick={() => setLightingReference(null)} 
                        className="p-1.5 bg-red-600 rounded text-white hover:bg-red-500"
                        title="Remove Reference"
                     >
                       <Trash2 size={12} />
                     </button>
                  </div>
                </>
              ) : (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                  <Upload size={14} className="text-gray-600 mb-1" />
                  <span className="text-[8px] text-gray-600 font-bold uppercase">Upload Style Match</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleLightingUpload} />
                </label>
              )}
            </div>
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