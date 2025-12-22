
import React, { useState } from 'react';
import { X, Download, Globe, Sparkles, Box, Info, ChevronRight, ChevronLeft } from 'lucide-react';

interface PreviewOverlayProps {
  sourceImage: string | null;
  resultImage: string;
  prompt: string;
  strength: number;
  onClose: () => void;
  onSetAsBackdrop: () => void;
}

const PreviewOverlay: React.FC<PreviewOverlayProps> = ({
  sourceImage,
  resultImage,
  prompt,
  strength,
  onClose,
  onSetAsBackdrop
}) => {
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505]/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
      <div className="absolute top-6 right-6 flex items-center gap-4 z-[110]">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
           <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Strength</span>
           <span className="text-[10px] text-blue-400 font-mono font-bold">{(strength * 100).toFixed(0)}%</span>
        </div>
        <button 
          onClick={onClose}
          className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors border border-white/10"
        >
          <X size={20} />
        </button>
      </div>

      <div className="w-full max-w-7xl px-8 flex flex-col md:flex-row gap-8 items-center">
        {/* Main Display Area */}
        <div className="flex-1 relative aspect-square md:aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/5 group">
          <img 
            src={showSource && sourceImage ? sourceImage : resultImage} 
            alt="Preview" 
            className="w-full h-full object-contain transition-all duration-500 ease-out"
          />
          
          {/* Label Overlays */}
          <div className="absolute bottom-6 left-6 flex items-center gap-3">
             <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showSource ? 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'}`}>
                {showSource ? <Box size={12} /> : <Sparkles size={12} />}
                {showSource ? 'Viewport Blueprint' : 'Neural Render'}
             </div>
          </div>

          {/* Toggle Control Overlay */}
          <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
             <div className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white/50"><ChevronLeft size={24}/></div>
             <div className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white/50"><ChevronRight size={24}/></div>
          </div>
        </div>

        {/* Sidebar Info & Controls */}
        <div className="w-full md:w-80 space-y-6">
          <div className="space-y-2">
            <h3 className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2">
              <Info size={12} /> Render Intelligence
            </h3>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-[11px] text-gray-300 leading-relaxed font-medium italic">
              "{prompt}"
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button 
              onMouseDown={() => setShowSource(true)}
              onMouseUp={() => setShowSource(false)}
              onMouseLeave={() => setShowSource(false)}
              className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-3
                ${showSource ? 'bg-yellow-500 border-yellow-400 text-black scale-[0.98]' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
            >
              <Box size={16} /> Hold to Peek 3D
            </button>

            <button 
              onClick={onSetAsBackdrop}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-blue-400/20 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20"
            >
              <Globe size={16} /> Use as Backdrop
            </button>

            <a 
              href={resultImage}
              download="gemini-render.png"
              className="w-full py-4 bg-white text-black hover:bg-gray-200 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl"
            >
              <Download size={16} /> Download 8K
            </a>
          </div>

          <div className="pt-4 border-t border-white/10">
            <p className="text-[9px] text-gray-600 font-bold uppercase leading-tight tracking-tighter">
              AI-Augmented workflow. The render engine interpreted your 3D layout with {strength > 0.5 ? 'high' : 'low'} creative freedom.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewOverlay;
