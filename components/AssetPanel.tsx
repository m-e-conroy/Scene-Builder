import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Cloud, Package, Trash2, Search, Loader2, AlertCircle, Edit2, 
  Check, X, Info, Palette, Image as ImageIcon, SlidersHorizontal, 
  Globe, Magnet, Sparkles, Wand2, Box as BoxIcon, Circle, Cylinder as CylinderIcon, 
  Square, Cone as ConeIcon, Layers as LayersIcon, FolderPlus, Folder, ChevronDown, ChevronRight,
  MoveHorizontal, MoveVertical, Maximize, Ghost, Camera, CameraOff, Save, Navigation, Link as LinkIcon,
  MousePointer2, HardDrive, Move, RotateCw, BoxSelect, Triangle, GripVertical, FolderOpen,
  TriangleRight, Slice, Lock, Unlock, Eye, EyeOff,
  Diamond, Hexagon, Sunset, Battery, CircleDot, Dna, 
  Shapes, Star, Gem, Filter, Tent, Copy, ExternalLink, Key, Download, Mountain, 
  RefreshCw, Grid, LayoutTemplate
} from 'lucide-react';
import * as THREE from 'three';
import { SceneObject, SceneGroup, CloudAsset, BackgroundSettings, PrimitiveType, CameraPreset, TerrainData, FalloffType } from '../types';
import { searchSketchfab, getModelDownloadUrl } from '../services/sketchfabService';

interface AssetPanelProps {
  onAddLocal: (file: File) => void;
  onAddCloud: (asset: CloudAsset) => void;
  onAddPrimitive: (type: PrimitiveType) => void;
  onAddTerrain: () => void;
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
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<SceneObject>) => void;
  onUpdateGroup: (id: string, updates: Partial<SceneGroup>) => void;
  onAddGroup: () => void;
  onDuplicate: (id: string) => void; 
  cameraPresets: CameraPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: CameraPreset) => void;
  onDeletePreset: (id: string) => void;
  onOpenArrayTool: () => void; // New Prop
}

const PRIMITIVES: { type: PrimitiveType, icon: React.ReactNode, name: string }[] = [
  { type: 'box', icon: <BoxIcon size={16} />, name: 'Box' },
  { type: 'sphere', icon: <Circle size={16} />, name: 'Sphere' },
  { type: 'cylinder', icon: <CylinderIcon size={16} />, name: 'Cylinder' },
  { type: 'plane', icon: <Square size={16} />, name: 'Plane' },
  { type: 'cone', icon: <ConeIcon size={16} />, name: 'Cone' },
  { type: 'torus', icon: <LayersIcon size={16} />, name: 'Torus' },
  { type: 'pyramid', icon: <Triangle size={16} />, name: 'Pyramid' },
  { type: 'wedge', icon: <TriangleRight size={16} />, name: 'Wedge' },
  { type: 'oblique-wedge', icon: <Slice size={16} />, name: 'Oblique' },
  { type: 'tube', icon: <CircleDot size={16} />, name: 'Tube' },
  { type: 'capsule', icon: <Battery size={16} className="rotate-90" />, name: 'Capsule' },
  { type: 'hemisphere', icon: <Sunset size={16} />, name: 'Hemisphere' },
  { type: 'octahedron', icon: <Diamond size={16} />, name: 'Octahedron' },
  { type: 'dodecahedron', icon: <Hexagon size={16} />, name: 'Dodecahedron' },
  { type: 'helix', icon: <Dna size={16} />, name: 'Helix' },
  { type: 'polyhedron', icon: <Shapes size={16} />, name: 'Polyhedron' },
  { type: 'pentagrammic-prism', icon: <Star size={16} />, name: 'Star Prism' },
  { type: 'octagonal-pyramid', icon: <Tent size={16} />, name: 'Oct-Pyramid' },
  { type: 'tetrahedron', icon: <Gem size={16} />, name: 'Tetrahedron' },
  { type: 'conical-frustum', icon: <Filter size={16} />, name: 'Frustum' },
];

const TERRAIN_PRESETS: Record<string, Partial<TerrainData>> = {
  'mountain-range': { noiseScale: 2.5, octaves: 6, persistence: 0.5, lacunarity: 2, heightScale: 5, edgeFalloff: 'cosine' },
  'valley': { noiseScale: 1.5, octaves: 3, persistence: 0.5, lacunarity: 2, heightScale: 4, invert: true, edgeFalloff: 'linear' },
  'plateau': { noiseScale: 1, octaves: 2, persistence: 0.2, lacunarity: 4, heightScale: 2, smoothness: 0.2, edgeFalloff: 'cosine' },
  'rolling-hills': { noiseScale: 0.8, octaves: 2, persistence: 0.4, lacunarity: 2, heightScale: 1.5, smoothness: 0.5, edgeFalloff: 'none' },
  'canyon': { noiseScale: 4, octaves: 5, persistence: 0.6, lacunarity: 2, heightScale: 6, invert: true, edgeFalloff: 'linear' },
  'flat-plain': { noiseScale: 0.5, octaves: 1, persistence: 0.1, lacunarity: 2, heightScale: 0.2, smoothness: 1, edgeFalloff: 'none' },
};

const AssetPanel: React.FC<AssetPanelProps> = ({ 
  onAddLocal, onAddCloud, onAddPrimitive, onAddTerrain, onSetBackground, bgSettings, setBgSettings,
  snapSize, setSnapSize, objects, groups, onRemove, onRemoveGroup, selectedId, 
  onSelect, onUpdate, onUpdateGroup, onAddGroup, onDuplicate,
  cameraPresets, onSavePreset, onLoadPreset, onDeletePreset, onOpenArrayTool
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'cloud' | 'shapes' | 'scene' | 'cam' | 'env'>('shapes');
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredCloud, setFilteredCloud] = useState<CloudAsset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  
  // Sketchfab State
  const [sketchfabToken, setSketchfabToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [isTokenSaved, setIsTokenSaved] = useState(false);
  const [loadingAssetId, setLoadingAssetId] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // Drag and Drop State
  const [draggedObjId, setDraggedObjId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null); 

  // Inspector Tabs
  const [activeTerrainTab, setActiveTerrainTab] = useState<'gen' | 'shape' | 'edge' | 'vis'>('gen');

  useEffect(() => {
    const savedToken = localStorage.getItem('SKETCHFAB_API_TOKEN');
    if (savedToken) {
      setSketchfabToken(savedToken);
      setTokenInput(savedToken);
      setIsTokenSaved(true);
    }
  }, []);

  const handleSaveToken = () => {
    localStorage.setItem('SKETCHFAB_API_TOKEN', tokenInput);
    setSketchfabToken(tokenInput);
    setIsTokenSaved(true);
  };

  const handleClearToken = () => {
    localStorage.removeItem('SKETCHFAB_API_TOKEN');
    setSketchfabToken('');
    setTokenInput('');
    setIsTokenSaved(false);
  };

  const handleSketchfabSearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchSketchfab(search, sketchfabToken);
      setFilteredCloud(results);
    } catch (err) { 
      console.error(err); 
      alert("Search failed. Check API Token or internet connection.");
    } finally { 
      setIsSearching(false); 
    }
  };

  const handleDownloadAndAdd = async (asset: CloudAsset) => {
    if (!sketchfabToken) {
      alert("Please enter a valid Sketchfab API Token to download models.");
      return;
    }
    setLoadingAssetId(asset.uid);
    try {
      const downloadUrl = await getModelDownloadUrl(asset.uid, sketchfabToken);
      if (downloadUrl) {
        onAddCloud({ ...asset, downloadUrl });
      } else {
        alert("No suitable GLB/GLTF model found for this asset.");
      }
    } catch (err: any) {
      console.error(err);
      alert(`Download failed: ${err.message}`);
    } finally {
      setLoadingAssetId(null);
    }
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

  const handleHeightmapUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      // We need to cast through unknown because TypeScript doesn't know about nested updates easily
      const obj = objects.find(o => o.id === id);
      if (obj && obj.terrainData) {
         onUpdate(id, { 
             terrainData: { ...obj.terrainData, method: 'heightmap', heightmapUrl: base64 } 
         });
      }
    };
    reader.readAsDataURL(file);
  };

  const applyTerrainPreset = (id: string, presetName: string) => {
     const obj = objects.find(o => o.id === id);
     if (obj && obj.terrainData && TERRAIN_PRESETS[presetName]) {
         onUpdate(id, {
             terrainData: { ...obj.terrainData, ...TERRAIN_PRESETS[presetName], method: 'procedural' }
         });
     }
  };

  const toggleLock = (e: React.MouseEvent, id: string, currentLocked: boolean, isGroup: boolean) => {
    e.stopPropagation();
    const newLocked = !currentLocked;
    
    if (isGroup) {
       onUpdateGroup(id, { locked: newLocked });
    } else {
       onUpdate(id, { locked: newLocked });
    }

    if (newLocked && selectedId === id) {
       onSelect(null);
    }
  };

  const toggleVisibility = (e: React.MouseEvent, id: string, currentVisible: boolean | undefined, isGroup: boolean) => {
    e.stopPropagation();
    const isVisible = currentVisible !== false;
    const newVisible = !isVisible;
    
    if (isGroup) {
       onUpdateGroup(id, { visible: newVisible });
    } else {
       onUpdate(id, { visible: newVisible });
    }
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

  const handleReparent = (objId: string, newGroupId: string | undefined) => {
    const obj = objects.find(o => o.id === objId);
    if (!obj) return;
    if (obj.groupId === newGroupId) return; // No change

    const createMatrix = (pos: [number, number, number], rot: [number, number, number], scl: [number, number, number]) => {
      const p = new THREE.Vector3(pos[0], pos[1], pos[2]);
      const r = new THREE.Euler(rot[0], rot[1], rot[2]);
      const q = new THREE.Quaternion().setFromEuler(r);
      const s = new THREE.Vector3(scl[0], scl[1], scl[2]);
      return new THREE.Matrix4().compose(p, q, s);
    };

    let objectWorldMatrix = createMatrix(obj.position, obj.rotation, obj.scale);

    if (obj.groupId) {
      const oldParent = groups.find(g => g.id === obj.groupId);
      if (oldParent) {
        const parentMatrix = createMatrix(oldParent.position, oldParent.rotation, oldParent.scale);
        objectWorldMatrix.premultiply(parentMatrix);
      }
    }

    const newLocalMatrix = new THREE.Matrix4(); 

    if (newGroupId) {
      const newParent = groups.find(g => g.id === newGroupId);
      if (newParent) {
        const newParentMatrix = createMatrix(newParent.position, newParent.rotation, newParent.scale);
        const inverseNewParentMatrix = newParentMatrix.invert();
        newLocalMatrix.multiplyMatrices(inverseNewParentMatrix, objectWorldMatrix);
      } else {
        newLocalMatrix.copy(objectWorldMatrix);
      }
    } else {
      newLocalMatrix.copy(objectWorldMatrix);
    }

    const finalPos = new THREE.Vector3();
    const finalQuat = new THREE.Quaternion();
    const finalScale = new THREE.Vector3();

    newLocalMatrix.decompose(finalPos, finalQuat, finalScale);
    const finalRot = new THREE.Euler().setFromQuaternion(finalQuat);

    onUpdate(objId, {
      groupId: newGroupId,
      position: [finalPos.x, finalPos.y, finalPos.z],
      rotation: [finalRot.x, finalRot.y, finalRot.z],
      scale: [finalScale.x, finalScale.y, finalScale.z]
    });
  };

  const renderSceneItem = (obj: SceneObject, depth = 0) => {
    const isVisible = obj.visible !== false;

    return (
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
              <span className={`text-[11px] truncate flex-1 px-1 ${obj.locked ? 'text-gray-600 italic' : 'text-gray-400'} ${!isVisible ? 'opacity-50 line-through decoration-gray-700' : ''}`}>{obj.name}</span>
              {obj.referenceImageUrl && <LinkIcon size={10} className="text-blue-500 animate-pulse" />}
            </>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button 
             onClick={(e) => toggleVisibility(e, obj.id, obj.visible, false)} 
             className={`p-1 transition-opacity ${!isVisible ? 'text-gray-500' : 'text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100'}`}
             title={isVisible ? "Hide Object" : "Show Object"}
          >
             {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button 
             onClick={(e) => toggleLock(e, obj.id, !!obj.locked, false)} 
             className={`p-1 transition-opacity ${obj.locked ? 'text-yellow-500 opacity-100' : 'text-gray-700 opacity-0 group-hover:opacity-100 hover:text-gray-400'}`}
             title={obj.locked ? "Unlock Object" : "Lock Object"}
          >
             {obj.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(obj.id); }} className="p-1 text-gray-600 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Duplicate"><Copy size={12} /></button>
          <button onClick={(e) => { e.stopPropagation(); startEditing(obj.id, obj.name); }} className="p-1 text-gray-600 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }} className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
        </div>
      </div>
    );
  };

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
            <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Procedural</label>
            <div className="grid grid-cols-3 gap-2">
               <button onClick={onAddTerrain} className="flex flex-col items-center justify-center gap-2 aspect-square bg-[#0a0a0a] border border-[#222] rounded-md hover:border-green-500 hover:bg-green-600/5 transition-all group">
                  <div className="text-gray-500 group-hover:text-green-400"><Mountain size={16} /></div>
                  <span className="text-[9px] font-black uppercase text-gray-600 group-hover:text-white text-center px-1">Terrain Tool</span>
               </button>
            </div>

            <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 mt-4">Geometric Primitives</label>
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

        {/* ... (Existing tabs omitted for brevity, keeping only the updated Scene inspector section) ... */}
        
        {/* RE-INSERTING OTHER TABS FOR CONTEXT - NO CHANGES UNTIL SCENE TAB */}
        {activeTab === 'local' && (
          <div className="space-y-4">
             <div className="border-2 border-dashed border-[#333] rounded-lg p-6 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-900/5 transition-all group">
                <Upload size={24} className="text-gray-500 group-hover:text-blue-500 mb-2" />
                <h3 className="text-xs font-bold text-gray-300 uppercase">Upload Model</h3>
                <p className="text-[9px] text-gray-500 mt-1 max-w-[150px]">Support for .glb, .gltf, and .obj formats</p>
                <label className="mt-3 px-3 py-1.5 bg-[#222] hover:bg-blue-600 text-[10px] font-bold text-white uppercase rounded cursor-pointer transition-colors">
                   Browse Files
                   <input type="file" className="hidden" accept=".glb,.gltf,.obj" onChange={(e) => e.target.files?.[0] && onAddLocal(e.target.files[0])} />
                </label>
             </div>
             <div className="p-3 bg-yellow-900/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                   <AlertCircle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                   <p className="text-[9px] text-yellow-200/70 leading-relaxed">
                      For best performance, use optimized <strong>.glb</strong> files under 50MB. Complex geometry may impact rendering speed.
                   </p>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'env' && (
          <div className="space-y-6">
             <div>
                <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Reference Backdrop</label>
                <div className="relative aspect-video bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden group">
                   {bgSettings.url ? (
                      <>
                        <img src={bgSettings.url} className="w-full h-full object-contain opacity-50" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setBgSettings(prev => ({ ...prev, url: null }))} className="p-2 bg-red-600 rounded text-white flex items-center gap-2 text-[10px] font-bold uppercase"><Trash2 size={12} /> Remove</button>
                        </div>
                      </>
                   ) : (
                      <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-[#111] transition-colors">
                         <ImageIcon size={24} className="text-gray-600 mb-2" />
                         <span className="text-[9px] text-gray-500 font-bold uppercase">Upload Image</span>
                         <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onSetBackground(e.target.files[0])} />
                      </label>
                   )}
                </div>
             </div>

             {bgSettings.url && (
                <div className="space-y-4">
                   <div>
                      <div className="flex justify-between text-[8px] text-gray-500 uppercase font-black mb-1">
                         <span>Opacity</span> <span className="text-blue-400">{(bgSettings.opacity * 100).toFixed(0)}%</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.05" value={bgSettings.opacity} onChange={(e) => updateBg({ opacity: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                   </div>
                   
                   <div>
                      <div className="flex justify-between text-[8px] text-gray-500 uppercase font-black mb-1">
                         <span>Scale</span> <span className="text-blue-400">{bgSettings.scale}x</span>
                      </div>
                      <input type="range" min="1" max="50" step="0.5" value={bgSettings.scale} onChange={(e) => updateBg({ scale: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-600" />
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                      <div>
                         <label className="text-[8px] text-gray-500 uppercase font-black mb-1 block">Pos X</label>
                         <input type="number" value={bgSettings.position[0]} onChange={(e) => updateBg({ position: [parseFloat(e.target.value), bgSettings.position[1], bgSettings.position[2]] })} className="w-full bg-[#0a0a0a] border border-[#222] rounded px-2 py-1 text-[10px] text-gray-300 outline-none focus:border-blue-500" />
                      </div>
                      <div>
                         <label className="text-[8px] text-gray-500 uppercase font-black mb-1 block">Pos Y</label>
                         <input type="number" value={bgSettings.position[1]} onChange={(e) => updateBg({ position: [bgSettings.position[0], parseFloat(e.target.value), bgSettings.position[2]] })} className="w-full bg-[#0a0a0a] border border-[#222] rounded px-2 py-1 text-[10px] text-gray-300 outline-none focus:border-blue-500" />
                      </div>
                   </div>
                </div>
             )}
          </div>
        )}

        {activeTab === 'cloud' && (
           <div className="space-y-6">
            <div className="p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg space-y-2">
               <div className="flex items-center justify-between">
                  <label className="text-[9px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-1">
                    <Key size={10} /> Sketchfab API Token
                  </label>
                  {isTokenSaved && <button onClick={handleClearToken} className="text-[9px] text-red-500 hover:underline">Clear</button>}
               </div>
               {isTokenSaved ? (
                 <div className="flex items-center gap-2 text-green-500 bg-green-500/10 p-2 rounded border border-green-500/20">
                    <Check size={12} /> <span className="text-[10px] font-mono">Token Active</span>
                 </div>
               ) : (
                 <div className="flex gap-2">
                    <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="sk_..." className="flex-1 bg-black border border-[#333] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500" />
                    <button onClick={handleSaveToken} className="bg-blue-600 text-white text-[10px] font-bold px-2 rounded hover:bg-blue-500">Save</button>
                 </div>
               )}
               <a href="https://sketchfab.com/settings/password" target="_blank" rel="noreferrer" className="text-[8px] text-gray-500 hover:text-gray-300 flex items-center gap-1 underline decoration-dotted">Get token <ExternalLink size={8} /></a>
            </div>
            <div className="space-y-4">
              <div className="relative">
                {isSearching ? <Loader2 className="absolute left-3 top-2.5 text-blue-500 animate-spin" size={14} /> : <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />}
                <input type="text" placeholder="Search Sketchfab..." className="w-full bg-[#0a0a0a] border border-[#222] rounded-md pl-9 pr-10 py-2 text-xs text-white focus:outline-none focus:border-blue-500" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSketchfabSearch()} />
                <button onClick={handleSketchfabSearch} className="absolute right-2 top-2 text-blue-500 hover:text-blue-400"><Wand2 size={14} /></button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {filteredCloud.map((asset) => (
                  <div key={asset.uid} className="group relative bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden hover:border-blue-500/50 transition-all flex flex-col">
                    <div className="relative aspect-video bg-[#111] overflow-hidden">
                       <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <button onClick={() => handleDownloadAndAdd(asset)} className="bg-blue-600 hover:bg-blue-500 text-white rounded-full p-2 shadow-lg flex items-center gap-2 px-3" disabled={loadingAssetId === asset.uid}>
                               {loadingAssetId === asset.uid ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                               <span className="text-[9px] font-bold">IMPORT</span>
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent pointer-events-none">
                            <p className="text-[10px] font-bold text-white truncate">{asset.name}</p>
                            <p className="text-[8px] text-gray-300">by {asset.author}</p>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cam' && (
           <div className="space-y-6">
             <div>
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Save Current Perspective</label>
              <div className="flex gap-2">
                <input type="text" placeholder="View Name..." className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newPresetName.trim()) { onSavePreset(newPresetName); setNewPresetName(''); } }} />
                <button onClick={() => { if (newPresetName.trim()) { onSavePreset(newPresetName); setNewPresetName(''); } }} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"><Save size={16} /></button>
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest">Navigation Presets</label>
              <div className="grid grid-cols-1 gap-2">
                {cameraPresets.map((preset) => (
                  <div key={preset.id} className="group relative flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#222] rounded-lg hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => onLoadPreset(preset)}>
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md ${preset.isSystem ? 'bg-blue-600/20 text-blue-400' : 'bg-green-600/20 text-green-400'}`}> {preset.isSystem ? <Globe size={14} /> : <Camera size={14} />} </div>
                      <div> <p className="text-[10px] font-bold text-gray-300 uppercase tracking-tight">{preset.name}</p> </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
           </div>
        )}

        {activeTab === 'scene' && (
            <div className="space-y-4 pb-20">
               <div className="flex items-center justify-between px-1"><h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Hierarchy</h3><button onClick={onAddGroup} className="flex items-center gap-1 text-[8px] font-black text-blue-500 hover:text-blue-400 uppercase"><FolderPlus size={10} /> Add Group</button></div>
               <div className="space-y-2">
                  {groups.map(group => (
                     <div key={group.id} className={`space-y-1 rounded-md transition-all ${dragOverGroupId === group.id ? 'bg-blue-600/20 ring-1 ring-blue-500' : ''}`} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroupId(group.id); }} onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if(dragOverGroupId === group.id) setDragOverGroupId(null); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (draggedObjId) { handleReparent(draggedObjId, group.id); if (!group.isOpen) onUpdateGroup(group.id, { isOpen: true }); } setDraggedObjId(null); setDragOverGroupId(null); }}>
                        <div onClick={() => onSelect(group.id)} className={`flex items-center justify-between p-2 rounded-md border cursor-pointer group transition-colors ${selectedId === group.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-[#0a0a0a] border-[#222]'}`}>
                           <div className="flex items-center gap-2 flex-1 min-w-0"> <button onClick={(e) => { e.stopPropagation(); onUpdateGroup(group.id, { isOpen: !group.isOpen }); }} className="text-gray-600">{group.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button> {group.isOpen ? <FolderOpen size={12} className={selectedId === group.id ? "text-blue-400 shrink-0" : "text-gray-600 shrink-0"} /> : <Folder size={12} className={selectedId === group.id ? "text-blue-400 shrink-0" : "text-gray-600 shrink-0"} />} {editingId === group.id ? ( <input autoFocus className="text-[11px] bg-black text-white border border-blue-500 rounded px-1 flex-1 min-w-0 outline-none" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={() => commitEditing('grp')} onKeyDown={(e) => e.key === 'Enter' && commitEditing('grp')} onClick={(e) => e.stopPropagation()} /> ) : ( <span className={`text-[11px] truncate font-bold uppercase tracking-tight ${group.locked ? 'text-gray-600 italic' : (selectedId === group.id ? 'text-blue-300' : 'text-gray-300')} ${group.visible === false ? 'opacity-50 line-through decoration-gray-700' : ''}`}>{group.name}</span> )} </div>
                           
                           <div className="flex items-center gap-1">
                              <button 
                                 onClick={(e) => toggleVisibility(e, group.id, group.visible, true)} 
                                 className={`p-1 transition-opacity ${group.visible === false ? 'text-gray-500' : 'text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100'}`}
                                 title={group.visible === false ? "Show Group" : "Hide Group"}
                              >
                                 {group.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button 
                                 onClick={(e) => toggleLock(e, group.id, !!group.locked, true)} 
                                 className={`p-1 transition-opacity ${group.locked ? 'text-yellow-500 opacity-100' : 'text-gray-700 opacity-0 group-hover:opacity-100 hover:text-gray-400'}`}
                                 title={group.locked ? "Unlock Group" : "Lock Group"}
                              >
                                 {group.locked ? <Lock size={12} /> : <Unlock size={12} />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); onDuplicate(group.id); }} className="p-1 text-gray-600 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Duplicate Group"><Copy size={12} /></button>
                              <button onClick={(e) => { e.stopPropagation(); startEditing(group.id, group.name); }} className="p-1 text-gray-600 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename Group"><Edit2 size={12} /></button>
                              <button onClick={(e) => { e.stopPropagation(); onRemoveGroup(group.id); }} className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Group"><Trash2 size={12} /></button>
                           </div>

                        </div>
                        {group.isOpen && ( <div className="border-l border-[#222] ml-4 space-y-1 py-1"> {objects.filter(o => o.groupId === group.id).map(obj => renderSceneItem(obj, 0))} </div> )}
                     </div>
                  ))}
                  <div className={`space-y-1 pt-2 rounded-md transition-all min-h-[50px] ${dragOverGroupId === 'root' ? 'bg-blue-600/20 ring-1 ring-blue-500' : ''}`} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverGroupId('root'); }} onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if(dragOverGroupId === 'root') setDragOverGroupId(null); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (draggedObjId) { handleReparent(draggedObjId, undefined); } setDraggedObjId(null); setDragOverGroupId(null); }}> <h4 className="text-[8px] text-gray-700 font-black uppercase tracking-widest px-1 pointer-events-none flex items-center gap-1"><LayersIcon size={10}/> Ungrouped Objects</h4> {objects.filter(o => !o.groupId).map(obj => renderSceneItem(obj))} </div>
               </div>
            </div>
        )}

            
            {/* Contextual Properties for Selected Object OR Group */}
            {(selectedObject || selectedGroup) && (
              <div className="pt-6 border-t border-[#222] space-y-6">
                
                {selectedObject && (
                  <>
                  {/* ... Terrain Inspector ... */}
                  {selectedObject.type === 'terrain' && selectedObject.terrainData && (
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
                                <Mountain size={12} /> Terrain Tool
                            </h3>
                            <select 
                                onChange={(e) => applyTerrainPreset(selectedObject.id, e.target.value)}
                                className="bg-[#111] text-gray-400 text-[9px] border border-[#333] rounded px-1 py-0.5 outline-none"
                            >
                                <option value="">Select Preset...</option>
                                {Object.keys(TERRAIN_PRESETS).map(k => <option key={k} value={k}>{k.replace('-', ' ').toUpperCase()}</option>)}
                            </select>
                        </div>
                        {/* ... existing terrain UI ... */}
                     </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <SlidersHorizontal size={12} /> Transform Inspector
                      </h3>
                      <button 
                        onClick={onOpenArrayTool}
                        className="flex items-center gap-1 text-[8px] font-bold uppercase text-blue-400 hover:text-white bg-blue-600/10 hover:bg-blue-600 px-2 py-1 rounded transition-colors"
                      >
                         <Copy size={10} /> Array Tool
                      </button>
                    </div>
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
                  {/* ... rest of selectedObject ... */}
                  </>
                )}
                
                {selectedGroup && (
                   <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-lg text-center space-y-3">
                      <FolderOpen size={24} className="mx-auto text-blue-500 mb-2" />
                      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Group Selected</h3>
                      <p className="text-[9px] text-gray-400 mt-1">Use the Transform Gizmo in the viewport to Move, Rotate, or Scale the entire group together.</p>
                      
                      <button 
                        onClick={onOpenArrayTool}
                        className="w-full py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] rounded text-[10px] text-white font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                         <Copy size={12} /> Array Duplicate Group
                      </button>
                   </div>
                )}
              </div>
            )}
      </div>
    </div>
  );
};

export default AssetPanel;
