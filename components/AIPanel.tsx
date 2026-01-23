import React, { useState } from 'react';
import { 
  Sparkles, Sliders, Image as ImageIcon, Loader2, Info, Maximize2, 
  Sun, Trash2, Upload, Wand2, Plus, Check, Lightbulb, Camera, 
  Zap, Palette, Tag, BrainCircuit
} from 'lucide-react';
import { enhancePrompt } from '../services/geminiService';

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

const TEMPLATES = [
  { label: "Cinematic Reality", prompt: "Cinematic shot, highly detailed, photorealistic, 8k resolution, dramatic lighting, depth of field" },
  { label: "Studio Product", prompt: "Studio photography, professional lighting, clean background, sharp focus, 4k, product advertisement" },
  { label: "Architectural", prompt: "Architectural visualization, modern design, interior lighting, wide angle, hyper-realistic, unreal engine 5" },
  { label: "Sci-Fi Concept", prompt: "Futuristic sci-fi concept art, neon lights, cyberpunk aesthetic, volumetric fog, digital art, trending on artstation" },
  { label: "Fantasy", prompt: "Fantasy environment, magical atmosphere, ethereal lighting, painterly style, matte painting, masterpiece" }
];

const KEYWORD_CATEGORIES = {
  Lighting: { icon: <Lightbulb size={12} />, words: ["Golden Hour", "Soft Box", "Volumetric Fog", "Neon Lights", "Rim Lighting", "Global Illumination", "Cinematic Lighting", "Dark & Moody"] },
  Camera: { icon: <Camera size={12} />, words: ["Wide Angle", "Macro", "Telephoto", "Bokeh", "Depth of Field", "Fisheye", "ISO 100", "Tilt-Shift"] },
  Quality: { icon: <Zap size={12} />, words: ["8K Resolution", "Photorealistic", "Unreal Engine 5", "Octane Render", "Ray Tracing", "Hyper-Detailed", "HDR", "Sharp Focus"] },
  Style: { icon: <Palette size={12} />, words: ["Cyberpunk", "Minimalist", "Industrial", "Surrealism", "Vaporwave", "Noir", "Ghibli Style", "Low Poly"] }
};

const AIPanel: React.FC<AIPanelProps> = ({ 
  prompt, setPrompt, strength, setStrength, onGenerate, isGenerating, resultImage, onOpenPreview,
  lightingReference, setLightingReference
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeKeywordTab, setActiveKeywordTab] = useState<keyof typeof KEYWORD_CATEGORIES>('Lighting');
  const [isRefining, setIsRefining] = useState(false);

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

  const addKeyword = (word: string) => {
    if (prompt.includes(word)) return;
    const separator = prompt.trim().length > 0 && !prompt.trim().endsWith(',') ? ', ' : '';
    setPrompt(`${prompt.trim()}${separator}${word}`);
  };

  const applyTemplate = (templatePrompt: string) => {
    if (prompt.trim().length > 0) {
      if (window.confirm("Replace current prompt with template?")) {
        setPrompt(templatePrompt);
      }
    } else {
      setPrompt(templatePrompt);
    }
    setShowTemplates(false);
  };

  const handleEnhance = async () => {
    if (!prompt.trim() || isRefining) return;
    setIsRefining(true);
    try {
      const refined = await enhancePrompt(prompt);
      setPrompt(refined);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="w-80 h-full bg-[#111] border-l border-[#222] flex flex-col pointer-events-auto overflow-y-auto custom-scrollbar">
      <div className="p-4 border-b border-[#222] bg-[#111] sticky top-0 z-10">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2"><Sparkles size={14} className="text-blue-400" /> Neural Renderer</span>
        </h2>
        
        <div className="space-y-4">
          
          {/* Prompt Section */}
          <div className="space-y-2">
             <div className="flex items-center justify-between">
                <label className="text-[10px] text-gray-500 uppercase font-bold">Creative Prompt</label>
                <div className="flex items-center gap-1">
                   <span className="text-[8px] text-gray-600 font-mono mr-2">{prompt.length} chars</span>
                   
                   <button 
                      onClick={handleEnhance}
                      disabled={isRefining || !prompt.trim()}
                      className={`p-1 rounded transition-all ${isRefining ? 'bg-purple-600/20 text-purple-400' : 'bg-[#222] text-gray-400 hover:bg-purple-600 hover:text-white'}`}
                      title="Refine with AI"
                   >
                      {isRefining ? <Loader2 size={10} className="animate-spin" /> : <BrainCircuit size={10} />}
                   </button>

                   <button 
                      onClick={() => setShowTemplates(!showTemplates)}
                      className={`p-1 rounded transition-colors ${showTemplates ? 'bg-blue-600 text-white' : 'bg-[#222] text-gray-400 hover:text-white'}`}
                      title="Templates"
                   >
                      <Wand2 size={10} />
                   </button>
                </div>
             </div>

             {showTemplates && (
                <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-2 mb-2 grid grid-cols-1 gap-1 animate-in slide-in-from-top-2">
                   {TEMPLATES.map(t => (
                      <button 
                        key={t.label} 
                        onClick={() => applyTemplate(t.prompt)}
                        className="text-left px-2 py-1.5 hover:bg-[#252525] rounded text-[10px] text-gray-300 flex items-center gap-2 group"
                      >
                         <Tag size={10} className="text-blue-500 opacity-0 group-hover:opacity-100" />
                         {t.label}
                      </button>
                   ))}
                </div>
             )}

             <div className="relative group">
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe materials, lighting, and mood..."
                  className="w-full h-24 bg-[#0a0a0a] border border-[#222] rounded-t-md p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none leading-relaxed transition-colors scrollbar-hide"
                />
                
                {/* Keyword Inspector */}
                <div className="bg-[#151515] border-x border-b border-[#222] rounded-b-md p-2">
                   <div className="flex gap-1 mb-2 border-b border-[#333] pb-1">
                      {(Object.keys(KEYWORD_CATEGORIES) as Array<keyof typeof KEYWORD_CATEGORIES>).map(cat => (
                         <button
                            key={cat}
                            onClick={() => setActiveKeywordTab(cat)}
                            className={`flex-1 py-1 text-[8px] font-bold uppercase tracking-wider rounded flex items-center justify-center gap-1 transition-colors
                               ${activeKeywordTab === cat ? 'bg-[#222] text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}
                         >
                            {KEYWORD_CATEGORIES[cat].icon}
                            {cat}
                         </button>
                      ))}
                   </div>
                   <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto scrollbar-hide">
                      {KEYWORD_CATEGORIES[activeKeywordTab].words.map(word => {
                         const isActive = prompt.includes(word);
                         return (
                            <button
                               key={word}
                               onClick={() => addKeyword(word)}
                               disabled={isActive}
                               className={`px-2 py-1 text-[9px] rounded text-left truncate transition-all flex items-center justify-between group
                                  ${isActive ? 'bg-blue-900/20 text-blue-400' : 'bg-[#0a0a0a] text-gray-400 hover:bg-[#222] hover:text-white'}`}
                            >
                               {word}
                               {isActive ? <Check size={8} /> : <Plus size={8} className="opacity-0 group-hover:opacity-100" />}
                            </button>
                         )
                      })}
                   </div>
                </div>
             </div>
          </div>

          {/* Lighting Reference */}
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

          {/* Strength Slider */}
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