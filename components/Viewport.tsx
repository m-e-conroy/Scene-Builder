
import React, { Suspense, useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  TransformControls, 
  Environment, 
  ContactShadows, 
  Grid,
  Html,
  Image,
  Box,
  Sphere,
  Cylinder,
  Plane,
  Cone,
  Torus
} from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';
import { SceneObject, SceneGroup, TransformMode, BackgroundSettings, CameraPreset } from '../types';
import { RefreshCw } from 'lucide-react';

// Shared loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
const loadingManager = new THREE.LoadingManager();

const Background: React.FC<{ settings: BackgroundSettings }> = ({ settings }) => {
  if (!settings.url) return null;
  return (
    <Image 
      url={settings.url} 
      position={settings.position} 
      scale={[settings.scale, settings.scale, 1]}
      transparent
      opacity={settings.opacity}
      toneMapped={false}
      renderOrder={-1} 
      raycast={() => null}
    />
  );
};

// Internal Camera Manager to handle transitions
const CameraManager: React.FC<{ 
  activePreset: CameraPreset | null, 
  onPresetProcessed: () => void,
  controlsRef: React.RefObject<any>
}> = ({ activePreset, onPresetProcessed, controlsRef }) => {
  const { camera } = useThree();
  
  useFrame(() => {
    if (activePreset) {
      const targetPos = new THREE.Vector3(...activePreset.position);
      const targetFocus = new THREE.Vector3(...activePreset.target);
      
      // Smooth interpolation
      camera.position.lerp(targetPos, 0.1);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetFocus, 0.1);
        controlsRef.current.update();
      }

      // Check if we're close enough to stop the lerp
      if (camera.position.distanceTo(targetPos) < 0.01) {
        onPresetProcessed();
      }
    }
  });

  return null;
};

interface ModelProps {
  obj: SceneObject;
  onSelect: (id: string) => void;
  onRegisterRef: (id: string, ref: THREE.Object3D | null) => void;
}

const Model: React.FC<ModelProps> = ({ 
  obj, onSelect, onRegisterRef
}) => {
  const { gl } = useThree();
  const [loading, setLoading] = useState(obj.type !== 'primitive');
  const [loadedGltf, setLoadedGltf] = useState<any>(null);
  
  const ktx2Loader = useMemo(() => {
    const loader = new KTX2Loader(loadingManager);
    loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/basis/');
    loader.detectSupport(gl);
    return loader;
  }, [gl]);

  useEffect(() => {
    if (obj.type === 'primitive') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const loader = new GLTFLoader(loadingManager);
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2Loader);
    let isMounted = true;
    loader.load(obj.url, (gltf) => {
      if (isMounted) {
        setLoadedGltf(gltf);
        setLoading(false);
      }
    }, undefined, () => {
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, [obj.url, ktx2Loader, obj.type]);

  const groupRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (groupRef.current) onRegisterRef(obj.id, groupRef.current);
    return () => onRegisterRef(obj.id, null);
  }, [obj.id, onRegisterRef]);

  const processedScene = useMemo(() => {
    if (obj.type === 'primitive' || !loadedGltf) return null;
    const clone = loadedGltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = maxDim > 0 ? (1 / maxDim) : 1;
    clone.scale.setScalar(scaleFactor);
    clone.position.copy(center).multiplyScalar(-scaleFactor);
    clone.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          const cm = m.clone();
          if (obj.color && cm.color) cm.color.set(obj.color);
          o.material = cm;
        }
      }
    });
    return clone;
  }, [loadedGltf, obj.color, obj.type]);

  const renderPrimitive = () => {
    const material = <meshStandardMaterial color={obj.color || '#3b82f6'} castShadow receiveShadow />;
    switch (obj.primitiveType) {
      case 'box': return <Box args={[1, 1, 1]}>{material}</Box>;
      case 'sphere': return <Sphere args={[0.5, 32, 32]}>{material}</Sphere>;
      case 'cylinder': return <Cylinder args={[0.5, 0.5, 1, 32]}>{material}</Cylinder>;
      case 'plane': return <Plane args={[1, 1]}>{material}</Plane>;
      case 'cone': return <Cone args={[0.5, 1, 32]}>{material}</Cone>;
      case 'torus': return <Torus args={[0.4, 0.1, 16, 100]}>{material}</Torus>;
      case 'pyramid': return <Cone args={[0.7, 1, 4]}>{material}</Cone>;
      default: return <Box args={[1, 1, 1]}>{material}</Box>;
    }
  };

  if (loading) {
    return (
      <group position={obj.position}>
        <Html center>
          <div className="flex items-center gap-2 bg-black/80 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
            <RefreshCw size={10} className="text-blue-500 animate-spin" />
            <span className="text-[8px] text-white font-black uppercase tracking-widest whitespace-nowrap">Syncing...</span>
          </div>
        </Html>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={obj.position} rotation={obj.rotation} scale={obj.scale}>
      <group ref={contentRef} onPointerDown={(e) => { e.stopPropagation(); onSelect(obj.id); }}>
        {obj.type === 'primitive' ? renderPrimitive() : (processedScene && <primitive object={processedScene} />)}
      </group>
    </group>
  );
};

interface ViewportProps {
  objects: SceneObject[];
  groups: SceneGroup[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  transformMode: TransformMode;
  onUpdate: (id: string, updates: Partial<SceneObject>) => void;
  onUpdateMany: (updates: { id: string, updates: Partial<SceneObject> }[]) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  snapEnabled: boolean;
  snapSize: number;
  bgSettings: BackgroundSettings;
  showGrid?: boolean;
  activeCameraPreset: CameraPreset | null;
  onCameraPresetProcessed: () => void;
  onSetCapturedView: (pos: [number, number, number], target: [number, number, number]) => void;
}

const Viewport: React.FC<ViewportProps> = ({ 
  objects, groups, selectedId, onSelect, onRemove, transformMode, onUpdate, onUpdateMany, canvasRef, 
  snapEnabled, snapSize, bgSettings, showGrid = true, 
  activeCameraPreset, onCameraPresetProcessed, onSetCapturedView
}) => {
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const modelRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  const pivotRef = useRef<THREE.Group>(null);
  const boxHelperRef = useRef<THREE.BoxHelper>(null);
  const orbitControlsRef = useRef<any>(null);
  const [activeTarget, setActiveTarget] = useState<THREE.Object3D | null>(null);
  
  // Track last pivot state for live group transformation
  const lastPivotPos = useRef(new THREE.Vector3());

  const registerModelRef = useCallback((id: string, ref: THREE.Object3D | null) => {
    if (ref) modelRefs.current.set(id, ref);
    else modelRefs.current.delete(id);
    
    // Auto-attach if this is the object that was just selected
    if (id === selectedId && !groups.find(g => g.id === id)) {
      setActiveTarget(ref);
    }
  }, [selectedId, groups]);

  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedId), [groups, selectedId]);
  const objectsInSelectedGroup = useMemo(() => objects.filter(o => o.groupId === selectedId), [objects, selectedId]);

  const groupCenter = useMemo(() => {
    if (!selectedGroup || objectsInSelectedGroup.length === 0) return new THREE.Vector3(0, 0, 0);
    const box = new THREE.Box3();
    objectsInSelectedGroup.forEach(obj => {
      const ref = modelRefs.current.get(obj.id);
      if (ref) box.expandByObject(ref);
      else box.expandByPoint(new THREE.Vector3(...obj.position));
    });
    return box.getCenter(new THREE.Vector3());
  }, [selectedGroup, objectsInSelectedGroup]);

  // Sync active target and pivot position when selection changes
  useEffect(() => {
    if (!selectedId) {
      setActiveTarget(null);
    } else if (selectedGroup) {
      if (pivotRef.current) {
        pivotRef.current.position.copy(groupCenter);
        pivotRef.current.rotation.set(0, 0, 0);
        pivotRef.current.scale.set(1, 1, 1);
        lastPivotPos.current.copy(groupCenter);
        setActiveTarget(pivotRef.current);
      }
    } else {
      const ref = modelRefs.current.get(selectedId);
      if (ref) setActiveTarget(ref);
    }
  }, [selectedId, selectedGroup, groupCenter]);

  // Expose current camera view for saving
  const handleCaptureView = useCallback(() => {
    if (orbitControlsRef.current) {
      const cam = orbitControlsRef.current.object;
      const target = orbitControlsRef.current.target;
      onSetCapturedView(
        [cam.position.x, cam.position.y, cam.position.z],
        [target.x, target.y, target.z]
      );
    }
  }, [onSetCapturedView]);

  // We'll call this when user saves a preset in AssetPanel
  useEffect(() => {
    (window as any).captureCurrentView = handleCaptureView;
  }, [handleCaptureView]);

  const handleTransformChange = useCallback(() => {
    // 1. Update the visible bounding box helper immediately
    if (boxHelperRef.current) {
      boxHelperRef.current.update();
    }
    
    // 2. If moving a group, move all children in real-time
    if (selectedGroup && activeTarget === pivotRef.current && pivotRef.current) {
      const currentPos = pivotRef.current.position;
      const delta = currentPos.clone().sub(lastPivotPos.current);
      
      objectsInSelectedGroup.forEach(obj => {
        const ref = modelRefs.current.get(obj.id);
        if (ref) {
          ref.position.add(delta);
        }
      });
      
      lastPivotPos.current.copy(currentPos);
    }
  }, [selectedGroup, activeTarget, objectsInSelectedGroup]);

  const onTransformEnd = useCallback(() => {
    setOrbitEnabled(true);
    if (!selectedId || !activeTarget) return;

    if (selectedGroup) {
      // Finalize all member positions in React state
      const updates = objectsInSelectedGroup.map(obj => {
        const ref = modelRefs.current.get(obj.id);
        return {
          id: obj.id,
          updates: { 
            position: ref ? [ref.position.x, ref.position.y, ref.position.z] as [number, number, number] : obj.position
          }
        };
      });
      onUpdateMany(updates);
    } else {
      // Finalize single object transformation
      onUpdate(selectedId, {
        position: [activeTarget.position.x, activeTarget.position.y, activeTarget.position.z],
        rotation: [activeTarget.rotation.x, activeTarget.rotation.y, activeTarget.rotation.z],
        scale: [activeTarget.scale.x, activeTarget.scale.y, activeTarget.scale.z],
      });
    }
  }, [selectedId, selectedGroup, objectsInSelectedGroup, onUpdate, onUpdateMany, activeTarget]);

  return (
    <div className="flex-1 h-full relative bg-[#050505] overflow-hidden">
      <Canvas 
        shadows 
        camera={{ position: [5, 5, 5], fov: 45 }} 
        dpr={[1, 1.5]}
        gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance' }} 
        onPointerMissed={() => onSelect(null)}
        ref={canvasRef}
      >
        <color attach="background" args={['#080808']} />
        <ambientLight intensity={1.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} intensity={100} castShadow />
        
        <Suspense fallback={<Html center><div className="flex flex-col items-center gap-4 bg-black/90 p-8 rounded-2xl border border-white/10"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div><span className="text-[10px] text-white font-black tracking-widest uppercase">Warming Up GPU...</span></div></Html>}>
          <Background settings={bgSettings} />
          
          <group>
            {objects.map((obj) => (
              <Model 
                key={obj.id} 
                obj={obj} 
                onSelect={onSelect} 
                onRegisterRef={registerModelRef}
              />
            ))}
          </group>

          <group ref={pivotRef} />

          {activeTarget && (
            <>
              <TransformControls 
                object={activeTarget}
                mode={transformMode}
                translationSnap={snapEnabled ? snapSize : null}
                rotationSnap={snapEnabled ? Math.PI / 12 : null}
                scaleSnap={snapEnabled ? (snapSize / 10) : null}
                onMouseDown={() => setOrbitEnabled(false)}
                onMouseUp={onTransformEnd}
                onChange={handleTransformChange}
              />
              <boxHelper 
                ref={boxHelperRef} 
                args={[activeTarget, selectedGroup ? 0x2563eb : 0x3b82f6]} 
              />
            </>
          )}

          <Environment preset="city" />
          <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2.4} far={4.5} />
          
          <CameraManager 
            activePreset={activeCameraPreset} 
            onPresetProcessed={onCameraPresetProcessed} 
            controlsRef={orbitControlsRef} 
          />
        </Suspense>

        <OrbitControls ref={orbitControlsRef} makeDefault enabled={orbitEnabled} maxPolarAngle={Math.PI / 2.1} />
        {showGrid && <Grid infiniteGrid fadeDistance={30} cellSize={snapSize} sectionSize={snapSize * 5} sectionThickness={1.5} sectionColor="#333" cellColor="#222" />}
      </Canvas>
    </div>
  );
};

export default Viewport;
