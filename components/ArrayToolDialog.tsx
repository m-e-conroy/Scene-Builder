
import React, { useState, useEffect } from 'react';
import { ArrayConfig, ArrayType } from '../types';
import { Copy, Grid, Circle, X, MoveHorizontal, RotateCw, Scaling, Shuffle, Box, Check, CheckSquare } from 'lucide-react';

interface ArrayToolDialogProps {
  onClose: () => void;
  onUpdate: (config: ArrayConfig) => void;
  onApply: (asGroup: boolean) => void;
}

const DEFAULT_CONFIG: ArrayConfig = {
  type: 'linear',
  linearCount: 5,
  linearOffset: [2, 0, 0],
  linearRotation: [0, 0, 0],
  linearScale: [1, 1, 1],
  radialCount: 8,
  radialRadius: 5,
  radialArc: 360,
  radialStartAngle: 0,
  radialHeightOffset: 0,
  radialFaceCenter: true,
  gridRows: 3,
  gridCols: 3,
  gridLayers: 1,
  gridSpacing: [2, 2, 2],
  randomPos: [0, 0, 0],
  randomRot: [0, 0, 0],
  randomScale: [0, 0, 0]
};

const ArrayToolDialog: React.FC<ArrayToolDialogProps> = ({ onClose, onUpdate, onApply }) => {
  const [config, setConfig] = useState<ArrayConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<ArrayType>('linear');
  const [showRandom, setShowRandom] = useState(false);

  // Update parent whenever local state changes
  useEffect(() => {
    onUpdate({ ...config, type: activeTab });
  }, [config, activeTab, onUpdate]);

  const updateConfig = (updates: Partial<ArrayConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const InputRow = ({ label, value, onChange, min, max, step, suffix }: any) => (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
        <span>{label}</span>
        <span className="text-blue-400">{value}{suffix}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} 
        value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-[#333] rounded-lg appearance-none accent-blue-500 cursor-pointer"
      />
    </div>
  );

  const VectorRow = ({ label, values, onChange, step = 0.1, min = -10, max = 10 }: any) => (
    <div className="space-y-1">
      <div className="text-[10px] text-gray-500 font-bold uppercase">{label}</div>
      <div className="grid grid-cols-3 gap-1">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="bg-[#222] rounded flex items-center px-2 py-1 border border-[#333]">
             <span className={`text-[9px] font-bold mr-2 ${i===0?'text-red-500':i===1?'text-green-500':'text-blue-500'}`}>{axis}</span>
             <input 
               type="number" step={step}
               value={values[i]}
               onChange={(e) => {
                 const newVals = [...values] as [number, number, number];
                 newVals[i] = parseFloat(e.target.value);
                 onChange(newVals);
               }}
               className="w-full bg-transparent text-[10px] text-white outline-none"
             />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed top-20 left-4 z-40 w-80 bg-[#111]/95 backdrop-blur-md border border-[#333] rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-left-4 fade-in duration-300">
      {/* Header */}
      <div className="p-3 border-b border-[#333] flex items-center justify-between bg-[#151515] rounded-t-xl">
        <div className="flex items-center gap-2">
          <Copy size={14} className="text-blue-500" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Array Tool</h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16}/></button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-[#0a0a0a] border-b border-[#333]">
        <button onClick={() => setActiveTab('linear')} className={`flex-1 py-2 flex justify-center items-center gap-2 text-[10px] font-bold uppercase transition-colors ${activeTab === 'linear' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <MoveHorizontal size={14} /> Linear
        </button>
        <button onClick={() => setActiveTab('radial')} className={`flex-1 py-2 flex justify-center items-center gap-2 text-[10px] font-bold uppercase transition-colors ${activeTab === 'radial' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Circle size={14} /> Radial
        </button>
        <button onClick={() => setActiveTab('grid')} className={`flex-1 py-2 flex justify-center items-center gap-2 text-[10px] font-bold uppercase transition-colors ${activeTab === 'grid' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Grid size={14} /> Grid
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
        
        {activeTab === 'linear' && (
          <div className="space-y-4">
             <InputRow label="Count" value={config.linearCount} onChange={(v: number) => updateConfig({ linearCount: v })} min={2} max={50} step={1} />
             <VectorRow label="Offset (Distance)" values={config.linearOffset} onChange={(v: any) => updateConfig({ linearOffset: v })} />
             <VectorRow label="Rotation Increment" values={config.linearRotation} onChange={(v: any) => updateConfig({ linearRotation: v })} min={-180} max={180} step={5} />
             <VectorRow label="Scale Increment" values={config.linearScale} onChange={(v: any) => updateConfig({ linearScale: v })} min={0.1} max={2} step={0.1} />
          </div>
        )}

        {activeTab === 'radial' && (
          <div className="space-y-4">
             <InputRow label="Count" value={config.radialCount} onChange={(v: number) => updateConfig({ radialCount: v })} min={2} max={50} step={1} />
             <InputRow label="Radius" value={config.radialRadius} onChange={(v: number) => updateConfig({ radialRadius: v })} min={1} max={50} step={0.5} />
             <InputRow label="Arc Angle" value={config.radialArc} onChange={(v: number) => updateConfig({ radialArc: v })} min={10} max={360} step={10} suffix="°" />
             <InputRow label="Start Angle" value={config.radialStartAngle} onChange={(v: number) => updateConfig({ radialStartAngle: v })} min={0} max={360} step={15} suffix="°" />
             <InputRow label="Spiral Height" value={config.radialHeightOffset} onChange={(v: number) => updateConfig({ radialHeightOffset: v })} min={-10} max={10} step={0.5} />
             
             <button 
                onClick={() => updateConfig({ radialFaceCenter: !config.radialFaceCenter })}
                className={`w-full py-2 flex items-center justify-center gap-2 border rounded-lg text-[10px] font-bold uppercase ${config.radialFaceCenter ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-[#222] border-[#333] text-gray-500'}`}
             >
                {config.radialFaceCenter ? <CheckSquare size={14} /> : <Box size={14} />} Face Center
             </button>
          </div>
        )}

        {activeTab === 'grid' && (
          <div className="space-y-4">
             <div className="grid grid-cols-3 gap-2">
                <InputRow label="Rows (X)" value={config.gridRows} onChange={(v: number) => updateConfig({ gridRows: v })} min={1} max={20} step={1} />
                <InputRow label="Cols (Z)" value={config.gridCols} onChange={(v: number) => updateConfig({ gridCols: v })} min={1} max={20} step={1} />
                <InputRow label="Layers (Y)" value={config.gridLayers} onChange={(v: number) => updateConfig({ gridLayers: v })} min={1} max={10} step={1} />
             </div>
             <VectorRow label="Spacing" values={config.gridSpacing} onChange={(v: any) => updateConfig({ gridSpacing: v })} min={0.1} max={20} step={0.5} />
          </div>
        )}

        {/* Randomization */}
        <div className="border-t border-[#333] pt-4">
          <button 
             onClick={() => setShowRandom(!showRandom)}
             className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase hover:text-white"
          >
             <Shuffle size={12} /> {showRandom ? 'Hide' : 'Show'} Randomization
          </button>
          
          {showRandom && (
            <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
               <VectorRow label="Random Position (±)" values={config.randomPos} onChange={(v: any) => updateConfig({ randomPos: v })} min={0} max={5} />
               <VectorRow label="Random Rotation (±)" values={config.randomRot} onChange={(v: any) => updateConfig({ randomRot: v })} min={0} max={180} />
               <VectorRow label="Random Scale (±)" values={config.randomScale} onChange={(v: any) => updateConfig({ randomScale: v })} min={0} max={1} step={0.05} />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-[#151515] border-t border-[#333] rounded-b-xl flex gap-2">
         <button onClick={() => onApply(false)} className="flex-1 py-2 bg-[#222] hover:bg-[#333] text-white text-[10px] font-bold uppercase rounded-lg transition-colors">Apply</button>
         <button onClick={() => onApply(true)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase rounded-lg transition-colors">Apply as Group</button>
      </div>
    </div>
  );
};

export default ArrayToolDialog;
