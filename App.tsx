
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SceneObject, SceneGroup, CloudAsset, TransformMode, BackgroundSettings, PrimitiveType, CameraPreset, StylePreset, BatchConfig, BatchResultItem, ArrayConfig } from './types';
import AssetPanel from './components/AssetPanel';
import AIPanel from './components/AIPanel';
import Viewport from './components/Viewport';
import PreviewOverlay from './components/PreviewOverlay';
import BatchDialog from './components/BatchDialog';
import BatchResultViewer from './components/BatchResultViewer';
import ArrayToolDialog from './components/ArrayToolDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { processSceneToImage, sanitizeModelUrl, generatePromptVariations } from './services/geminiService';
import { Layers, Move, RotateCw, Maximize, Magnet, Undo2, Redo2, Download, Upload, FilePlus, AlertTriangle, X, Copy, Save } from 'lucide-react';
import * as THREE from 'three';

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
  // --- Workspace Identity (for Nuclear Reset) ---
  const [workspaceId, setWorkspaceId] = useState(0);

  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [groups, setGroups] = useState<SceneGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapSize, setSnapSize] = useState(0.5);
  const [isCapturing, setIsCapturing] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Project');
  
  const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>(DEFAULT_CAMERA_PRESETS);
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPreset | null>(null);
  const [currentCameraState, setCurrentCameraState] = useState<{ pos: [number, number, number], target: [number, number, number] }>({
    pos: [10, 10, 10],
    target: [0, 0, 0]
  });

  const [stylePresets, setStylePresets] = useState<StylePreset[]>(DEFAULT_STYLE_PRESETS);
  const [history, setHistory] = useState<{ past: {objs: SceneObject[], grps: SceneGroup[]}[], future: {objs: SceneObject[], grps: SceneGroup[]}[] }>({ past: [], future: [] });
  const [clipboard, setClipboard] = useState<SceneObject | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>({ url: null, position: [0, 0, -5], scale: 10, opacity: 1 });
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image');
  const [strength, setStrength] = useState(0.5);
  const [lightingReference, setLightingReference] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);
  const [isBatchResultOpen, setIsBatchResultOpen] = useState(false);
  const [isArrayToolOpen, setIsArrayToolOpen] = useState(false);
  const [arrayPreviewObjects, setArrayPreviewObjects] = useState<SceneObject[]>([]);
  const [currentArrayConfig, setCurrentArrayConfig] = useState<ArrayConfig | null>(null);

  // --- Confirmation Dialog State ---
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel: string;
    variant?: 'danger' | 'primary';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmLabel: 'Confirm',
  });

  const requestConfirm = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void, 
    confirmLabel = 'Confirm', 
    variant: 'danger' | 'primary' = 'danger'
  ) => {
    setConfirmState({ isOpen: true, title, message, onConfirm, confirmLabel, variant });
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showStatus = (msg: string) => { setStatusMessage(msg); setTimeout(() => setStatusMessage(null), 2000); };
  const recordHistory = useCallback((currObjs: SceneObject[], currGrps: SceneGroup[]) => { setHistory(h => ({ past: [...h.past, { objs: currObjs.map(o => ({ ...o })), grps: currGrps.map(g => ({ ...g })) }].slice(-50), future: [] })); }, []);

  const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36).slice(-4);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 't': setTransformMode('translate'); showStatus("MODE: TRANSLATE (T)"); break;
        case 'r': setTransformMode('rotate'); showStatus("MODE: ROTATE (R)"); break;
        case 's': setTransformMode('scale'); showStatus("MODE: SCALE (S)"); break;
        case 'z': if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleUndo(); } break;
        case 'y': if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleRedo(); } break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  // --- Project Persistence ---
  const handleSaveProject = useCallback(() => {
    const projectData = {
      version: '1.0.0',
      projectName,
      objects,
      groups,
      bgSettings,
      cameraPresets: cameraPresets.filter(p => !p.isSystem),
      stylePresets: stylePresets.filter(p => !p.isSystem),
      prompt,
      strength
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus("PROJECT SAVED");
  }, [projectName, objects, groups, bgSettings, cameraPresets, stylePresets, prompt, strength]);

  const handleLoadProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        recordHistory(objects, groups);
        setProjectName(data.projectName || 'Restored Project');
        setObjects(data.objects || []);
        setGroups(data.groups || []);
        setBgSettings(data.bgSettings || { url: null, position: [0, 0, -5], scale: 10, opacity: 1 });
        setCameraPresets([...DEFAULT_CAMERA_PRESETS, ...(data.cameraPresets || [])]);
        setStylePresets([...DEFAULT_STYLE_PRESETS, ...(data.stylePresets || [])]);
        setPrompt(data.prompt || '');
        setStrength(data.strength || 0.5);
        setSelectedId(null);
        showStatus("PROJECT LOADED");
      } catch (err) {
        showStatus("LOAD FAILED: INVALID JSON");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [objects, groups, recordHistory]);

  const handleNewProject = useCallback(() => {
    requestConfirm(
      "Start New Project",
      "Are you sure you want to start a new project? All current work, scene objects, and background settings will be permanently cleared.",
      () => {
        // 1. Force a complete re-mount of the workspace by changing the key
        setWorkspaceId(prev => prev + 1);

        // 2. Explicitly clear all application states
        setObjects([]);
        setGroups([]);
        setSelectedId(null);
        setProjectName('Untitled Project');
        
        // 3. Reset Environment & Style
        setBgSettings({ url: null, position: [0, 0, -5], scale: 10, opacity: 1 });
        setPrompt('');
        setStrength(0.5);
        setLightingReference(null);
        setResultImage(null);
        setSourceImage(null);
        
        // 4. Reset Navigation, Tools & History
        setHistory({ past: [], future: [] });
        setActiveCameraPreset(null);
        setArrayPreviewObjects([]);
        setIsGenerating(false);
        setIsCapturing(false);
        
        // 5. Reset UI specific refs/states
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        showStatus("NEW PROJECT CREATED");
      },
      "Create New Project",
      "danger"
    );
  }, [requestConfirm]);

  // --- Handlers ---
  const handleUndo = useCallback(() => {
    if (history.past.length === 0) return;
    const lastState = history.past[history.past.length - 1];
    setHistory(h => ({ past: h.past.slice(0, -1), future: [{ objs: [...objects], grps: [...groups] }, ...h.future].slice(0, 50) }));
    setObjects(lastState.objs.map(o => ({ ...o })));
    setGroups(lastState.grps.map(g => ({ ...g })));
    showStatus("UNDO ACTION");
  }, [objects, groups, history]);

  const handleRedo = useCallback(() => {
    if (history.future.length === 0) return;
    const nextState = history.future[0];
    setHistory(h => ({ past: [...h.past, { objs: [...objects], grps: [...groups] }].slice(-50), future: h.future.slice(1) }));
    setObjects(nextState.objs.map(o => ({ ...o })));
    setGroups(nextState.grps.map(g => ({ ...g })));
    showStatus("REDO ACTION");
  }, [objects, groups, history]);

  const handleDuplicate = useCallback((id: string) => {
    recordHistory(objects, groups);
    const groupToDup = groups.find(g => g.id === id);
    if (groupToDup) {
      const newGroupId = generateId();
      const newGroup: SceneGroup = { ...groupToDup, id: newGroupId, name: `${groupToDup.name} (Copy)`, position: [groupToDup.position[0] + 2, groupToDup.position[1], groupToDup.position[2] + 2] };
      const groupObjects = objects.filter(o => o.groupId === id).map((obj, i) => ({ ...obj, id: generateId() + i, groupId: newGroupId }));
      setGroups(prev => [...prev, newGroup]); setObjects(prev => [...prev, ...groupObjects]); setSelectedId(newGroupId); showStatus("DUPLICATED GROUP");
    } else {
      const objToDup = objects.find(o => o.id === id);
      if (objToDup) {
        const newObj: SceneObject = { ...objToDup, id: generateId(), name: `${objToDup.name} (Copy)`, position: [objToDup.position[0] + 1, objToDup.position[1], objToDup.position[2] + 1] };
        setObjects(prev => [...prev, newObj]); setSelectedId(newObj.id); showStatus("DUPLICATED OBJECT");
      }
    }
  }, [objects, groups, recordHistory]);

  const handleSetBackground = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setBgSettings(prev => ({ ...prev, url }));
    showStatus("BACKDROP SET");
  }, []);

  const handleRemove = useCallback((id: string) => {
    recordHistory(objects, groups);
    setObjects(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
    showStatus("OBJECT REMOVED");
  }, [objects, groups, selectedId, recordHistory]);

  const handleRemoveGroup = useCallback((id: string) => {
    recordHistory(objects, groups);
    setGroups(prev => prev.filter(g => g.id !== id));
    setObjects(prev => prev.map(o => o.groupId === id ? { ...o, groupId: undefined } : o));
    if (selectedId === id) setSelectedId(null);
    showStatus("GROUP REMOVED");
  }, [objects, groups, selectedId, recordHistory]);

  const handleUpdate = useCallback((id: string, updates: Partial<SceneObject>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }, []);

  const handleUpdateGroup = useCallback((id: string, updates: Partial<SceneGroup>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const handleUpdateMany = useCallback((updates: { id: string, updates: Partial<SceneObject> }[]) => {
    setObjects(prev => {
      const next = [...prev];
      updates.forEach(u => {
        const idx = next.findIndex(o => o.id === u.id);
        if (idx !== -1) next[idx] = { ...next[idx], ...u.updates };
      });
      return next;
    });
  }, []);

  const handleSaveCameraPreset = useCallback((name: string) => {
    const newPreset: CameraPreset = { id: generateId(), name, position: [...currentCameraState.pos], target: [...currentCameraState.target], isSystem: false };
    setCameraPresets(prev => [...prev, newPreset]);
    showStatus("VIEW SAVED");
  }, [currentCameraState]);

  const onLoadPreset = (preset: CameraPreset) => { setActiveCameraPreset(preset); showStatus(`VIEW: ${preset.name}`); };
  const onDeletePreset = (id: string) => { setCameraPresets(prev => prev.filter(p => p.id !== id)); showStatus("VIEW DELETED"); };
  const handleApplyStylePreset = useCallback((preset: StylePreset) => { setPrompt(preset.prompt); setStrength(preset.strength); showStatus(`STYLE APPLIED: ${preset.name}`); }, []);

  const handleArrayUpdate = useCallback((config: ArrayConfig) => {
    setCurrentArrayConfig(config);
    if (!selectedId) return;
    const target = objects.find(o => o.id === selectedId) || groups.find(g => g.id === selectedId);
    if (!target) return;
    const ghosts: SceneObject[] = [];
    const rng = () => (Math.random() - 0.5) * 2;
    if (config.type === 'linear') {
      for (let i = 1; i < config.linearCount; i++) {
        const pos: [number, number, number] = [target.position[0] + config.linearOffset[0] * i + rng() * config.randomPos[0], target.position[1] + config.linearOffset[1] * i + rng() * config.randomPos[1], target.position[2] + config.linearOffset[2] * i + rng() * config.randomPos[2]];
        const rot: [number, number, number] = [target.rotation[0] + (config.linearRotation[0] * Math.PI / 180) * i + rng() * (config.randomRot[0] * Math.PI / 180), target.rotation[1] + (config.linearRotation[1] * Math.PI / 180) * i + rng() * (config.randomRot[1] * Math.PI / 180), target.rotation[2] + (config.linearRotation[2] * Math.PI / 180) * i + rng() * (config.randomRot[2] * Math.PI / 180)];
        const scl: [number, number, number] = [target.scale[0] * Math.pow(config.linearScale[0], i) + rng() * config.randomScale[0], target.scale[1] * Math.pow(config.linearScale[1], i) + rng() * config.randomScale[1], target.scale[2] * Math.pow(config.linearScale[2], i) + rng() * config.randomScale[2]];
        const obj = objects.find(o => o.id === selectedId);
        const group = groups.find(g => g.id === selectedId);
        if (obj) ghosts.push({ ...obj, id: `ghost-${i}`, position: pos, rotation: rot, scale: scl, locked: true, groupId: undefined });
        else if (group) objects.filter(o => o.groupId === group.id).forEach((co, idx) => ghosts.push({ ...co, id: `ghost-${i}-${idx}`, position: pos, rotation: rot, scale: scl, locked: true, groupId: undefined }));
      }
    } else if (config.type === 'radial') {
      for (let i = 1; i < config.radialCount; i++) {
        const angle = (config.radialStartAngle + (i * config.radialArc / config.radialCount)) * (Math.PI / 180);
        const pos: [number, number, number] = [target.position[0] + Math.cos(angle) * config.radialRadius + rng() * config.randomPos[0], target.position[1] + i * config.radialHeightOffset + rng() * config.randomPos[1], target.position[2] + Math.sin(angle) * config.radialRadius + rng() * config.randomPos[2]];
        let rot: [number, number, number] = [target.rotation[0], target.rotation[1], target.rotation[2]];
        if (config.radialFaceCenter) rot[1] = -angle + Math.PI / 2;
        const obj = objects.find(o => o.id === selectedId);
        const group = groups.find(g => g.id === selectedId);
        if (obj) ghosts.push({ ...obj, id: `ghost-${i}`, position: pos, rotation: rot, locked: true, groupId: undefined });
        else if (group) objects.filter(o => o.groupId === group.id).forEach((co, idx) => ghosts.push({ ...co, id: `ghost-${i}-${idx}`, position: pos, rotation: rot, locked: true, groupId: undefined }));
      }
    } else if (config.type === 'grid') {
      for (let y = 0; y < config.gridLayers; y++) {
        for (let z = 0; z < config.gridCols; z++) {
          for (let x = 0; x < config.gridRows; x++) {
            if (x === 0 && y === 0 && z === 0) continue;
            const pos: [number, number, number] = [target.position[0] + x * config.gridSpacing[0] + rng() * config.randomPos[0], target.position[1] + y * config.gridSpacing[1] + rng() * config.randomPos[1], target.position[2] + z * config.gridSpacing[2] + rng() * config.randomPos[2]];
            const obj = objects.find(o => o.id === selectedId);
            const group = groups.find(g => g.id === selectedId);
            if (obj) ghosts.push({ ...obj, id: `ghost-${x}-${y}-${z}`, position: pos, locked: true, groupId: undefined });
            else if (group) objects.filter(o => o.groupId === group.id).forEach((co, idx) => ghosts.push({ ...co, id: `ghost-${x}-${y}-${z}-${idx}`, position: pos, locked: true, groupId: undefined }));
          }
        }
      }
    }
    setArrayPreviewObjects(ghosts);
  }, [selectedId, objects, groups]);

  const handleArrayApply = useCallback((asGroup: boolean) => {
    if (!currentArrayConfig || !selectedId) return;
    recordHistory(objects, groups);
    const target = objects.find(o => o.id === selectedId) || groups.find(g => g.id === selectedId);
    if (!target) return;
    const newObjs: SceneObject[] = arrayPreviewObjects.map(ghost => ({ ...ghost, id: generateId(), locked: false }));
    if (asGroup) {
      const gid = generateId();
      setGroups(prev => [...prev, { id: gid, name: `${target.name} Array`, isOpen: true, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }]);
      setObjects(prev => [...prev, ...newObjs.map(no => ({ ...no, groupId: gid }))]);
    } else setObjects(prev => [...prev, ...newObjs]);
    setArrayPreviewObjects([]);
    setIsArrayToolOpen(false);
    showStatus(`CREATED ${newObjs.length} CLONES`);
  }, [currentArrayConfig, selectedId, objects, groups, arrayPreviewObjects, recordHistory]);

  const handleGenerate = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    setRenderError(null);
    setIsCapturing(true);
    const originalSelectedId = selectedId;
    setSelectedId(null);
    try {
      await new Promise(r => setTimeout(r, 400));
      const base64 = canvasRef.current.toDataURL('image/png', 1.0);
      setSourceImage(base64);
      const result = await processSceneToImage(base64, prompt, strength, objects, groups, currentCameraState.pos, currentCameraState.target, lightingReference, selectedModel);
      if (result) { 
        setResultImage(result); 
        setIsPreviewOpen(true); 
      } else {
        setRenderError("Failed to generate image from Gemini response.");
        showStatus("RENDER FAILED");
      }
    } catch (err: any) { 
      setRenderError(err?.message || "Generation error occurred.");
      showStatus("GEN ERROR"); 
    } finally { 
      setIsCapturing(false); 
      setSelectedId(originalSelectedId); 
      setIsGenerating(false); 
    }
  };

  const handleBatchGenerate = async (config: BatchConfig) => {
    if (!canvasRef.current) return;
    setIsBatchDialogOpen(false);
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: 0 });
    setBatchResults([]);

    const originalSelectedId = selectedId;
    setSelectedId(null);
    
    try {
      await new Promise(r => setTimeout(r, 400));
      const base64 = canvasRef.current.toDataURL('image/png', 1.0);
      setSourceImage(base64);

      const tasks: { prompt: string, strength: number }[] = [];

      if (config.mode === 'iteration') {
        for (let i = 0; i < config.count; i++) tasks.push({ prompt, strength });
      } else if (config.mode === 'strength') {
        const { start, end, steps } = config.strengthRange;
        for (let i = 0; i < steps; i++) {
          const s = steps > 1 ? start + (end - start) * (i / (steps - 1)) : start;
          tasks.push({ prompt, strength: s });
        }
      } else if (config.mode === 'prompt') {
        const variations = await generatePromptVariations(prompt, config.count);
        variations.forEach(v => tasks.push({ prompt: v, strength }));
      } else if (config.mode === 'preset') {
        config.selectedPresetIds.forEach(id => {
          const p = stylePresets.find(sp => sp.id === id);
          if (p) tasks.push({ prompt: p.prompt, strength: p.strength });
        });
      }

      setBatchProgress({ current: 0, total: tasks.length });
      const results: BatchResultItem[] = [];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        try {
          const res = await processSceneToImage(
            base64, 
            task.prompt, 
            task.strength, 
            objects, 
            groups, 
            currentCameraState.pos, 
            currentCameraState.target, 
            lightingReference,
            selectedModel
          );
          if (res) {
            results.push({
              id: generateId(),
              imageUrl: res,
              metadata: `${task.prompt.substring(0, 40)}... (S: ${task.strength.toFixed(2)})`,
              timestamp: Date.now()
            });
          }
        } catch (err) {
          console.error("Batch task failed:", err);
        }
        setBatchProgress(p => ({ ...p, current: i + 1 }));
      }

      setBatchResults(results);
      if (results.length > 0) setIsBatchResultOpen(true);
      else showStatus("BATCH FAILED");
    } catch (err) {
      showStatus("BATCH ERROR");
    } finally {
      setIsBatchProcessing(false);
      setSelectedId(originalSelectedId);
    }
  };

  const handleAddLocal = (file: File) => { recordHistory(objects, groups); const url = URL.createObjectURL(file); setObjects(prev => [...prev, { id: generateId(), name: file.name.split('.')[0], url, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], type: 'local', format: 'glb' }]); };
  const handleAddCloud = (asset: CloudAsset) => { recordHistory(objects, groups); setObjects(prev => [...prev, { id: generateId(), name: asset.name, url: sanitizeModelUrl(asset.downloadUrl || ''), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], type: 'cloud', format: 'glb' }]); };
  const handleAddPrimitive = (type: PrimitiveType) => { recordHistory(objects, groups); setObjects(prev => [...prev, { id: generateId(), name: type.toUpperCase(), url: '', position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], type: 'primitive', primitiveType: type, color: '#3b82f6' }]); };
  const handleAddTerrain = () => { recordHistory(objects, groups); setObjects(prev => [...prev, { id: generateId(), name: "TERRAIN", url: '', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], type: 'terrain', terrainData: { method: 'procedural', width: 10, depth: 10, heightScale: 3, segments: 64, noiseScale: 1, octaves: 3, persistence: 0.5, lacunarity: 2, seed: Math.random(), edgeFalloff: 'none', falloffDistance: 0.2, invert: false, smoothness: 0 } }]); };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] overflow-hidden select-none text-white">
      <header className="h-14 border-b border-[#222] bg-[#111] flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg"><Layers className="text-white" size={18} /></div>
            <div className="flex flex-col">
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold text-white uppercase focus:ring-0 outline-none w-48" />
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">GEMINI 3D BUILDER</p>
            </div>
          </div>
          <div className="flex gap-1 bg-black/30 p-1 rounded-md border border-white/5">
            <button onClick={handleNewProject} className="p-2 text-gray-500 hover:text-white transition-colors" title="New Project"><FilePlus size={16} /></button>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-white transition-colors" title="Open Project"><Upload size={16} /></button>
            <button onClick={handleSaveProject} className="p-2 text-gray-500 hover:text-white transition-colors" title="Save Project"><Save size={16} /></button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleLoadProject} />
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex gap-1 bg-black/30 p-1 rounded-md border border-white/5">
            <button onClick={() => setTransformMode('translate')} className={`p-2 rounded ${transformMode === 'translate' ? 'bg-blue-600' : 'text-gray-500'}`} title="Translate (T)"><Move size={16} /></button>
            <button onClick={() => setTransformMode('rotate')} className={`p-2 rounded ${transformMode === 'rotate' ? 'bg-blue-600' : 'text-gray-500'}`} title="Rotate (R)"><RotateCw size={16} /></button>
            <button onClick={() => setTransformMode('scale')} className={`p-2 rounded ${transformMode === 'scale' ? 'bg-blue-600' : 'text-gray-500'}`} title="Scale (S)"><Maximize size={16} /></button>
           </div>
           <div className="flex gap-1 bg-black/30 p-1 rounded-md border border-white/5">
             <button onClick={handleUndo} className="p-2 text-gray-500 hover:text-white" disabled={history.past.length === 0} title="Undo (Ctrl+Z)"><Undo2 size={16}/></button>
             <button onClick={handleRedo} className="p-2 text-gray-500 hover:text-white" disabled={history.future.length === 0} title="Redo (Ctrl+Y)"><Redo2 size={16}/></button>
           </div>
           <button onClick={() => setSnapEnabled(!snapEnabled)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${snapEnabled ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-gray-500 bg-[#1a1a1a]'}`}>Snap {snapEnabled?'ON':'OFF'}</button>
        </div>
      </header>
      {statusMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest animate-in fade-in zoom-in duration-200 shadow-xl">
          {statusMessage}
        </div>
      )}
      <main key={workspaceId} className="flex-1 flex overflow-hidden relative">
        <AssetPanel 
          onAddLocal={handleAddLocal} onAddCloud={handleAddCloud} onAddPrimitive={handleAddPrimitive} onAddTerrain={handleAddTerrain} onSetBackground={handleSetBackground} bgSettings={bgSettings} setBgSettings={setBgSettings} 
          snapSize={snapSize} setSnapSize={setSnapSize} objects={objects} groups={groups} onRemove={handleRemove} onRemoveGroup={handleRemoveGroup} selectedId={selectedId} onSelect={setSelectedId} onUpdate={handleUpdate} onUpdateGroup={handleUpdateGroup} onAddGroup={() => setGroups(p => [...p, { id: generateId(), name: "NEW GROUP", isOpen: true, position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] }])} onDuplicate={handleDuplicate} cameraPresets={cameraPresets} onSavePreset={handleSaveCameraPreset} onLoadPreset={onLoadPreset} onDeletePreset={onDeletePreset} onOpenArrayTool={() => { if (selectedId) setIsArrayToolOpen(true); else showStatus("SELECT AN OBJECT FIRST"); }}
        />
        <Viewport objects={objects} groups={groups} selectedId={selectedId} onSelect={setSelectedId} onRemove={handleRemove} transformMode={transformMode} onUpdate={handleUpdate} onUpdateGroup={handleUpdateGroup} onUpdateMany={handleUpdateMany} canvasRef={canvasRef} snapEnabled={snapEnabled} snapSize={snapSize} bgSettings={bgSettings} activeCameraPreset={activeCameraPreset} onCameraPresetProcessed={() => setActiveCameraPreset(null)} onSetCapturedView={(pos, target) => setCurrentCameraState({ pos, target })} previewObjects={arrayPreviewObjects} isCapturing={isCapturing} />
        <AIPanel prompt={prompt} setPrompt={setPrompt} strength={strength} setStrength={setStrength} onGenerate={handleGenerate} isGenerating={isGenerating} renderError={renderError} setRenderError={setRenderError} resultImage={resultImage} onOpenPreview={() => setIsPreviewOpen(true)} lightingReference={lightingReference} setLightingReference={setLightingReference} onOpenBatch={() => setIsBatchDialogOpen(true)} stylePresets={stylePresets} onSaveStylePreset={() => {}} onApplyStylePreset={handleApplyStylePreset} onDeleteStylePreset={() => {}} requestConfirm={requestConfirm} selectedModel={selectedModel} onSelectModel={setSelectedModel} />
        {isArrayToolOpen && <ArrayToolDialog onClose={() => { setIsArrayToolOpen(false); setArrayPreviewObjects([]); }} onUpdate={handleArrayUpdate} onApply={handleArrayApply} />}
      </main>
      {isPreviewOpen && resultImage && <PreviewOverlay sourceImage={sourceImage} resultImage={resultImage} prompt={prompt} strength={strength} onClose={() => setIsPreviewOpen(false)} onSetAsBackdrop={() => { setBgSettings(prev => ({ ...prev, url: resultImage })); setIsPreviewOpen(false); }} />}
      {isBatchDialogOpen && <BatchDialog onClose={() => setIsBatchDialogOpen(false)} onStart={handleBatchGenerate} presets={stylePresets} />}
      
      {/* Batch Processing Overlay */}
      {isBatchProcessing && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
           <div className="w-64 space-y-4">
              <div className="flex justify-between text-[10px] text-gray-500 font-black uppercase">
                 <span>Batch Processing</span>
                 <span>{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <div className="w-full h-1 bg-[#222] rounded-full overflow-hidden">
                 <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${(batchProgress.current / (batchProgress.total || 1)) * 100}%` }}></div>
              </div>
              <p className="text-[9px] text-gray-600 text-center uppercase font-bold animate-pulse">Neural Render Engine Active</p>
           </div>
        </div>
      )}
      {/* Batch Results Viewer */}
      {isBatchResultOpen && (
        <BatchResultViewer 
          results={batchResults} 
          sourceImage={sourceImage} 
          onClose={() => setIsBatchResultOpen(false)} 
          onSetBackdrop={(url) => { setBgSettings(prev => ({ ...prev, url })); setIsBatchResultOpen(false); }} 
          onDiscard={(id) => setBatchResults(prev => prev.filter(r => r.id !== id))} 
        />
      )}

      {/* Global Confirmation Dialog */}
      <ConfirmDialog 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        variant={confirmState.variant}
      />
    </div>
  );
};

export default App;
