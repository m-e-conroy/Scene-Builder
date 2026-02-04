
import React, { useState } from 'react';
import { BatchResultItem } from '../types';
import { X, Download, Globe, ChevronLeft, Trash2, Maximize2 } from 'lucide-react';
import PreviewOverlay from './PreviewOverlay';

interface BatchResultViewerProps {
  results: BatchResultItem[];
  sourceImage: string | null;
  onClose: () => void;
  onSetBackdrop: (url: string) => void;
  onDiscard: (id: string) => void;
}

const BatchResultViewer: React.FC<BatchResultViewerProps> = ({ 
  results, sourceImage, onClose, onSetBackdrop, onDiscard 
}) => {
  const [selectedResult, setSelectedResult] = useState<BatchResultItem | null>(null);

  if (selectedResult) {
    return (
      <PreviewOverlay 
        sourceImage={sourceImage}
        resultImage={selectedResult.imageUrl}
        prompt={selectedResult.metadata}
        strength={0.5} // Metadata might contain strength, but simplifying for now
        onClose={() => setSelectedResult(null)}
        onSetAsBackdrop={() => {
            onSetBackdrop(selectedResult.imageUrl);
            setSelectedResult(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-16 border-b border-[#222] flex items-center justify-between px-6 bg-[#111]">
        <div className="flex items-center gap-4">
           <button onClick={onClose} className="p-2 hover:bg-[#222] rounded-full text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
           </button>
           <div>
             <h2 className="text-sm font-bold text-white uppercase tracking-wider">Batch Results</h2>
             <p className="text-[10px] text-gray-500 font-mono">{results.length} Images Generated</p>
           </div>
        </div>
        <div className="flex gap-2">
           <button onClick={onClose} className="p-2 text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {results.map(item => (
            <div key={item.id} className="group relative bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden hover:border-purple-500/50 transition-all flex flex-col">
               <div className="relative aspect-square cursor-pointer overflow-hidden" onClick={() => setSelectedResult(item)}>
                  <img src={item.imageUrl} alt="Result" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <Maximize2 size={24} className="text-white drop-shadow-lg" />
                  </div>
               </div>
               
               <div className="p-3 bg-[#111] flex-1 flex flex-col justify-between">
                  <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed mb-3 h-8">{item.metadata}</p>
                  
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#222]">
                     <button 
                        onClick={() => onDiscard(item.id)}
                        className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Discard"
                     >
                        <Trash2 size={14} />
                     </button>
                     <div className="flex items-center gap-2">
                        <button 
                           onClick={() => onSetBackdrop(item.imageUrl)}
                           className="p-1.5 text-gray-600 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors" title="Set as Backdrop"
                        >
                           <Globe size={14} />
                        </button>
                        <a 
                           href={item.imageUrl} 
                           download={`batch-${item.id}.png`}
                           className="p-1.5 text-gray-600 hover:text-white hover:bg-[#333] rounded transition-colors" title="Download"
                        >
                           <Download size={14} />
                        </a>
                     </div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BatchResultViewer;
