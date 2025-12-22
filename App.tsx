
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SceneObject, CloudAsset, TransformMode, BackgroundSettings, PrimitiveType } from './types';
import AssetPanel from './components/AssetPanel';
import AIPanel from './components/AIPanel';
import Viewport from './components/Viewport';
import PreviewOverlay from './components/PreviewOverlay';
import { processSceneToImage, sanitizeModelUrl } from './services/geminiService';
import { Layers, Move, RotateCw, Maximize, Magnet, ClipboardCheck, Undo2, Redo2 } from 'lucide-react';

const App: React.FC = () => {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapSize, setSnapSize] = useState(0.5);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Undo/Redo State
  const [history, setHistory] = useState<{ past: SceneObject[][], future: SceneObject[][] }>({
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const recordHistory = useCallback((currentState: SceneObject[]) => {
    setHistory(h => ({
      past: [...h.past, currentState].slice(-50), // Cap at 50 steps
      future: [] // Clear future when a new action is performed
    }));
  }, []);

  const handleUndo = useCallback(() => {
    setHistory(h => {
      if (h.past.length === 0) return h;
      
      const previous = h.past[h.past.length - 1];
      const newPast = h.past.slice(0, h.past.length - 1);
      
      // Save current objects to future before undoing
      const newFuture = [objects, ...h.future].slice(0, 50);
      
      setObjects(previous);
      showStatus("UNDO ACTION");
      return { past: newPast, future: newFuture };
    });
  }, [objects]);

  const handleRedo = useCallback(() => {
    setHistory(h => {
      if (h.future.length === 0) return h;
      
      const next = h.future[0];
      const newFuture = h.future.slice(1);
      
      // Save current objects to past before redoing
      const newPast = [...h.past, objects].slice(-50);
      
      setObjects(next);
      showStatus("REDO ACTION");
      return { past: newPast, future: newFuture };
    });
  }, [objects]);

  const handleAddLocal = useCallback((file: File) => {
    recordHistory(objects);
    const url = URL.createObjectURL(file);
    const newObj: SceneObject = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: url,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'local'
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newObj.id);
  }, [objects, recordHistory]);

  const handleAddCloud = useCallback((asset: CloudAsset) => {
    recordHistory(objects);
    const newObj: SceneObject = {
      id: Math.random().toString(36).substr(2, 9),
      name: asset.name,
      url: sanitizeModelUrl(asset.downloadUrl),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'cloud'
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newObj.id);
  }, [objects, recordHistory]);

  const handleAddPrimitive = useCallback((type: PrimitiveType) => {
    recordHistory(objects);
    const newObj: SceneObject = {
      id: Math.random().toString(36).substr(2, 9),
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
  }, [objects, recordHistory]);

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
    recordHistory(objects);
    const newObj: SceneObject = {
      ...clipboard,
      id: Math.random().toString(36).substr(2, 9),
      position: [clipboard.position[0] + 1, clipboard.position[1], clipboard.position[2] + 1]
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newObj.id);
    showStatus("PASTED: " + newObj.name);
  }, [clipboard, objects, recordHistory]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Transform Mode Shortcuts (T, R, S)
      if (!ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 't') setTransformMode('translate');
        if (e.key.toLowerCase() === 'r') setTransformMode('rotate');
        if (e.key.toLowerCase() === 's') setTransformMode('scale');
      }

      // Undo/Redo Shortcuts
      if (ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if (ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }

      // Copy/Paste Shortcuts
      if (ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
      }
      if (ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
      }
      
      // Delete Shortcuts
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) handleRemove(selectedId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCopy, handlePaste, handleUndo, handleRedo, selectedId]);

  const handleSetBackground = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setBgSettings(prev => ({ ...prev, url }));
  }, []);

  const handleRemove = useCallback((id: string) => {
    recordHistory(objects);
    setObjects((prev) => {
      const obj = prev.find(o => o.id === id);
      if (obj && obj.url.startsWith('blob:')) URL.revokeObjectURL(obj.url);
      return prev.filter(o => o.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
    showStatus("DELETED OBJECT");
  }, [selectedId, objects, recordHistory]);

  const handleUpdate = useCallback((id: string, updates: Partial<SceneObject>) => {
    // Record history BEFORE applying update
    // Note: Viewport calls this only on mouseUp for transformations
    recordHistory(objects);
    setObjects((prev) => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }, [objects, recordHistory]);

  const handleGenerate = async () => {
    if (!canvasRef.current) return;
    
    setIsGenerating(true);
    setIsCapturing(true); 

    try {
      const currentSelected = selectedId;
      setSelectedId(null);
      await new Promise(r => setTimeout(r, 100));
      const base64 = canvasRef.current.toDataURL('image/png');
      setSourceImage(base64);
      setIsCapturing(false);
      setSelectedId(currentSelected);

      const result = await processSceneToImage(base64, prompt, strength);
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
    showStatus("R_OUTPUT SET AS BACKDROP");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] overflow-hidden select-none">
      <header className="h-14 border-b border-[#222] bg-[#111] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <Layers className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">GEMINI SCENE BUILDER</h1>
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest opacity-80">Volumetric Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1 bg-black/30 p-1 rounded-md border border-white/5">
            <button 
              onClick={() => setTransformMode('translate')}
              className={`p-2 rounded transition-all ${transformMode === 'translate' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
              title="Translate (T)"
            >
              <Move size={16} />
            </button>
            <button 
              onClick={() => setTransformMode('rotate')}
              className={`p-2 rounded transition-all ${transformMode === 'rotate' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
              title="Rotate (R)"
            >
              <RotateCw size={16} />
            </button>
            <button 
              onClick={() => setTransformMode('scale')}
              className={`p-2 rounded transition-all ${transformMode === 'scale' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
              title="Scale (S)"
            >
              <Maximize size={16} />
            </button>
          </div>

          <div className="h-6 w-px bg-[#222]"></div>

          <div className="flex items-center gap-1 bg-black/30 p-1 rounded-md border border-white/5">
            <button 
              onClick={handleUndo}
              disabled={history.past.length === 0}
              className={`p-2 rounded transition-all ${history.past.length > 0 ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button 
              onClick={handleRedo}
              disabled={history.future.length === 0}
              className={`p-2 rounded transition-all ${history.future.length > 0 ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
          </div>

          <div className="h-6 w-px bg-[#222]"></div>

          <button 
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-[10px] font-bold uppercase tracking-widest ${snapEnabled ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}
            title="Toggle Snapping"
          >
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
          onSetBackground={handleSetBackground}
          bgSettings={bgSettings}
          setBgSettings={setBgSettings}
          snapSize={snapSize}
          setSnapSize={setSnapSize}
          objects={objects}
          onRemove={handleRemove}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdate={handleUpdate}
        />
        
        <Viewport 
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={handleRemove}
          transformMode={transformMode}
          onUpdate={handleUpdate}
          canvasRef={canvasRef}
          snapEnabled={snapEnabled}
          snapSize={snapSize}
          bgSettings={bgSettings}
          showGrid={!isCapturing}
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
        />
      </main>

      <footer className="h-8 border-t border-[#222] bg-[#0a0a0a] flex items-center justify-between px-4 z-20">
        <div className="flex gap-4 items-center">
          <span className="text-[9px] text-gray-600 font-mono uppercase">OBJECTS: {objects.length}</span>
          <div className="h-3 w-px bg-[#222]"></div>
          {statusMessage && (
            <div className="flex items-center gap-2 text-blue-500 text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-left-2 duration-300">
              <ClipboardCheck size={10} />
              {statusMessage}
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <span className="text-[9px] text-gray-600 font-mono tracking-widest uppercase">T/R/S: Transform | CTRL+Z: Undo</span>
          <span className="text-[9px] text-blue-500 font-mono font-bold uppercase tracking-widest">Neural Pipeline</span>
        </div>
      </footer>

      {isPreviewOpen && resultImage && (
        <PreviewOverlay 
          sourceImage={sourceImage}
          resultImage={resultImage}
          prompt={prompt}
          strength={strength}
          onClose={() => setIsPreviewOpen(false)}
          onSetAsBackdrop={() => handleSetAsBackdrop(resultImage)}
        />
      )}
    </div>
  );
};

export default App;
