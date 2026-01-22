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
  Torus,
  Extrude
} from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';
import { SceneObject, SceneGroup, TransformMode, BackgroundSettings, CameraPreset } from '../types';
import { RefreshCw } from 'lucide-react';

// Shared loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
const globalLoadingManager = new THREE.LoadingManager();

const Background: React.FC<{ settings: BackgroundSettings }> = ({ settings }) => {
  if (!settings.url) return null;
  return (
    <Image 
      url={settings.url} 
      position={settings.position} 
      scale={[settings.scale, settings.scale]}
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

// Helper to sanitize geometry
const cleanSceneGeometry = (scene: THREE.Object3D): boolean => {
  const invalidObjects: THREE.Object3D[] = [];
  
  scene.traverse((obj: any) => {
    // Check geometry for any object type that has it (Mesh, Line, Points, etc.)
    if (obj.geometry && obj.geometry.attributes.position) {
      const positions = obj.geometry.attributes.position.array;
      let isInvalid = false;
      
      // Check for NaN or Infinity values in position attribute
      for (let i = 0; i < positions.length; i++) {
        const val = positions[i];
        if (isNaN(val) || !isFinite(val)) {
          isInvalid = true;
          break;
        }
      }

      if (isInvalid) {
        invalidObjects.push(obj);
      }
    }
  });

  if (invalidObjects.length === 0) return true;

  // If the scene root itself is invalid, signal failure
  if (invalidObjects.includes(scene)) {
      console.warn(`Root object "${scene.name}" has invalid geometry. Discarding.`);
      return false;
  }

  // Remove invalid children
  invalidObjects.forEach(obj => {
    if (obj.parent) {
      obj.parent.remove(obj);
      console.warn(`Removed object "${obj.name}" due to invalid (NaN/Infinity) geometry data.`);
    }
  });
  
  return true;
};

// Custom Wedge Geometry (Right Prism)
const Wedge: React.FC<{ color: string, shadowProps: any }> = ({ color, shadowProps }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1, 0);
    s.lineTo(0, 1);
    s.lineTo(0, 0);
    return s;
  }, []);

  const extrudeSettings = useMemo(() => ({
    depth: 1,
    bevelEnabled: false
  }), []);

  return (
    <Extrude args={[shape, extrudeSettings]} {...shadowProps} position={[-0.5, -0.5, -0.5]}>
      <meshStandardMaterial color={color} />
    </Extrude>
  );
};

// Custom Oblique Wedge Geometry (Skewed Prism)
const ObliqueWedge: React.FC<{ color: string, shadowProps: any }> = ({ color, shadowProps }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1, 0);
    s.lineTo(0.5, 1); // Centered top vertex (Isosceles triangle profile)
    s.lineTo(0, 0);
    return s;
  }, []);

  const extrudeSettings = useMemo(() => ({
    depth: 1,
    bevelEnabled: false
  }), []);

  return (
     <Extrude args={[shape, extrudeSettings]} {...shadowProps} position={[-0.5, -0.5, -0.5]}>
      <meshStandardMaterial color={color} />
    </Extrude>
  );
};

interface ModelProps {
  obj: SceneObject;
  isLocked: boolean;
  onSelect: (id: string) => void;
  onRegisterRef: (id: string, ref: THREE.Object3D | null) => void;
}

const Model: React.FC<ModelProps> = ({ 
  obj, isLocked, onSelect, onRegisterRef
}) => {
  const { gl } = useThree();
  const [loading, setLoading] = useState(obj.type !== 'primitive');
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  
  const ktx2Loader = useMemo(() => {
    const loader = new KTX2Loader(globalLoadingManager);
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

    let isMounted = true;

    // Use a local manager to isolate errors (like missing textures in local files)
    const manager = new THREE.LoadingManager();
    manager.onError = (url) => {
        // Suppress console spam for expected texture failures in single-file imports
        if (isMounted) console.debug(`Suppressing texture load error for ${obj.name}: ${url}`);
    };

    const onLoad = (result: any) => {
        if (isMounted) {
             // Normalize result: GLTF has .scene, OBJ is the Group itself
            const scene = result.scene ? result.scene : result;
            setLoadedScene(scene);
            setLoading(false);
        }
    };
    
    const onError = (e: any) => {
        if (isMounted) {
            console.warn(`Failed to load model ${obj.name}:`, e);
            setLoading(false);
        }
    };

    if (obj.format === 'obj') {
        const loader = new OBJLoader(manager);
        loader.load(obj.url, onLoad, undefined, onError);
    } else {
        const loader = new GLTFLoader(manager);
        loader.setCrossOrigin('anonymous');
        loader.setDRACOLoader(dracoLoader);
        loader.setKTX2Loader(ktx2Loader);
        loader.load(obj.url, onLoad, undefined, onError);
    }

    return () => { isMounted = false; };
  }, [obj.url, ktx2Loader, obj.type, obj.format, obj.name]);

  const groupRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);

  // Updated Effect: Now depends on `loading` state to ensure we register
  // the ref once the real group (not the loader placeholder) is mounted.
  useEffect(() => {
    if (groupRef.current) onRegisterRef(obj.id, groupRef.current);
    return () => onRegisterRef(obj.id, null);
  }, [obj.id, onRegisterRef, loading]);

  const processedScene = useMemo(() => {
    if (obj.type === 'primitive' || !loadedScene) return null;
    const clone = loadedScene.clone(true);
    
    // 1. Sanitize geometry to prevent NaN errors in bounding box calculations
    const isValid = cleanSceneGeometry(clone);
    if (!isValid) return null;

    // Normalize logic with NaN checks
    const box = new THREE.Box3().setFromObject(clone);
    
    // Only attempt normalization if the box is valid and non-empty
    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Ensure we don't divide by zero or apply NaN values
      if (maxDim > 0 && isFinite(maxDim) && !isNaN(center.x)) {
        const scaleFactor = 1 / maxDim;
        clone.scale.setScalar(scaleFactor);
        clone.position.copy(center).multiplyScalar(-scaleFactor);
      }
    }

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
        // Locking Logic: Disable raycasting if locked
        if (isLocked) {
          o.raycast = () => null;
        }
      }
    });
    return clone;
  }, [loadedScene, obj.color, obj.type, isLocked]);

  const renderPrimitive = () => {
    const color = obj.color || '#3b82f6';
    const material = <meshStandardMaterial color={color} />;
    const shadowProps = { castShadow: true, receiveShadow: true };
    const interactionProps = { raycast: isLocked ? () => null : undefined };

    switch (obj.primitiveType) {
      case 'box': return <Box args={[1, 1, 1]} {...shadowProps} {...interactionProps}>{material}</Box>;
      case 'sphere': return <Sphere args={[0.5, 32, 32]} {...shadowProps} {...interactionProps}>{material}</Sphere>;
      case 'cylinder': return <Cylinder args={[0.5, 0.5, 1, 32]} {...shadowProps} {...interactionProps}>{material}</Cylinder>;
      case 'plane': return <Plane args={[1, 1]} {...shadowProps} {...interactionProps}>{material}</Plane>;
      case 'cone': return <Cone args={[0.5, 1, 32]} {...shadowProps} {...interactionProps}>{material}</Cone>;
      case 'torus': return <Torus args={[0.4, 0.1, 16, 100]} {...shadowProps} {...interactionProps}>{material}</Torus>;
      case 'pyramid': return <Cone args={[0.7, 1, 4]} {...shadowProps} {...interactionProps}>{material}</Cone>;
      case 'wedge': return <Wedge color={color} shadowProps={{...shadowProps, ...interactionProps}} />;
      case 'oblique-wedge': return <ObliqueWedge color={color} shadowProps={{...shadowProps, ...interactionProps}} />;
      default: return <Box args={[1, 1, 1]} {...shadowProps} {...interactionProps}>{material}</Box>;
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
      <group ref={contentRef} onPointerDown={(e) => { 
        if (isLocked) return;
        e.stopPropagation(); 
        onSelect(obj.id); 
      }}>
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
  
  // Track selectedId in a ref to access it inside callbacks without dependencies
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Store initial offsets for group transformation
  const dragOffsets = useRef<Map<string, THREE.Matrix4>>(new Map());

  // Helper to determine if an object is locked (directly or via group)
  const isObjectLocked = useCallback((obj: SceneObject) => {
    return !!(obj.locked || (obj.groupId && groups.find(g => g.id === obj.groupId)?.locked));
  }, [groups]);

  // Check if current selection is locked
  const isSelectionLocked = useMemo(() => {
    if (!selectedId) return false;
    const group = groups.find(g => g.id === selectedId);
    if (group) return !!group.locked;
    const obj = objects.find(o => o.id === selectedId);
    if (obj) return isObjectLocked(obj);
    return false;
  }, [selectedId, groups, objects, isObjectLocked]);

  // Updated Registration Logic: Checks if the incoming model is the currently 
  // selected one. If so, attaches it immediately.
  const registerModelRef = useCallback((id: string, ref: THREE.Object3D | null) => {
    if (ref) {
      modelRefs.current.set(id, ref);
      if (id === selectedIdRef.current) {
        setActiveTarget(ref);
      }
    } else {
      modelRefs.current.delete(id);
      if (id === selectedIdRef.current) {
        // Only clear if the deleted ID is the current target's ID
        setActiveTarget((prev) => {
          // If we could check prev === ref it would be ideal, but ref is null here.
          // We assume if the ID matches the selected ID, we should clear it.
          // This prevents stale references.
          return null;
        });
      }
    }
  }, []);

  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedId), [groups, selectedId]);
  const objectsInSelectedGroup = useMemo(() => objects.filter(o => o.groupId === selectedId), [objects, selectedId]);

  // --- Group Transformation Logic (Stateless Driver Approach) ---

  // When selection changes or objects update, reposition the pivot to the center of the group
  useEffect(() => {
    if (selectedGroup && pivotRef.current) {
      // 1. Calculate Bounding Box of the Group
      const box = new THREE.Box3();
      let hasObjects = false;
      objectsInSelectedGroup.forEach(obj => {
        const ref = modelRefs.current.get(obj.id);
        if (ref) {
          ref.updateMatrixWorld();
          box.expandByObject(ref);
          hasObjects = true;
        }
      });
      
      if (hasObjects && !box.isEmpty()) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        if (!isNaN(center.x)) {
           // 2. Move Pivot to Center (resetting rotation/scale to neutral)
           pivotRef.current.position.copy(center);
           pivotRef.current.rotation.set(0,0,0);
           pivotRef.current.scale.set(1,1,1);
           pivotRef.current.updateMatrixWorld();
           
           // 3. Set Pivot as the TransformControl target
           setActiveTarget(pivotRef.current);
        }
      } else {
        // Empty group, just put pivot at origin
        pivotRef.current.position.set(0,0,0);
        setActiveTarget(pivotRef.current);
      }
    } else if (selectedId) {
      // Single object selection
      const ref = modelRefs.current.get(selectedId);
      // We still try to set it here for cases where model is already loaded
      if (ref) setActiveTarget(ref);
    } else {
      setActiveTarget(null);
    }
  }, [selectedId, selectedGroup, objectsInSelectedGroup]);


  // 1. On Drag Start: Capture the relative transform of every object to the pivot
  const onTransformStart = useCallback(() => {
     setOrbitEnabled(false);
     if (selectedGroup && pivotRef.current) {
        dragOffsets.current.clear();
        pivotRef.current.updateMatrixWorld();
        const pivotInv = pivotRef.current.matrixWorld.clone().invert();
        
        objectsInSelectedGroup.forEach(obj => {
           const ref = modelRefs.current.get(obj.id);
           if (ref) {
              ref.updateMatrixWorld();
              // Calculate: LocalOffset = PivotInverse * ObjectWorld
              const localMatrix = new THREE.Matrix4().multiplyMatrices(pivotInv, ref.matrixWorld);
              dragOffsets.current.set(obj.id, localMatrix);
           }
        });
     }
  }, [selectedGroup, objectsInSelectedGroup]);

  // 2. On Drag Change: Apply transforms manually from Pivot -> Objects
  const onTransformChange = useCallback(() => {
     if (boxHelperRef.current) boxHelperRef.current.update();
     
     if (selectedGroup && pivotRef.current) {
        // The pivot has moved/rotated/scaled. Update objects to match.
        const pivotMatrix = pivotRef.current.matrixWorld;
        
        objectsInSelectedGroup.forEach(obj => {
           const ref = modelRefs.current.get(obj.id);
           const offset = dragOffsets.current.get(obj.id);
           
           if (ref && offset) {
              // NewObjectWorld = NewPivotWorld * LocalOffset
              const newWorld = new THREE.Matrix4().multiplyMatrices(pivotMatrix, offset);
              
              const pos = new THREE.Vector3();
              const quat = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              
              newWorld.decompose(pos, quat, scale);
              
              // Apply directly to the ref (bypassing React for performance/smoothness)
              ref.position.copy(pos);
              ref.quaternion.copy(quat);
              ref.scale.copy(scale);
              ref.updateMatrixWorld();
           }
        });
     }
  }, [selectedGroup, objectsInSelectedGroup]);

  // 3. On Drag End: Commit final positions to React State
  const onTransformEnd = useCallback(() => {
     setOrbitEnabled(true);
     dragOffsets.current.clear();
     
     if (selectedGroup) {
        const updates = objectsInSelectedGroup.map(obj => {
           const ref = modelRefs.current.get(obj.id);
           if (!ref) return null;
           
           // Read the final world transform we just applied
           const r = new THREE.Euler().setFromQuaternion(ref.quaternion);
           
           return {
              id: obj.id,
              updates: {
                 position: [ref.position.x, ref.position.y, ref.position.z] as [number, number, number],
                 rotation: [r.x, r.y, r.z] as [number, number, number],
                 scale: [ref.scale.x, ref.scale.y, ref.scale.z] as [number, number, number]
              }
           };
        }).filter(Boolean) as { id: string, updates: Partial<SceneObject> }[];
        
        onUpdateMany(updates);
     } else if (selectedId && activeTarget) {
         // Single object update
         const ref = activeTarget;
         const r = new THREE.Euler().setFromQuaternion(ref.quaternion);
         onUpdate(selectedId, {
             position: [ref.position.x, ref.position.y, ref.position.z],
             rotation: [r.x, r.y, r.z],
             scale: [ref.scale.x, ref.scale.y, ref.scale.z],
         });
     }
  }, [selectedGroup, objectsInSelectedGroup, onUpdate, onUpdateMany, selectedId, activeTarget]);

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

  useEffect(() => {
    (window as any).captureCurrentView = handleCaptureView;
  }, [handleCaptureView]);

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
                isLocked={isObjectLocked(obj)} 
                onSelect={onSelect} 
                onRegisterRef={registerModelRef}
              />
            ))}
          </group>

          {/* Invisible Pivot Group used as a driver for transformations */}
          <group ref={pivotRef} />

          {activeTarget && !isSelectionLocked && (
            <>
              <TransformControls 
                key={activeTarget.uuid}
                object={activeTarget}
                mode={transformMode}
                translationSnap={snapEnabled ? snapSize : null}
                rotationSnap={snapEnabled ? Math.PI / 12 : null}
                scaleSnap={snapEnabled ? (snapSize / 10) : null}
                onMouseDown={onTransformStart}
                onChange={onTransformChange}
                onMouseUp={onTransformEnd}
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
