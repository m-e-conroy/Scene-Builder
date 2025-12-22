
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Cloud, Package, Trash2, Search, Loader2, AlertCircle, Edit2, 
  Check, X, Info, Palette, Image as ImageIcon, SlidersHorizontal, 
  Globe, Magnet, Sparkles, Wand2, Box as BoxIcon, Circle, Cylinder as CylinderIcon, 
  Square, Cone as ConeIcon, Layers as LayersIcon
} from 'lucide-react';
import { SceneObject, CloudAsset, BackgroundSettings, PrimitiveType } from '../types';
import { GoogleGenAI } from "@google/genai";
import { search3DModels } from '../services/geminiService';

interface AssetPanelProps {
  onAddLocal: (file: File) => void;
  onAddCloud: (asset: CloudAsset) => void;
  onAddPrimitive: (type: PrimitiveType) => void;
  onSetBackground: (file: File) => void;
  bgSettings: BackgroundSettings;
  setBgSettings: React.Dispatch<React.SetStateAction<BackgroundSettings>>;
  snapSize: number;
  setSnapSize: (s: number) => void;
  objects: SceneObject[];
  onRemove: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<SceneObject>) => void;
}

const KHronos_BASE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0";

const MOCK_CLOUD_ASSETS: CloudAsset[] = [
  { uid: 'c1', name: 'Vintage Camera', thumbnail: `${KHronos_BASE}/AntiqueCamera/screenshot/screenshot.png`, downloadUrl: `${KHronos_BASE}/AntiqueCamera/glTF-Binary/AntiqueCamera.glb` },
  { uid: 'c2', name: 'Rubber Duck', thumbnail: `${KHronos_BASE}/Duck/screenshot/screenshot.png`, downloadUrl: `${KHronos_BASE}/Duck/glTF-Binary/Duck.glb` },
  { uid: 'c3', name: 'Damaged Helmet', thumbnail: `${KHronos_BASE}/DamagedHelmet/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/DamagedHelmet/glTF-Binary/DamagedHelmet.glb` },
  { uid: 'c4', name: 'Avocado', thumbnail: `${KHronos_BASE}/Avocado/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/Avocado/glTF-Binary/Avocado.glb` },
  { uid: 'c5', name: 'Boom Box', thumbnail: `${KHronos_BASE}/BoomBox/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/BoomBox/glTF-Binary/BoomBox.glb` },
  { uid: 'c6', name: 'Corset', thumbnail: `${KHronos_BASE}/Corset/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/Corset/glTF-Binary/Corset.glb` },
  { uid: 'c10', name: 'Buggy Car', thumbnail: `${KHronos_BASE}/Buggy/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/Buggy/glTF-Binary/Buggy.glb` },
  { uid: 'c16', name: 'Mosquito in Amber', thumbnail: `${KHronos_BASE}/MosquitoInAmber/screenshot/screenshot.png`, downloadUrl: `${KHronos_BASE}/MosquitoInAmber/glTF-Binary/MosquitoInAmber.glb` }
];

const PRIMITIVES: { type: PrimitiveType, icon: React.ReactNode, name: string }[] = [
  { type: 'box', icon: <BoxIcon size={16} />, name: 'Box' },
  { type: 'sphere', icon: <Circle size={16} />, name: 'Sphere' },
  { type: 'cylinder', icon: <CylinderIcon size={16} />, name: 'Cylinder' },
  { type: 'plane', icon: <Square size={16} />, name: 'Plane' },
  { type: 'cone', icon: <ConeIcon size={16} />, name: 'Cone' },
  { type: 'torus', icon: <LayersIcon size={16} />, name: 'Torus' },
];

const AssetPanel: React.FC<AssetPanelProps> = ({ 
  onAddLocal, 
  onAddCloud,
  onAddPrimitive,
  onSetBackground,
  bgSettings,
  setBgSettings,
  snapSize,
  setSnapSize,
  objects, 
  onRemove, 
  selectedId, 
  onSelect,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'cloud' | 'shapes' | 'scene' | 'env'>('shapes');
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredCloud, setFilteredCloud] = useState<CloudAsset[]>(MOCK_CLOUD_ASSETS);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // AI Backdrop Generation
  const [genPrompt, setGenPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedResults, setGeneratedResults] = useState<string[]>([]);

  const selectedObject = objects.find(o => o.id === selectedId);

  // Filter local mock assets as you type
  useEffect(() => {
    if (activeTab !== 'cloud') return;
    if (search.trim() === '') {
      setFilteredCloud(MOCK_CLOUD_ASSETS);
      return;
    }
    const results = MOCK_CLOUD_ASSETS.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    setFilteredCloud(results);
  }, [search, activeTab]);

  const handleAISearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    try {
      const results = await search3DModels(search);
      setFilteredCloud(prev => [...results, ...prev.filter(p => !results.some(r => r.downloadUrl === p.downloadUrl))]);
      if (!searchHistory.includes(search)) {
        setSearchHistory(prev => [search, ...prev].slice(0, 5));
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImageError = (url: string) => {
    setBrokenImages(prev => new Set(prev).add(url));
  };

  const handleGenerateBackdrop = async () => {
    if (!genPrompt.trim()) return;
    setIsGenerating(true);
    setGenError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `A high-resolution, wide-angle cinematic background for a 3D scene. Subject: ${genPrompt}. Style: Professional 3D environment backdrop, panoramic, sharp focus, 8k resolution, volumetric lighting.` }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9"
          }
        }
      });

      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64 = `data:image/png;base64,${part.inlineData.data}`;
            setGeneratedResults(prev => [base64, ...prev].slice(0, 4));
            updateBg({ url: base64 });
            break;
          }
        }
      } else {
        throw new Error("No image was generated. Please try a different prompt.");
      }
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      setGenError(error.message || "Failed to generate image. Please check your connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (activeTab === 'cloud') handleAISearch();
      if (activeTab === 'env') handleGenerateBackdrop();
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedId) onUpdate(selectedId, { color: e.target.value });
  };

  const updateBg = (updates: Partial<BackgroundSettings>) => {
    setBgSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="w-80 h-full bg-[#111] border-r border-[#222] flex flex-col pointer-events-auto">
      <div className="p-4 border-b border-[#222]">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Workspace</h2>
        <div className="grid grid-cols-3 gap-1 bg-[#0a0a0a] rounded-lg p-1">
          <button onClick={() => setActiveTab('shapes')} className={`flex items-center justify-center gap-2 py-2 text-[9px] font-bold rounded-md transition-all ${activeTab === 'shapes' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <BoxIcon size={10} /> SHAPES
          </button>
          <button onClick={() => setActiveTab('cloud')} className={`flex items-center justify-center gap-2 py-2 text-[9px] font-bold rounded-md transition-all ${activeTab === 'cloud' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Cloud size={10} /> MODELS
          </button>
          <button onClick={() => setActiveTab('env')} className={`flex items-center justify-center gap-2 py-2 text-[9px] font-bold rounded-md transition-all ${activeTab === 'env' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Globe size={10} /> ENV
          </button>
          <button onClick={() => setActiveTab('local')} className={`flex items-center justify-center gap-2 py-2 text-[9px] font-bold rounded-md transition-all ${activeTab === 'local' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Package size={10} /> LOCAL
          </button>
          <button onClick={() => setActiveTab('scene')} className={`flex items-center justify-center gap-2 py-2 text-[9px] font-bold rounded-md transition-all ${activeTab === 'scene' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Trash2 size={10} /> SCENE
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {activeTab === 'shapes' && (
          <div className="space-y-4">
            <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Geometric Primitives</label>
            <div className="grid grid-cols-3 gap-2">
              {PRIMITIVES.map((p) => (
                <button 
                  key={p.type} 
                  onClick={() => onAddPrimitive(p.type)}
                  className="flex flex-col items-center justify-center gap-2 aspect-square bg-[#0a0a0a] border border-[#222] rounded-md hover:border-blue-500 hover:bg-blue-600/5 transition-all group"
                >
                  <div className="text-gray-500 group-hover:text-blue-400 transition-colors">
                    {p.icon}
                  </div>
                  <span className="text-[9px] font-black uppercase text-gray-600 group-hover:text-white transition-colors">{p.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <p className="text-[9px] text-gray-400 leading-relaxed">
                Use shapes to "block out" your scene before rendering. The Neural Engine will interpret these volumes based on your prompt.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="space-y-4">
            <div className="space-y-2">
               <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center justify-between">
                Neural Model Search
                <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30">Search Grounding</span>
              </label>
              <div className="relative">
                {isSearching ? <Loader2 className="absolute left-3 top-2.5 text-blue-500 animate-spin" size={14} /> : <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />}
                <input 
                  type="text" 
                  placeholder="Search for .glb models (e.g. 'Cyberpunk Car')" 
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-md pl-9 pr-12 py-2 text-xs text-white focus:outline-none focus:border-blue-500" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  onKeyDown={handleKeyPress}
                />
                <button 
                  onClick={handleAISearch}
                  disabled={isSearching || !search.trim()}
                  className="absolute right-1.5 top-1.5 p-1 text-blue-500 hover:text-blue-400 disabled:opacity-50"
                >
                  <Wand2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {filteredCloud.map((asset) => (
                <button key={asset.uid} onClick={() => onAddCloud(asset)} className="group relative aspect-square bg-[#0a0a0a] border border-[#222] rounded-md overflow-hidden hover:border-blue-500 transition-all shadow-md">
                  <img 
                    src={brokenImages.has(asset.thumbnail) ? `https://placehold.co/400x400/111/444?text=${encodeURIComponent(asset.name)}` : asset.thumbnail} 
                    alt={asset.name} 
                    onError={() => handleImageError(asset.thumbnail)}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/80 backdrop-blur-sm border-t border-white/5">
                    <p className="text-[10px] text-white truncate text-center font-medium">{asset.name}</p>
                  </div>
                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <span className="text-[8px] font-black text-white bg-blue-600 px-2 py-1 rounded uppercase">Add to Scene</span>
                  </div>
                </button>
              ))}
            </div>
            {filteredCloud.length === 0 && !isSearching && (
              <div className="py-12 text-center">
                <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">No models found</p>
                <p className="text-[9px] text-gray-800 mt-1">Try a different search term or use the AI Search button.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'local' && (
          <div className="space-y-4 text-center">
            <div className="border-2 border-dashed border-[#222] rounded-lg p-6">
              <Upload className="text-gray-600 mx-auto mb-2" size={24} />
              <label className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-4 py-2 rounded-full cursor-pointer inline-block uppercase">
                Add .GLB Model
                <input type="file" className="hidden" accept=".glb" onChange={(e) => e.target.files?.[0] && onAddLocal(e.target.files[0])} />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'env' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest">Grid Snapping</label>
              <div className="bg-[#0a0a0a] p-4 rounded-xl border border-[#222] space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Magnet size={14} className="text-yellow-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter">Snap Settings</span>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold mb-1">
                    <span>Increment</span>
                    <span className="text-blue-400">{snapSize.toFixed(2)} units</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.01" 
                    max="5" 
                    step="0.01" 
                    value={snapSize} 
                    onChange={(e) => setSnapSize(parseFloat(e.target.value))} 
                    className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center justify-between">
                AI Backdrop Generator
                <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">Gemini 2.5</span>
              </label>
              
              <div className="relative">
                {isGenerating ? <Loader2 className="absolute left-3 top-2.5 text-blue-500 animate-spin" size={14} /> : <Sparkles className="absolute left-3 top-2.5 text-blue-400" size={14} />}
                <input 
                  type="text" 
                  placeholder="e.g. 'Cyberpunk Tokyo street at night'" 
                  className={`w-full bg-[#0a0a0a] border rounded-md pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 ${genError ? 'border-red-500/50' : 'border-[#222]'}`}
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
              </div>

              {genError && (
                <div className="flex items-center gap-2 text-red-400 text-[9px] font-medium bg-red-500/10 p-2 rounded border border-red-500/20">
                  <AlertCircle size={10} /> {genError}
                </div>
              )}

              <button 
                onClick={handleGenerateBackdrop}
                disabled={isGenerating || !genPrompt.trim()}
                className={`w-full py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${isGenerating || !genPrompt.trim() ? 'bg-[#222] text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
              >
                {isGenerating ? 'Generating Backdrop...' : 'Generate with AI'}
              </button>

              {generatedResults.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {generatedResults.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => updateBg({ url: img })}
                      className="group relative aspect-video bg-[#0a0a0a] border border-[#222] rounded-md overflow-hidden hover:border-blue-500 transition-all shadow-lg"
                    >
                      <img 
                        src={img} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                      />
                      <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white bg-black/60 px-2 py-1 rounded uppercase">Apply</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest">Active Backdrop</label>
              <div className={`aspect-video rounded-lg border-2 border-dashed ${bgSettings.url ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#222] bg-[#0a0a0a]'} flex flex-col items-center justify-center p-4 relative overflow-hidden group`}>
                {bgSettings.url ? (
                  <>
                    <img src={bgSettings.url} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                    <button onClick={() => updateBg({ url: null })} className="absolute top-2 right-2 p-1 bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"><X size={12} /></button>
                    <ImageIcon size={24} className="text-blue-500 relative z-10" />
                  </>
                ) : (
                  <ImageIcon size={24} className="text-gray-700 mb-2" />
                )}
                <label className="mt-2 text-[10px] font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-md cursor-pointer relative z-10 uppercase transition-colors">
                  {bgSettings.url ? 'Replace Image' : 'Upload Manually'}
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onSetBackground(e.target.files[0])} />
                </label>
              </div>
            </div>

            {bgSettings.url && (
              <div className="space-y-5 bg-[#0a0a0a] p-4 rounded-xl border border-[#222]">
                <div className="flex items-center gap-2 mb-2">
                  <SlidersHorizontal size={14} className="text-blue-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter">Backdrop Transforms</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold mb-1"><span>X-Offset</span><span>{bgSettings.position[0].toFixed(1)}</span></div>
                    <input type="range" min="-10" max="10" step="0.1" value={bgSettings.position[0]} onChange={(e) => updateBg({ position: [parseFloat(e.target.value), bgSettings.position[1], bgSettings.position[2]] })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold mb-1"><span>Y-Offset</span><span>{bgSettings.position[1].toFixed(1)}</span></div>
                    <input type="range" min="-10" max="10" step="0.1" value={bgSettings.position[1]} onChange={(e) => updateBg({ position: [bgSettings.position[0], parseFloat(e.target.value), bgSettings.position[2]] })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold mb-1"><span>Distance (Z)</span><span>{bgSettings.position[2].toFixed(1)}</span></div>
                    <input type="range" min="-50" max="-1" step="0.1" value={bgSettings.position[2]} onChange={(e) => updateBg({ position: [bgSettings.position[0], bgSettings.position[1], parseFloat(e.target.value)] })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold mb-1"><span>Scale</span><span>{bgSettings.scale.toFixed(1)}x</span></div>
                    <input type="range" min="1" max="50" step="0.5" value={bgSettings.scale} onChange={(e) => updateBg({ scale: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scene' && (
          <div className="space-y-4">
            {selectedObject && (
              <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4 shadow-2xl">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Palette size={12} /> Shader Override</h3>
                <div className="flex items-center gap-3">
                  <input type="color" value={selectedObject.color || "#ffffff"} onChange={handleColorChange} className="w-8 h-8 bg-transparent border-none rounded cursor-pointer" />
                  <input type="text" value={selectedObject.color || "#ffffff"} onChange={handleColorChange} className="flex-1 bg-black/40 border border-[#333] rounded px-2 py-1.5 text-[10px] text-gray-300 font-mono focus:outline-none focus:border-blue-500 uppercase" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-1">Hierarchy</h3>
              {objects.length === 0 ? (
                <p className="text-[9px] text-gray-700 text-center py-8 uppercase font-bold">Scene Empty</p>
              ) : (
                objects.map((obj) => (
                  <div key={obj.id} onClick={() => onSelect(obj.id)} className={`flex items-center justify-between p-2 rounded-md border cursor-pointer group ${selectedId === obj.id ? 'bg-[#1a1a1a] border-blue-500/50' : 'bg-[#0a0a0a] border-[#222]'}`}>
                    <span className="text-[11px] text-gray-400 truncate flex-1 px-1">{obj.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }} className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetPanel;
