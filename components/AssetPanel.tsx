
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Cloud, Package, Trash2, Search, Loader2, AlertCircle, Edit2, 
  Check, X, Info, Palette, Image as ImageIcon, SlidersHorizontal, 
  Globe, Magnet, Sparkles, Wand2, Box as BoxIcon, Circle, Cylinder as CylinderIcon, 
  Square, Cone as ConeIcon, Layers as LayersIcon, FolderPlus, Folder, ChevronDown, ChevronRight,
  MoveHorizontal, MoveVertical, Maximize, Ghost, Camera, CameraOff, Save, Navigation
} from 'lucide-react';
import { SceneObject, SceneGroup, CloudAsset, BackgroundSettings, PrimitiveType, CameraPreset } from '../types';
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
  groups: SceneGroup[];
  onRemove: (id: string) => void;
  onRemoveGroup: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<SceneObject>) => void;
  onUpdateGroup: (id: string, updates: Partial<SceneGroup>) => void;
  onAddGroup: () => void;
  cameraPresets: CameraPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: CameraPreset) => void;
  onDeletePreset: (id: string) => void;
}

const KHronos_BASE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0";

const MOCK_CLOUD_ASSETS: CloudAsset[] = [
  { uid: 'c1', name: 'Vintage Camera', thumbnail: `${KHronos_BASE}/AntiqueCamera/screenshot/screenshot.png`, downloadUrl: `${KHronos_BASE}/AntiqueCamera/glTF-Binary/AntiqueCamera.glb` },
  { uid: 'c2', name: 'Rubber Duck', thumbnail: `${KHronos_BASE}/Duck/screenshot/screenshot.png`, downloadUrl: `${KHronos_BASE}/Duck/glTF-Binary/Duck.glb` },
  { uid: 'c3', name: 'Damaged Helmet', thumbnail: `${KHronos_BASE}/DamagedHelmet/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/DamagedHelmet/glTF-Binary/DamagedHelmet.glb` },
  { uid: 'c4', name: 'Avocado', thumbnail: `${KHronos_BASE}/Avocado/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/Avocado/glTF-Binary/Avocado.glb` },
  { uid: 'c5', name: 'Boom Box', thumbnail: `${KHronos_BASE}/BoomBox/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/BoomBox/glTF-Binary/BoomBox.glb` },
  { uid: 'c10', name: 'Buggy Car', thumbnail: `${KHronos_BASE}/Buggy/screenshot/screenshot.jpg`, downloadUrl: `${KHronos_BASE}/Buggy/glTF-Binary/Buggy.glb` },
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
  onAddLocal, onAddCloud, onAddPrimitive, onSetBackground, bgSettings, setBgSettings,
  snapSize, setSnapSize, objects, groups, onRemove, onRemoveGroup, selectedId, 
  onSelect, onUpdate, onUpdateGroup, onAddGroup,
  cameraPresets, onSavePreset, onLoadPreset, onDeletePreset
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'cloud' | 'shapes' | 'scene' | 'cam' | 'env'>('shapes');
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredCloud, setFilteredCloud] = useState<CloudAsset[]>(MOCK_CLOUD_ASSETS);
  const [newPresetName, setNewPresetName] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  useEffect(() => {
    if (activeTab !== 'cloud') return;
    setFilteredCloud(MOCK_CLOUD_ASSETS.filter(a => a.name.toLowerCase().includes(search.toLowerCase())));
  }, [search, activeTab]);

  const handleAISearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    try {
      const results = await search3DModels(search);
      setFilteredCloud(prev => [...results, ...prev]);
    } catch (err) { console.error(err); }
    finally { setIsSearching(false); }
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditNameValue(currentName);
  };

  const commitEditing = (type: 'obj' | 'grp') => {
    if (!editingId) return;
    if (type === 'obj') onUpdate(editingId, { name: editNameValue });
    else onUpdateGroup(editingId, { name: editNameValue });
    setEditingId(null);
  };

  const updateBg = (updates: Partial<BackgroundSettings>) => {
    setBgSettings(prev => ({ ...prev, ...updates }));
  };

  const clearBg = () => {
    setBgSettings(prev => ({ ...prev, url: null }));
  };

  const renderSceneItem = (obj: SceneObject, depth = 0) => (
    <div 
      key={obj.id} 
      onClick={() => onSelect(obj.id)} 
      className={`flex items-center justify-between p-2 rounded-md border cursor-pointer group transition-colors ${selectedId === obj.id ? 'bg-[#1a1a1a] border-blue-500/50' : 'bg-[#0a0a0a] border-[#222]'}`}
      style={{ marginLeft: `${depth * 16}px` }}
    >
      {editingId === obj.id ? (
        <input 
          autoFocus
          className="text-[11px] bg-black text-white border border-blue-500 rounded px-1 flex-1 min-w-0 mr-2 outline-none"
          value={editNameValue}
          onChange={(e) => setEditNameValue(e.target.value)}
          onBlur={() => commitEditing('obj')}
          onKeyDown={(e) => e.key === 'Enter' && commitEditing('obj')}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-[11px] text-gray-400 truncate flex-1 px-1">{obj.name}</span>
      )}
      
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); startEditing(obj.id, obj.name); }} className="p-1 text-gray-600 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }} className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
      </div>
    </div>
  );

  return (
    <div className="w-80 h-full bg-[#111] border-r border-[#222] flex flex-col pointer-events-auto">
      <div className="p-4 border-b border-[#222]">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Workspace</h2>
        <div className="grid grid-cols-6 gap-1 bg-[#0a0a0a] rounded-lg p-1 text-center">
          {['shapes', 'cloud', 'env', 'local', 'cam', 'scene'].map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab as any)} 
              className={`py-2 text-[8px] font-bold rounded-md transition-all uppercase ${activeTab === tab ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {tab.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {activeTab === 'shapes' && (
          <div className="space-y-4">
            <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Geometric Primitives</label>
            <div className="grid grid-cols-3 gap-2">
              {PRIMITIVES.map((p) => (
                <button key={p.type} onClick={() => onAddPrimitive(p.type)} className="flex flex-col items-center justify-center gap-2 aspect-square bg-[#0a0a0a] border border-[#222] rounded-md hover:border-blue-500 hover:bg-blue-600/5 transition-all group">
                  <div className="text-gray-500 group-hover:text-blue-400">{p.icon}</div>
                  <span className="text-[9px] font-black uppercase text-gray-600 group-hover:text-white">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="space-y-4">
            <div className="relative">
              {isSearching ? <Loader2 className="absolute left-3 top-2.5 text-blue-500 animate-spin" size={14} /> : <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />}
              <input type="text" placeholder="Search .glb models..." className="w-full bg-[#0a0a0a] border border-[#222] rounded-md pl-9 pr-10 py-2 text-xs text-white focus:outline-none focus:border-blue-500" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAISearch()} />
              <button onClick={handleAISearch} className="absolute right-2 top-2 text-blue-500 hover:text-blue-400"><Wand2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {filteredCloud.map((asset) => (
                <button key={asset.uid} onClick={() => onAddCloud(asset)} className="group relative aspect-square bg-[#0a0a0a] border border-[#222] rounded-md overflow-hidden hover:border-blue-500 transition-all">
                  <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/80"><p className="text-[9px] text-white truncate text-center">{asset.name}</p></div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cam' && (
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Save Current Perspective</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="View Name..." 
                  className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPresetName.trim()) {
                      onSavePreset(newPresetName);
                      setNewPresetName('');
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (newPresetName.trim()) {
                      onSavePreset(newPresetName);
                      setNewPresetName('');
                    }
                  }}
                  className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
                >
                  <Save size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest">Navigation Presets</label>
              <div className="grid grid-cols-1 gap-2">
                {cameraPresets.map((preset) => (
                  <div key={preset.id} className="group relative flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#222] rounded-lg hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => onLoadPreset(preset)}>
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md ${preset.isSystem ? 'bg-blue-600/20 text-blue-400' : 'bg-green-600/20 text-green-400'}`}>
                        {preset.isSystem ? <Globe size={14} /> : <Camera size={14} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-tight">{preset.name}</p>
                        <p className="text-[8px] text-gray-600 font-mono">[{preset.position[0].toFixed(0)}, {preset.position[1].toFixed(0)}, {preset.position[2].toFixed(0)}]</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Navigation size={12} className="text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {!preset.isSystem && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeletePreset(preset.id); }}
                          className="p-1 text-gray-700 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'env' && (
          <div className="space-y-6 pb-20">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Grid & Snapping</label>
              <div className="bg-[#0a0a0a] p-4 rounded-xl border border-[#222]">
                <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold mb-2"><span>Increment</span><span className="text-blue-400">{snapSize}u</span></div>
                <input type="range" min="0.1" max="5" step="0.1" value={snapSize} onChange={(e) => setSnapSize(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Active Backdrop</label>
              <div className={`aspect-video rounded-lg border-2 border-dashed ${bgSettings.url ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#222] bg-[#0a0a0a]'} flex flex-col items-center justify-center p-4 relative group overflow-hidden`}>
                {bgSettings.url ? (
                  <>
                    <img src={bgSettings.url} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                    <button onClick={clearBg} className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-md text-white hover:bg-red-500 z-20"><Trash2 size={12} /></button>
                  </>
                ) : <ImageIcon size={24} className="text-gray-700 mb-2" />}
                <label className="bg-white/5 hover:bg-white/10 text-white text-[9px] font-bold px-3 py-1.5 rounded-md cursor-pointer relative z-10">UPLOAD MANUALLY<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onSetBackground(e.target.files[0])} /></label>
              </div>

              {bgSettings.url && (
                <div className="mt-4 space-y-4 bg-[#0a0a0a] p-4 rounded-xl border border-[#222]">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] text-gray-500 uppercase font-black">
                        <span className="flex items-center gap-1"><MoveHorizontal size={10} /> Position X</span>
                        <span className="text-blue-400">{bgSettings.position[0].toFixed(1)}</span>
                      </div>
                      <input type="range" min="-20" max="20" step="0.1" value={bgSettings.position[0]} onChange={(e) => updateBg({ position: [parseFloat(e.target.value), bgSettings.position[1], bgSettings.position[2]] })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] text-gray-500 uppercase font-black">
                        <span className="flex items-center gap-1"><MoveVertical size={10} /> Position Y</span>
                        <span className="text-blue-400">{bgSettings.position[1].toFixed(1)}</span>
                      </div>
                      <input type="range" min="-20" max="20" step="0.1" value={bgSettings.position[1]} onChange={(e) => updateBg({ position: [bgSettings.position[0], parseFloat(e.target.value), bgSettings.position[2]] })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] text-gray-500 uppercase font-black">
                        <span className="flex items-center gap-1"><Maximize size={10} /> Scale</span>
                        <span className="text-blue-400">{bgSettings.scale.toFixed(1)}x</span>
                      </div>
                      <input type="range" min="1" max="50" step="0.5" value={bgSettings.scale} onChange={(e) => updateBg({ scale: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] text-gray-500 uppercase font-black">
                        <span className="flex items-center gap-1"><Ghost size={10} /> Opacity</span>
                        <span className="text-blue-400">{(bgSettings.opacity * 100).toFixed(0)}%</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={bgSettings.opacity} onChange={(e) => updateBg({ opacity: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'local' && (
          <div className="space-y-4 text-center">
            <div className="border-2 border-dashed border-[#222] rounded-lg p-6">
              <Upload className="text-gray-600 mx-auto mb-2" size={24} />
              <label className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-4 py-2 rounded-full cursor-pointer inline-block uppercase">Add .GLB Model<input type="file" className="hidden" accept=".glb" onChange={(e) => e.target.files?.[0] && onAddLocal(e.target.files[0])} /></label>
            </div>
          </div>
        )}

        {activeTab === 'scene' && (
          <div className="space-y-4 pb-20">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Hierarchy</h3>
              <button onClick={onAddGroup} className="flex items-center gap-1 text-[8px] font-black text-blue-500 hover:text-blue-400 uppercase"><FolderPlus size={10} /> Add Group</button>
            </div>

            <div className="space-y-2">
              {/* Render Groups */}
              {groups.map(group => (
                <div key={group.id} className="space-y-1">
                  <div 
                    onClick={() => onSelect(group.id)}
                    className={`flex items-center justify-between p-2 rounded-md border cursor-pointer group transition-colors ${selectedId === group.id ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.1)]' : 'bg-[#0a0a0a] border-[#222]'}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={(e) => { e.stopPropagation(); onUpdateGroup(group.id, { isOpen: !group.isOpen }); }} className="text-gray-600">
                        {group.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <Folder size={12} className={selectedId === group.id ? "text-blue-400 shrink-0" : "text-gray-600 shrink-0"} />
                      {editingId === group.id ? (
                        <input 
                          autoFocus
                          className="text-[11px] bg-black text-white border border-blue-500 rounded px-1 flex-1 min-w-0 outline-none"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onBlur={() => commitEditing('grp')}
                          onKeyDown={(e) => e.key === 'Enter' && commitEditing('grp')}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`text-[11px] truncate font-bold uppercase tracking-tight ${selectedId === group.id ? 'text-blue-300' : 'text-gray-300'}`}>{group.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); startEditing(group.id, group.name); }} className="p-1 text-gray-600 hover:text-blue-500 opacity-0 group-hover:opacity-100"><Edit2 size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onRemoveGroup(group.id); }} className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {group.isOpen && (
                    <div className="border-l border-[#222] ml-4 space-y-1 py-1">
                      {objects.filter(o => o.groupId === group.id).map(obj => renderSceneItem(obj, 0))}
                      {objects.filter(o => o.groupId === group.id).length === 0 && (
                        <p className="text-[8px] text-gray-800 text-center py-2 uppercase font-black">Empty Group</p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Render Ungrouped Objects */}
              <div className="space-y-1 pt-2">
                <h4 className="text-[8px] text-gray-700 font-black uppercase tracking-widest px-1">Ungrouped</h4>
                {objects.filter(o => !o.groupId).map(obj => (
                  <div key={obj.id} className="relative group">
                    {renderSceneItem(obj)}
                    {/* Add to Group quick selection */}
                    {groups.length > 0 && selectedId === obj.id && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#151515] border border-[#333] rounded-md p-1 shadow-2xl flex flex-wrap gap-1">
                        <span className="text-[8px] text-gray-500 w-full px-1 uppercase font-black">Move to:</span>
                        {groups.map(g => (
                          <button key={g.id} onClick={() => onUpdate(obj.id, { groupId: g.id })} className="text-[8px] bg-blue-600/10 hover:bg-blue-600/30 text-blue-500 px-2 py-1 rounded border border-blue-500/20">{g.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {objects.length === 0 && groups.length === 0 && (
                <p className="text-[9px] text-gray-700 text-center py-8 uppercase font-bold">Scene Empty</p>
              )}
            </div>
            
            {/* Object Selection specific property override */}
            {selectedId && objects.find(o => o.id === selectedId) && (
              <div className="pt-4 border-t border-[#222]">
                <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Palette size={12} /> Shader Override</h3>
                <div className="flex items-center gap-3">
                  <input type="color" value={objects.find(o => o.id === selectedId)?.color || "#ffffff"} onChange={(e) => onUpdate(selectedId, { color: e.target.value })} className="w-8 h-8 bg-transparent border-none rounded cursor-pointer" />
                  <input type="text" value={objects.find(o => o.id === selectedId)?.color || "#ffffff"} onChange={(e) => onUpdate(selectedId, { color: e.target.value })} className="flex-1 bg-black/40 border border-[#333] rounded px-2 py-1.5 text-[10px] text-gray-300 font-mono focus:outline-none focus:border-blue-500 uppercase" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetPanel;
