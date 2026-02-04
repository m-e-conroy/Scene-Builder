
import React, { useState } from 'react';
import { BatchConfig, BatchMode, StylePreset } from '../types';
import { Layers, Sliders, Type, Zap, Check, X, Play } from 'lucide-react';

interface BatchDialogProps {
  onClose: () => void;
  onStart: (config: BatchConfig) => void;
  presets: StylePreset[];
}

const BatchDialog: React.FC<BatchDialogProps> = ({ onClose, onStart, presets }) => {
  const [mode, setMode] = useState<BatchMode>('iteration');
  const [count, setCount] = useState(4);
  const [strengthRange, setStrengthRange] = useState({ start: 0.35, end: 0.75, steps: 3 });
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);

  const handleStart = () => {
    onStart({
      mode,
      count,
      strengthRange,
      selectedPresetIds: selectedPresets
    });
  };

  const togglePreset = (id: string) => {
    setSelectedPresets(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const getCostEstimate = () => {
    switch (mode) {
      case 'iteration': return count;
      case 'prompt': return count;
      case 'strength': return strengthRange.steps;
      case 'preset': return selectedPresets.length;
    }
  };

  const cost = getCostEstimate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111] border border-[#333] rounded-xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-purple-600/20 p-2 rounded-lg text-purple-400">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Batch Processor</h3>
              <p className="text-[10px] text-gray-500">Automated variation generation pipeline</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 min-h-[400px]">
          {/* Sidebar */}
          <div className="w-48 border-r border-[#222] bg-[#0a0a0a] p-2 space-y-1">
            <button 
              onClick={() => setMode('iteration')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === 'iteration' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Zap size={14} /> Iteration
            </button>
            <button 
              onClick={() => setMode('strength')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === 'strength' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Sliders size={14} /> Strength Sweep
            </button>
            <button 
              onClick={() => setMode('prompt')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === 'prompt' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Type size={14} /> Prompt Lab
            </button>
            <button 
              onClick={() => setMode('preset')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === 'preset' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Layers size={14} /> Preset Stack
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 bg-[#111]">
            
            {mode === 'iteration' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-white text-sm font-bold mb-2">Random Iterations</h4>
                  <p className="text-xs text-gray-500 mb-6">Generate multiple images using the current settings. Leveraging the inherent randomness of the AI to explore subtle variations.</p>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold text-gray-400">
                      <span>Count</span>
                      <span className="text-blue-400">{count} Images</span>
                    </div>
                    <input 
                      type="range" min="1" max="10" step="1" 
                      value={count} onChange={(e) => setCount(parseInt(e.target.value))}
                      className="w-full accent-purple-500 h-1 bg-[#222] rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === 'strength' && (
              <div className="space-y-6">
                 <div>
                  <h4 className="text-white text-sm font-bold mb-2">Strength Sweep</h4>
                  <p className="text-xs text-gray-500 mb-6">Render the scene at different transformation strengths to find the perfect balance between structure and creativity.</p>
                  
                  <div className="space-y-6 bg-[#0a0a0a] p-4 rounded-lg border border-[#222]">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-gray-400">
                          <span>Start Strength</span>
                          <span className="text-blue-400">{(strengthRange.start * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.05" 
                          value={strengthRange.start} onChange={(e) => setStrengthRange(p => ({...p, start: parseFloat(e.target.value)}))}
                          className="w-full accent-blue-500 h-1 bg-[#222] rounded-lg cursor-pointer"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-gray-400">
                          <span>End Strength</span>
                          <span className="text-blue-400">{(strengthRange.end * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.05" 
                          value={strengthRange.end} onChange={(e) => setStrengthRange(p => ({...p, end: parseFloat(e.target.value)}))}
                          className="w-full accent-red-500 h-1 bg-[#222] rounded-lg cursor-pointer"
                        />
                    </div>
                    <div className="space-y-2 pt-4 border-t border-[#222]">
                        <div className="flex justify-between text-xs font-bold text-gray-400">
                          <span>Total Steps</span>
                          <span className="text-white">{strengthRange.steps} Images</span>
                        </div>
                        <input 
                          type="range" min="2" max="10" step="1" 
                          value={strengthRange.steps} onChange={(e) => setStrengthRange(p => ({...p, steps: parseInt(e.target.value)}))}
                          className="w-full accent-purple-500 h-1 bg-[#222] rounded-lg cursor-pointer"
                        />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mode === 'prompt' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-white text-sm font-bold mb-2">AI Prompt Lab</h4>
                  <p className="text-xs text-gray-500 mb-6">Automatically generate and render {count} creative rewrites of your current prompt to explore different styles and moods.</p>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold text-gray-400">
                      <span>Variation Count</span>
                      <span className="text-blue-400">{count} Variations</span>
                    </div>
                    <input 
                      type="range" min="1" max="10" step="1" 
                      value={count} onChange={(e) => setCount(parseInt(e.target.value))}
                      className="w-full accent-purple-500 h-1 bg-[#222] rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === 'preset' && (
              <div className="space-y-4 h-full flex flex-col">
                 <div>
                  <h4 className="text-white text-sm font-bold mb-2">Preset Stack</h4>
                  <p className="text-xs text-gray-500 mb-4">Select multiple styles to render sequentially.</p>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {presets.map(preset => (
                      <button 
                        key={preset.id}
                        onClick={() => togglePreset(preset.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${selectedPresets.includes(preset.id) ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-[#0a0a0a] border-[#222] text-gray-400 hover:border-gray-600'}`}
                      >
                         <span className="text-xs font-bold uppercase">{preset.name}</span>
                         {selectedPresets.includes(preset.id) && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))}
                 </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#0a0a0a] flex items-center justify-between">
          <div className="text-[10px] text-gray-500 uppercase font-bold">
             Estimated Queue: <span className="text-white">{cost} Renders</span>
          </div>
          <button 
            onClick={handleStart}
            disabled={cost === 0}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${cost > 0 ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20' : 'bg-[#222] text-gray-600 cursor-not-allowed'}`}
          >
            <Play size={14} fill="currentColor" /> Start Batch
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchDialog;
