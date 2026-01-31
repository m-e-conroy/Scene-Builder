import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SceneObject, SceneGroup, CloudAsset, TransformMode, BackgroundSettings, PrimitiveType, CameraPreset, StylePreset } from './types';
import AssetPanel from './components/AssetPanel';
import AIPanel from './components/AIPanel';
import Viewport from './components/Viewport';
import PreviewOverlay from './components/PreviewOverlay';
import { processSceneToImage, sanitizeModelUrl } from './services/geminiService';
import { Layers, Move, RotateCw, Maximize, Magnet, ClipboardCheck, Undo2, Redo2, Download, Upload, FileJson, FilePlus, AlertTriangle, X } from 'lucide-react';

const DEFAULT_CAMERA_PRESETS: CameraPreset[] = [
  { id: 'cam-iso', name: 'Isometric (45°)', position: [10, 10, 10], target: [0, 0, 0], isSystem: true },
  { id: 'cam-top', name: 'Top (Orthogonal)', position: [0, 15, 0.001], target: [0, 0, 0], isSystem: true },
  { id: 'cam-front', name: 'Front (Orthogonal)', position: [0, 0, 15], target: [0, 0, 0], isSystem: true },
  { id: 'cam-side', name: 'Side (Orthogonal)', position: [15, 0, 0], target: [0, 0, 0], isSystem: true },
];

const DEFAULT_STYLE_PRESETS: StylePreset[] = [
  { id: 'style-cinematic', name: 'Cinematic Reality', prompt: "Cinematic shot, highly detailed, photorealistic, 8k resolution, dramatic lighting, depth of field", strength: 0.55, isSystem: true },
  { id: 'style-studio', name: 'Studio Product', prompt: "Studio photography, professional lighting, clean background, sharp focus, 4k, product advertisement", strength: 0.45, isSystem: true },
  { id: 'style-arch', name: 'Architectural', prompt: "Architectural visualization, modern design, interior lighting, wide angle, hyper-realistic, unreal engine 5", strength: 0.5, isSystem: true },
  { id: 'style-scifi', name: 'Sci-Fi Concept', prompt: "Futuristic sci-fi concept art, neon lights, cyberpunk aesthetic, volumetric fog, digital art, trending on artstation", strength: 0.65, isSystem: true },
  { id: 'style-fantasy', name: 'Fantasy', prompt: "Fantasy environment, magical atmosphere, ethereal lighting, painterly style, matte painting, masterpiece", strength: 0.6, isSystem: true }
];

const App: React.FC = () => {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [groups, setGroups] = useState<SceneGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapSize, setSnapSize] = useState(0.5);
  const [isCapturing, setIsCapturing] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Project');
  
  // Camera State
  const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>(DEFAULT_CAMERA_PRESETS);
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPreset | null>(null);

  // Style Preset State
  const [stylePresets, setStylePresets] = useState<StylePreset[]>(DEFAULT_STYLE_PRESETS);
  
  // History State
  const [history, setHistory] = useState<{ past: {objs: SceneObject[], grps: SceneGroup[]}[], future: {objs: SceneObject[], grps: SceneGroup[]}[] }>({
    past: [],
    future: []
  });

  // Clipboard State
  const [clipboard, setClipboard] = useState<SceneObject | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Background State
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>({
    url: null,
    position: [0, 0, -5],
    scale: 10,
    opacity: 1
  });

  // AI State
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.5);
  const [lightingReference, setLightingReference] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Modal State
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const recordHistory = useCallback((currObjs: SceneObject[], currGrps: SceneGroup[]) => {
    setHistory(h => ({
      past: [...h.past, { 
        objs: currObjs.map(o => ({ ...o })), 
        grps: currGrps.map(g => ({ ...g })) 
      }].slice(-50),
      future: []
    }));
  }, []);

  const handleUndo = useCallback(() => {
    if (history.past.length === 0) return;
    const lastState = history.past[history.past.length - 1];
    setHistory(h => ({
      past: h.past.slice(0, -1),
      future: [{ objs: [...objects], grps: [...groups] }, ...h.future].slice(0, 50)
    }));
    setObjects(lastState.objs.map(o => ({ ...o })));
    setGroups(lastState.grps.map(g => ({ ...g })));
    showStatus("UNDO ACTION");
  }, [objects, groups, history]);

  const handleRedo = useCallback(() => {
    if (history.future.length === 0) return;
    const nextState = history.future[0];
    setHistory(h => ({
      past: [...h.past, { objs: [...objects], grps: [...groups] }].slice(-50),
      future: h.future.slice(1)
    }));
    setObjects(nextState.objs.map(o => ({ ...o })));
    setGroups(nextState.grps.map(g => ({ ...g })));
    showStatus("REDO ACTION");
  }, [objects, groups, history]);

  const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36).slice(-4);

  const handleAddLocal = useCallback((file: File) => {
    recordHistory(objects, groups);
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const format = (ext === 'obj' ? 'obj' : (ext === 'gltf' ? 'gltf' : 'glb'));

    const newObj: SceneObject = {
      id: generateId(),
      name: file.name.split('.')[0],
      url: url,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'local',
      format: format as any
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newObj.id);
  }, [objects, groups, recordHistory]);

  const handleAddCloud = useCallback((asset: CloudAsset) => {
    recordHistory(objects, groups);
    
    // Safety check for URL
    if (!asset.downloadUrl) {
        showStatus("ERROR: NO DOWNLOAD URL");
        return;
    }

    const newObj: SceneObject = {
      id: generateId(),
      name: asset.name,
      url: sanitizeModelUrl(asset.downloadUrl),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'cloud',
      format: 'glb',
      attribution: (asset.author && asset.modelUrl) ? {
        author: asset.author,
        url: asset.modelUrl,
        license: asset.license || 'Unknown'
      } : undefined
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newObj.id);
    showStatus("ASSET ADDED");
  }, [objects, groups, recordHistory]);

  const handleAddPrimitive = useCallback((type: PrimitiveType) => {
    recordHistory(objects, groups);
    const newObj: SceneObject = {
      id: generateId(),
      name: type.charAt(0).toUpperCase() + type.slice(1),
      url: '',
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'primitive',
      primitiveType: type,
      color: '#3b82f6'
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newObj.id);
    showStatus(`ADDED ${type.toUpperCase()}`);
  }, [objects, groups, recordHistory]);

  const handleAddTerrain = useCallback(() => {
    recordHistory(objects, groups);
    const newObj: SceneObject = {
      id: generateId(),
      name: "Procedural Terrain",
      url: '',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'terrain',
      color: '#8ba88e',
      terrainData: {
        method: 'procedural',
        width: 10,
        depth: 10,
        heightScale: 3,
        segments: 64,
        noiseScale: 1,
        octaves: 3,
        persistence: 0.5,
        lacunarity: 2,
        seed: Math.random(),
        edgeFalloff: 'none',
        falloffDistance: 0.2,
        invert: false,
        smoothness: 0,
        wireframe: false,
        showGradient: false
      }
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newObj.id);
    showStatus("ADDED TERRAIN");
  }, [objects, groups, recordHistory]);

  const handleAddGroup = useCallback(() => {
    recordHistory(objects, groups);
    const newGroup: SceneGroup = {
      id: generateId(),
      name: "New Group",
      isOpen: true,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    };
    setGroups(prev => [...prev, newGroup]);
    setSelectedId(newGroup.id);
    showStatus("GROUP CREATED");
  }, [objects, groups, recordHistory]);

  const handleCopy = useCallback(() => {
    if (!selectedId) return;
    const target = objects.find(o => o.id === selectedId);
    if (target) {
      setClipboard({ ...target });
      showStatus("COPIED: " + target.name);
    }
  }, [selectedId, objects]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    recordHistory(objects, groups);
    const newObj: SceneObject = {
      ...clipboard,
      id: generateId(),
      position: [clipboard.position[0] + 1, clipboard.position[1], clipboard.position[2] + 1],
      rotation: [...clipboard.rotation] as [number, number, number],
      scale: [...clipboard.scale] as [number, number, number]
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newObj.id);
    showStatus("PASTED: " + newObj.name);
  }, [clipboard, objects, groups, recordHistory]);

  const handleDuplicate = useCallback((id: string) => {
    recordHistory(objects, groups);

    // Check if it is a group
    const groupToDup = groups.find(g => g.id === id);
    if (groupToDup) {
      const newGroupId = generateId();
      const newGroup: SceneGroup = {
        ...groupToDup,
        id: newGroupId,
        name: `${groupToDup.name} (Copy)`,
        position: [groupToDup.position[0] + 2, groupToDup.position[1], groupToDup.position[2] + 2],
        rotation: [...groupToDup.rotation] as [number, number, number],
        scale: [...groupToDup.scale] as [number, number, number]
      };
      
      const groupObjects = objects.filter(o => o.groupId === id);
      // Duplicate objects inside the group
      // IMPORTANT: Generate IDs using a counter index to prevent collision in tight loops
      const newGroupObjects = groupObjects.map((obj, i) => ({
        ...obj,
        id: generateId() + i, // Append index to guarantee uniqueness during batch creation
        groupId: newGroupId,
        position: [...obj.position] as [number, number, number], // Deep copy transform arrays
        rotation: [...obj.rotation] as [number, number, number],
        scale: [...obj.scale] as [number, number, number]
      }));

      setGroups(prev => [...prev, newGroup]);
      setObjects(prev => [...prev, ...newGroupObjects]);
      setSelectedId(newGroupId);
      showStatus("DUPLICATED GROUP");
      return;
    }

    // Check if it is an object
    const objToDup = objects.find(o => o.id === id);
    if (objToDup) {
      const newObj: SceneObject = {
        ...objToDup,
        id: generateId(),
        name: `${objToDup.name} (Copy)`,
        position: [objToDup.position[0] + 1, objToDup.position[1], objToDup.position[2] + 1],
        rotation: [...objToDup.rotation] as [number, number, number],
        scale: [...objToDup.scale] as [number, number, number]
      };
      setObjects(prev => [...prev, newObj]);
      setSelectedId(newObj.id);
      showStatus("DUPLICATED OBJECT");
    }
  }, [objects, groups, recordHistory]);

  // Style Preset Handlers
  const handleSaveStylePreset = useCallback((name: string) => {
    const newPreset: StylePreset = {
      id: generateId(),
      name,
      prompt,
      strength,
      lightingReference,
      isSystem: false
    };
    setStylePresets(prev => [...prev, newPreset]);
    showStatus("STYLE SAVED");
  }, [prompt, strength, lightingReference]);

  const handleApplyStylePreset = useCallback((preset: StylePreset) => {
    setPrompt(preset.prompt);
    setStrength(preset.strength);
    if (preset.lightingReference !== undefined) {
      setLightingReference(preset.lightingReference);
    }
    showStatus(`APPLIED: ${preset.name}`);
  }, []);

  const handleDeleteStylePreset = useCallback((id: string) => {
    setStylePresets(prev => prev.filter(p => p.id !== id));
    showStatus("STYLE DELETED");
  }, []);

  // Project Management
  const resetProject = useCallback(() => {
    setObjects([]);
    setGroups([]);
    setSelectedId(null);
    setHistory({ past: [], future: [] });
    setBgSettings({ url: null, position: [0, 0, -5], scale: 10, opacity: 1 });
    setCameraPresets(DEFAULT_CAMERA_PRESETS);
    setPrompt('');
    setStrength(0.5);
    setLightingReference(null);
    setResultImage(null);
    setSourceImage(null);
    setProjectName('Untitled Project');
    setStylePresets(DEFAULT_STYLE_PRESETS); // Reset styles to default
    showStatus("NEW PROJECT STARTED");
    setIsNewProjectDialogOpen(false);
  }, []);

  const handleNewProject = useCallback(() => {
    if (objects.length > 0) {
      setIsNewProjectDialogOpen(true);
    } else {
      resetProject();
    }
  }, [objects, resetProject]);

  const handleSaveProject = async () => {
    showStatus("PACKING PROJECT...");
    
    try {
      // Helper to convert blob URL to base64
      const blobToDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      // Inline local object assets
      const objectsToSave = await Promise.all(objects.map(async (obj) => {
        if (obj.type === 'local' && obj.url.startsWith('blob:')) {
          try {
            const response = await fetch(obj.url);
            const blob = await response.blob();
            const dataUrl = await blobToDataURL(blob);
            return { ...obj, url: dataUrl };
          } catch (e) {
            console.warn(`Failed to inline asset ${obj.name}`, e);
            return obj;
          }
        }
        return obj;
      }));

      // Inline background if local
      let bgSettingsToSave = { ...bgSettings };
      if (bgSettings.url && bgSettings.url.startsWith('blob:')) {
         try {
            const response = await fetch(bgSettings.url);
            const blob = await response.blob();
            bgSettingsToSave.url = await blobToDataURL(blob);
         } catch (e) {
             console.warn("Failed to inline background", e);
         }
      }

      const projectData = {
        name: projectName,
        version: 1,
        timestamp: Date.now(),
        objects: objectsToSave,
        groups,
        bgSettings: bgSettingsToSave,
        cameraPresets,
        stylePresets, // Save custom presets
        aiSettings: { prompt, strength, lightingReference }
      };

      const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled';
      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gemini-scene-${safeName}-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showStatus("PROJECT SAVED");
    } catch (error) {
      console.error("Save failed", error);
      showStatus("SAVE FAILED");
    }
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showStatus("LOADING PROJECT...");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        if (!Array.isArray(json.objects)) throw new Error("Invalid project file");

        setObjects(json.objects);
        setGroups(json.groups || []);
        if (json.bgSettings) setBgSettings(json.bgSettings);
        if (json.cameraPresets) setCameraPresets(json.cameraPresets);
        if (json.stylePresets) setStylePresets(json.stylePresets); // Load custom presets
        if (json.aiSettings) {
          setPrompt(json.aiSettings.prompt || '');
          setStrength(json.aiSettings.strength ?? 0.5);
          setLightingReference(json.aiSettings.lightingReference || null);
        }
        if (json.name) {
          setProjectName(json.name);
        } else {
          setProjectName(file.name.replace('.json', '') || 'Untitled Project');
        }
        
        setHistory({ past: [], future: [] });
        setSelectedId(null);
        showStatus("PROJECT LOADED");
      } catch (err) {
        console.error("Load failed", err);
        showStatus("INVALID FILE");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 't') setTransformMode('translate');
        if (e.key.toLowerCase() === 'r') setTransformMode('rotate');
        if (e.key.toLowerCase() === 's') setTransformMode('scale');
      }
      if (ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
      if (ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if (ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
      }
      if (ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
      }
      if (ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedId) handleDuplicate(selectedId);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          const isGroup = groups.find(g => g.id === selectedId);
          if (isGroup) handleRemoveGroup(selectedId);
          else handleRemove(selectedId);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCopy, handlePaste, handleUndo, handleRedo, handleDuplicate, selectedId, groups]);

  const handleSetBackground = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setBgSettings(prev => ({ ...prev, url }));
  }, []);

  const handleRemove = useCallback((id: string) => {
    recordHistory(objects, groups);
    setObjects((prev) => {
      const obj = prev.find(o => o.id === id);
      if (obj && obj.url.startsWith('blob:')) URL.revokeObjectURL(obj.url);
      return prev.filter(o => o.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
    showStatus("DELETED OBJECT");
  }, [selectedId, objects, groups, recordHistory]);

  const handleRemoveGroup = useCallback((groupId: string) => {
    recordHistory(objects, groups);
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setObjects(prev => prev.map(o => o.groupId === groupId ? { ...o, groupId: undefined } : o));
    if (selectedId === groupId) setSelectedId(null);
    showStatus("REMOVED GROUP");
  }, [selectedId, objects, groups, recordHistory]);

  const handleUpdate = useCallback((id: string, updates: Partial<SceneObject>) => {
    setObjects((prev) => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }, []);

  const handleUpdateGroup = useCallback((id: string, updates: Partial<SceneGroup>) => {
    setGroups((prev) => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const handleUpdateMany = useCallback((updates: { id: string, updates: Partial<SceneObject> }[]) => {
    setObjects((prev) => prev.map(o => {
      const update = updates.find(u => u.id === o.id);
      return update ? { ...o, ...update.updates } : o;
    }));
  }, []);

  // Camera Presets Logic
  const handleSaveCameraPreset = useCallback((name: string) => {
    if ((window as any).captureCurrentView) {
      (window as any).captureCurrentView();
      (window as any).__tempPresetName = name;
    }
  }, []);

  const onSetCapturedView = useCallback((pos: [number, number, number], target: [number, number, number]) => {
    const name = (window as any).__tempPresetName || "Saved View";
    const newPreset: CameraPreset = {
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      position: pos,
      target: target,
      isSystem: false
    };
    setCameraPresets(prev => [...prev, newPreset]);
    showStatus("VIEW SAVED");
    (window as any).__tempPresetName = null;
  }, []);

  const handleLoadCameraPreset = useCallback((preset: CameraPreset) => {
    setActiveCameraPreset(preset);
    showStatus(`JUMPING TO ${preset.name}`);
  }, []);

  const handleDeleteCameraPreset = useCallback((id: string) => {
    setCameraPresets(prev => prev.filter(p => p.id !== id));
    showStatus("VIEW DELETED");
  }, []);

  const handleGenerate = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    setIsCapturing(true); 
    try {
      const currentSelected = selectedId;
      setSelectedId(null);
      await new Promise(r => setTimeout(r, 150));
      const base64 = canvasRef.current.toDataURL('image/png');
      setSourceImage(base64);
      setIsCapturing(false);
      setSelectedId(currentSelected);
      const result = await processSceneToImage(base64, prompt, strength, objects, groups, lightingReference);
      setResultImage(result);
      if (result) setIsPreviewOpen(true);
    } catch (err) {
      console.error("Generation failed:", err);
      setIsCapturing(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSetAsBackdrop = (url: string) => {
    setBgSettings(prev => ({ ...prev, url }));
    setIsPreviewOpen(false);
    showStatus("OUTPUT SET AS BACKDROP");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] overflow-hidden select-none">
      <header className="h-14 border-b border-[#222] bg-[#111] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <Layers className="text-white" size={18} />
          </div>
          <div className="flex flex-col">
            <input 
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-transparent border-none p-0 text-sm font-bold tracking-tight text-white uppercase focus:ring-0 focus:outline-none placeholder-gray-600 w-64"
              placeholder="UNTITLED PROJECT"
            />
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest opacity-80">GEMINI SCENE BUILDER</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1 bg-black/30 p-1 rounded-md border border-white/5">
            <button onClick={() => setTransformMode('translate')} className={`p-2 rounded transition-all ${transformMode === 'translate' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`} title="Translate (T)"><Move size={16} /></button>
            <button onClick={() => setTransformMode('rotate')} className={`p-2 rounded transition-all ${transformMode === 'rotate' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`} title="Rotate (R)"><RotateCw size={16} /></button>
            <button onClick={() => setTransformMode('scale')} className={`p-2 rounded transition-all ${transformMode === 'scale' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`} title="Scale (S)"><Maximize size={16} /></button>
          </div>

          <div className="flex items-center gap-1 bg-black/30 p-1 rounded-md border border-white/5">
            <button onClick={handleUndo} disabled={history.past.length === 0} className={`p-2 rounded transition-all ${history.past.length > 0 ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'}`} title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
            <button onClick={handleRedo} disabled={history.future.length === 0} className={`p-2 rounded transition-all ${history.future.length > 0 ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'}`} title="Redo (Ctrl+Y)"><Redo2 size={16} /></button>
          </div>

          <div className="flex items-center gap-1 bg-black/30 p-1 rounded-md border border-white/5">
             <button onClick={handleNewProject} className="p-2 text-gray-500 hover:text-white transition-colors" title="New Project"><FilePlus size={16} /></button>
             <button onClick={handleSaveProject} className="p-2 text-gray-500 hover:text-white transition-colors" title="Save Project"><Download size={16} /></button>
             <label className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer" title="Load Project">
                <Upload size={16} />
                <input type="file" className="hidden" accept=".json" onChange={handleLoadProject} />
             </label>
          </div>

          <button onClick={() => setSnapEnabled(!snapEnabled)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-[10px] font-bold uppercase tracking-widest ${snapEnabled ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
            <Magnet size={14} className={snapEnabled ? "animate-pulse" : ""} />
            {snapEnabled ? 'Snap ON' : 'Snap OFF'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <AssetPanel 
          onAddLocal={handleAddLocal} 
          onAddCloud={handleAddCloud}
          onAddPrimitive={handleAddPrimitive}
          onAddTerrain={handleAddTerrain}
          onSetBackground={handleSetBackground}
          bgSettings={bgSettings}
          setBgSettings={setBgSettings}
          snapSize={snapSize}
          setSnapSize={setSnapSize}
          objects={objects}
          groups={groups}
          onRemove={handleRemove}
          onRemoveGroup={handleRemoveGroup}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdate={handleUpdate}
          onUpdateGroup={handleUpdateGroup}
          onAddGroup={handleAddGroup}
          onDuplicate={handleDuplicate}
          cameraPresets={cameraPresets}
          onSavePreset={handleSaveCameraPreset}
          onLoadPreset={handleLoadCameraPreset}
          onDeletePreset={handleDeleteCameraPreset}
        />
        
        <Viewport 
          objects={objects} 
          groups={groups}
          selectedId={selectedId} 
          onSelect={setSelectedId} 
          onRemove={handleRemove} 
          transformMode={transformMode} 
          onUpdate={handleUpdate} 
          onUpdateGroup={handleUpdateGroup}
          onUpdateMany={handleUpdateMany}
          canvasRef={canvasRef} 
          snapEnabled={snapEnabled} 
          snapSize={snapSize} 
          bgSettings={bgSettings} 
          showGrid={!isCapturing}
          activeCameraPreset={activeCameraPreset}
          onCameraPresetProcessed={() => setActiveCameraPreset(null)}
          onSetCapturedView={onSetCapturedView}
        />
        
        <AIPanel 
          prompt={prompt} 
          setPrompt={setPrompt} 
          strength={strength} 
          setStrength={setStrength} 
          onGenerate={handleGenerate} 
          isGenerating={isGenerating} 
          resultImage={resultImage} 
          onOpenPreview={() => setIsPreviewOpen(true)}
          lightingReference={lightingReference}
          setLightingReference={setLightingReference}
          stylePresets={stylePresets}
          onSaveStylePreset={handleSaveStylePreset}
          onApplyStylePreset={handleApplyStylePreset}
          onDeleteStylePreset={handleDeleteStylePreset}
        />
      </main>

      <footer className="h-8 border-t border-[#222] bg-[#0a0a0a] flex items-center justify-between px-4 z-20">
        <div className="flex gap-4 items-center">
          <span className="text-[9px] text-gray-600 font-mono uppercase">OBJECTS: {objects.length} | GROUPS: {groups.length}</span>
          {statusMessage && (
            <div className="flex items-center gap-2 text-blue-500 text-[9px] font-black uppercase tracking-widest animate-pulse">
              <ClipboardCheck size={10} />
              {statusMessage}
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <span className="text-[9px] text-gray-600 font-mono tracking-widest uppercase">CAM: Manage Viewports in "CAM" tab</span>
          <span className="text-[9px] text-blue-500 font-mono font-bold uppercase tracking-widest">Neural Pipeline</span>
        </div>
      </footer>

      {/* New Project Confirmation Modal */}
      {isNewProjectDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111] border border-[#333] p-6 rounded-xl max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setIsNewProjectDialogOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-full text-yellow-500 border border-yellow-500/20">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Start New Project?</h3>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  All unsaved progress will be permanently lost. Make sure you have exported your project JSON if you want to save it.
                </p>
              </div>
              <div className="flex gap-2 w-full mt-2">
                <button 
                  onClick={() => setIsNewProjectDialogOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[#333] hover:bg-[#222] text-[10px] font-bold text-gray-300 uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={resetProject}
                  className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-[10px] font-bold text-white uppercase tracking-widest transition-colors shadow-lg shadow-red-900/20"
                >
                  Start New
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPreviewOpen && resultImage && (
        <PreviewOverlay sourceImage={sourceImage} resultImage={resultImage} prompt={prompt} strength={strength} onClose={() => setIsPreviewOpen(false)} onSetAsBackdrop={() => handleSetAsBackdrop(resultImage)} />
      )}
    </div>
  );
};

export default App;