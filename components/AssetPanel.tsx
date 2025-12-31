import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Cloud, Package, Trash2, Search, Loader2, AlertCircle, Edit2, 
  Check, X, Info, Palette, Image as ImageIcon, SlidersHorizontal, 
  Globe, Magnet, Sparkles, Wand2, Box as BoxIcon, Circle, Cylinder as CylinderIcon, 
  Square, Cone as ConeIcon, Layers as LayersIcon, FolderPlus, Folder, ChevronDown, ChevronRight,
  MoveHorizontal, MoveVertical, Maximize, Ghost, Camera, CameraOff, Save, Navigation, Link as LinkIcon,
  MousePointer2, HardDrive, Move, RotateCw, BoxSelect, Triangle, GripVertical, FolderOpen,
  TriangleRight, Slice // Imported generic icons for new shapes
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

const KHronos_BASE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0";

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
  { type: 'pyramid', icon: <Triangle size={16} />, name: 'Pyramid' },
  { type: 'wedge', icon: <TriangleRight size={16} />, name: 'Wedge' },
  { type: 'oblique-wedge', icon: <Slice size={16} />, name: 'Oblique Wedge' },
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

  // Drag and Drop State
  const [draggedObjId, setDraggedObjId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null); // 'root' for ungrouped, or groupId

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

  const handleRefImageUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onUpdate(id, { referenceImageUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const updateBg = (updates: Partial<BackgroundSettings>) => {
    setBgSettings(prev => ({ ...prev, ...updates }));
  };

  const clearBg = () => {
    setBgSettings(prev => ({ ...prev, url: null }));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    setDraggedObjId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const renderSceneItem = (obj: SceneObject, depth = 0) => (
    <div 
      key={obj.id} 
      draggable
      onDragStart={(e) => handleDragStart(e, obj.id)}
      onClick={() => onSelect(obj.id)} 
      className={`flex items-center justify-between p-2 rounded-md border cursor-pointer group transition-colors select-none ${selectedId === obj.id ? 'bg-[#1a1a1a] border-blue-500/50' : 'bg-[#0a0a0a] border-[#222]'} ${draggedObjId === obj.id ? 'opacity-40 border-dashed border-blue-500' : ''}`}
      style={{ marginLeft: `${depth * 16}px` }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GripVertical size={10} className="text-gray-700 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
          <>
            <span className="text-[11px] text-gray-400 truncate flex-1 px-1">{obj.name}</span>
            {obj.referenceImageUrl && <LinkIcon size={10} className="text-blue-500 animate-pulse" />}
          </>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); startEditing(obj.id, obj.name); }} className="p-1 text-gray-600 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }} className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
      </div>
    </div>
  );

  const selectedObject = objects.find(o => o.id === selectedId);
  const selectedGroup = groups.find(g => g.id === selectedId);
  
  const localObjects = objects.filter(o => o.type === 'local');

  const TransformInputRow = ({ label, icon, values, onChange, isRotation = false }: { label: string, icon: React.ReactNode, values: [number, number, number], onChange: (newVal: [number, number, number]) => void, isRotation?: boolean }) => {
    const axes = ['X', 'Y', 'Z'];
    const colors = ['bg-red-500', 'bg-green-500', 'bg-blue-500'];

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[9px] text-gray-500 font-bold uppercase tracking-widest">
          {icon} {label}
        </div>
        <div className="flex gap-1">
          {axes.map((axis, i) => {
            let displayValue = values[i];
            if (isRotation) displayValue = displayValue * (180 / Math.PI);

            return (
              <div key={axis} className="flex items-center bg-[#111] border border-[#222] rounded overflow-hidden flex-1 min-w-0 focus-within:border-blue-500/50 transition-colors">
                 <div className={`w-0.5 h-full ${colors[i]}`}></div>
                 <div className="px-1.5 text-[8px] text-gray-600 font-mono font-bold select-none cursor-ew-resize">{axis}</div>
                 <input 
                    type="number" 
                    step={isRotation ? 1 : 0.01}
                    value={parseFloat(displayValue.toFixed(3))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) return;
                      const newValues = [...values] as [number, number, number];
                      newValues[i] = isRotation ? val * (Math.PI / 180) : val;
                      onChange(newValues);
                    }}
                    className="w-full bg-transparent text-[10px] text-gray-300 font-mono py-1 pr-1 outline-none text-right appearance-none"
                 />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
                  <span className="text-[9px] font-black uppercase text-gray-600 group-hover:text-white text-center px-1">{p.name}</span>
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
                  <img 
                    src={asset.thumbnail} 
                    alt={asset.name} 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://placehold.co/400x400/151515/FFFFFF?text=${encodeURIComponent(asset.name.substring(0, 15))}`;
                    }}
                  />
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'local' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Import Local Geometry</label>
              <div className="border-2 border-dashed border-[#222] rounded-lg p-6 text-center hover:border-blue-500/50 transition-colors">
                <Upload className="text-gray-600 mx-auto mb-2" size={24} />
                <label className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-4 py-2 rounded-full cursor-pointer inline-block uppercase shadow-lg shadow-blue-900/20">
                  Select 3D File (.glb, .gltf, .obj)
                  <input type="file" className="hidden" accept=".glb,.gltf,.obj" onChange={(e) => e.target.files?.[0] && onAddLocal(e.target.files[0])} />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest">Project Library</label>
                <span className="text-[9px] text-blue-400 font-bold">{localObjects.length} ASSETS</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {localObjects.map((obj) => (
                  <div 
                    key={obj.id} 
                    onClick={() => onSelect(obj.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${selectedId === obj.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-[#0a0a0a] border-[#222] hover:border-white/10'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-[#151515] p-2 rounded-md border border-white/5">
                        <Package size={14} className={selectedId === obj.id ? "text-blue-400" : "text-gray-600"} />
                      </div>
                      <div className="truncate">
                        <p className="text-[10px] font-bold text-gray-300 uppercase truncate">{obj.name}</p>
                        <p className="text-[8px] text-gray-600 font-black uppercase flex items-center gap-1">
                          {obj.referenceImageUrl ? <LinkIcon size={8} className="text-blue-500" /> : <HardDrive size={8} />}
                          {obj.referenceImageUrl ? 'Ref Attached' : `${obj.format?.toUpperCase() || 'LOCAL'} Data`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <button onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }} className={`p-1.5 rounded ${selectedId === obj.id ? 'text-blue-400' : 'text-gray-700 hover:text-white'}`}>
                          <MousePointer2 size={12} />
                       </button>
                       <button onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }} className="p-1.5 text-gray-700 hover:text-red-500">
                          <Trash2 size={12} />
                       </button>
                    </div>
                  </div>
                ))}
                
                {localObjects.length === 0 && (
                  <div className="py-8 text-center bg-[#0a0a0a] border border-[#222] rounded-lg border-dashed">
                    <Package size={20} className="text-gray-800 mx-auto mb-2 opacity-20" />
                    <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest">No local models imported</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#222]">
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Project Backdrop</label>
              <div 
                onClick={() => setActiveTab('env')}
                className={`flex items-center gap-3 p-3 rounded-lg border border-[#222] cursor-pointer hover:bg-white/5 transition-all ${bgSettings.url ? 'border-blue-500/30 bg-blue-500/5' : ''}`}
              >
                <div className="w-10 h-10 bg-black rounded-md overflow-hidden flex items-center justify-center border border-white/5 shrink-0">
                  {bgSettings.url ? <img src={bgSettings.url} className="w-full h-full object-cover" /> : <ImageIcon size={14} className="text-gray-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-300 uppercase">Backdrop Context</p>
                  <p className="text-[8px] text-gray-600 font-black uppercase">{bgSettings.url ? 'IMAGE ACTIVE' : 'NO BACKDROP SET'}</p>
                </div>
                <ChevronRight size={14} className="text-gray-700" />
              </div>
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
              {groups.map(group => (
                <div 
                  key={group.id} 
                  className={`space-y-1 rounded-md transition-all ${dragOverGroupId === group.id ? 'bg-blue-600/20 ring-1 ring-blue-500' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroupId(group.id); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if(dragOverGroupId === group.id) setDragOverGroupId(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedObjId) {
                       onUpdate(draggedObjId, { groupId: group.id });
                       if (!group.isOpen) onUpdateGroup(group.id, { isOpen: true });
                    }
                    setDraggedObjId(null);
                    setDragOverGroupId(null);
                  }}
                >
                  <div onClick={() => onSelect(group.id)} className={`flex items-center justify-between p-2 rounded-md border cursor-pointer group transition-colors ${selectedId === group.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-[#0a0a0a] border-[#222]'}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={(e) => { e.stopPropagation(); onUpdateGroup(group.id, { isOpen: !group.isOpen }); }} className="text-gray-600">{group.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
                      {group.isOpen ? <FolderOpen size={12} className={selectedId === group.id ? "text-blue-400 shrink-0" : "text-gray-600 shrink-0"} /> : <Folder size={12} className={selectedId === group.id ? "text-blue-400 shrink-0" : "text-gray-600 shrink-0"} />}
                      {editingId === group.id ? (
                        <input autoFocus className="text-[11px] bg-black text-white border border-blue-500 rounded px-1 flex-1 min-w-0 outline-none" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={() => commitEditing('grp')} onKeyDown={(e) => e.key === 'Enter' && commitEditing('grp')} onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <span className={`text-[11px] truncate font-bold uppercase tracking-tight ${selectedId === group.id ? 'text-blue-300' : 'text-gray-300'}`}>{group.name}</span>
                      )}
                    </div>
                    {selectedId === group.id && editingId !== group.id && (
                       <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); startEditing(group.id, group.name); }} className="p-1 text-gray-600 hover:text-blue-500"><Edit2 size={12} /></button>
                          <button onClick={(e) => { e.stopPropagation(); onRemoveGroup(group.id); }} className="p-1 text-gray-600 hover:text-red-500"><Trash2 size={12} /></button>
                       </div>
                    )}
                  </div>
                  {group.isOpen && (
                    <div className="border-l border-[#222] ml-4 space-y-1 py-1">
                      {objects.filter(o => o.groupId === group.id).map(obj => renderSceneItem(obj, 0))}
                      {objects.filter(o => o.groupId === group.id).length === 0 && (
                          <div className="p-2 text-[8px] text-gray-700 italic border border-dashed border-[#222] rounded mx-2">Empty Group</div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div 
                className={`space-y-1 pt-2 rounded-md transition-all min-h-[50px] ${dragOverGroupId === 'root' ? 'bg-blue-600/20 ring-1 ring-blue-500' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroupId('root'); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if(dragOverGroupId === 'root') setDragOverGroupId(null); }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedObjId) {
                       onUpdate(draggedObjId, { groupId: undefined });
                    }
                    setDraggedObjId(null);
                    setDragOverGroupId(null);
                }}
              >
                <h4 className="text-[8px] text-gray-700 font-black uppercase tracking-widest px-1 pointer-events-none flex items-center gap-1"><LayersIcon size={10}/> Ungrouped Objects</h4>
                {objects.filter(o => !o.groupId).map(obj => renderSceneItem(obj))}
                {objects.filter(o => !o.groupId).length === 0 && (
                    <div className="text-[8px] text-gray-800 italic px-2 py-4 text-center border-2 border-dashed border-[#1a1a1a] rounded-lg">Drop items here to ungroup</div>
                )}
              </div>
            </div>
            
            {/* Contextual Properties for Selected Object OR Group */}
            {(selectedObject || selectedGroup) && (
              <div className="pt-6 border-t border-[#222] space-y-6">
                
                {selectedObject && (
                  <>
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <SlidersHorizontal size={12} /> Transform Inspector
                    </h3>
                    <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3 space-y-3">
                      <TransformInputRow 
                        label="Position" 
                        icon={<Move size={10} />} 
                        values={selectedObject.position} 
                        onChange={(newVal) => onUpdate(selectedObject.id, { position: newVal })}
                      />
                      <TransformInputRow 
                        label="Rotation" 
                        icon={<RotateCw size={10} />} 
                        values={selectedObject.rotation} 
                        isRotation
                        onChange={(newVal) => onUpdate(selectedObject.id, { rotation: newVal })}
                      />
                      <TransformInputRow 
                        label="Scale" 
                        icon={<BoxSelect size={10} />} 
                        values={selectedObject.scale} 
                        onChange={(newVal) => onUpdate(selectedObject.id, { scale: newVal })}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles size={12} /> Visual Reference</h3>
                    <div className={`aspect-video rounded-lg border-2 border-dashed ${selectedObject.referenceImageUrl ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#222] bg-black/40'} flex flex-col items-center justify-center p-3 relative group overflow-hidden transition-all`}>
                      {selectedObject.referenceImageUrl ? (
                        <>
                          <img src={selectedObject.referenceImageUrl} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <button onClick={() => onUpdate(selectedObject.id, { referenceImageUrl: undefined })} className="p-2 bg-red-600 rounded-full text-white"><Trash2 size={16} /></button>
                          </div>
                        </>
                      ) : (
                        <label className="flex flex-col items-center cursor-pointer">
                          <Upload size={18} className="text-gray-600 mb-2" />
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Upload Guide Image</span>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleRefImageUpload(selectedObject.id, e.target.files[0])} />
                        </label>
                      )}
                    </div>
                    <p className="mt-2 text-[8px] text-gray-600 leading-tight">Neural renderer will use this image as a style/texture reference specifically for this object.</p>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2"><Palette size={12} /> Color Override</h3>
                    <div className="flex items-center gap-3">
                      <input type="color" value={selectedObject.color || "#ffffff"} onChange={(e) => onUpdate(selectedObject.id, { color: e.target.value })} className="w-8 h-8 bg-transparent border-none rounded cursor-pointer" />
                      <input type="text" value={selectedObject.color || "#ffffff"} onChange={(e) => onUpdate(selectedObject.id, { color: e.target.value })} className="flex-1 bg-black/40 border border-[#333] rounded px-2 py-1.5 text-[10px] text-gray-300 font-mono focus:outline-none focus:border-blue-500 uppercase" />
                    </div>
                  </div>
                  </>
                )}
                
                {selectedGroup && (
                   <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-lg text-center">
                      <FolderOpen size={24} className="mx-auto text-blue-500 mb-2" />
                      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Group Selected</h3>
                      <p className="text-[9px] text-gray-400 mt-1">Use the Transform Gizmo in the viewport to Move, Rotate, or Scale the entire group together.</p>
                   </div>
                )}
              </div>
            )}
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
      </div>
    </div>
  );
};

export default AssetPanel;