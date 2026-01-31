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
  Extrude,
  Capsule,
  Octahedron,
  Dodecahedron,
  Tube,
  Icosahedron,
  Tetrahedron
} from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';
import { SceneObject, SceneGroup, TransformMode, BackgroundSettings, CameraPreset } from '../types';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import ProceduralTerrain from './ProceduralTerrain';

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

// Custom Pentagrammic Prism (Star Prism)
const PentagrammicPrism: React.FC<{ color: string, shadowProps: any }> = ({ color, shadowProps }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const points = 5;
    const outerRadius = 0.5;
    const innerRadius = 0.25;
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const a = (i / points) * Math.PI;
        // Rotate -90 degrees to point up
        const x = Math.cos(a + Math.PI / 2 * 3) * r;
        const y = Math.sin(a + Math.PI / 2 * 3) * r;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }, []);

  const extrudeSettings = useMemo(() => ({
    depth: 1,
    bevelEnabled: false
  }), []);

  // Center the geometry
  return (
    <Extrude args={[shape, extrudeSettings]} {...shadowProps} position={[0, 0, -0.5]}>
      <meshStandardMaterial color={color} />
    </Extrude>
  );
};

// Custom Pipe (Tube) Geometry using ExtrudeGeometry with a hole
const Pipe: React.FC<{ color: string, shadowProps: any }> = ({ color, shadowProps }) => {
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        shape.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, 0.35, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 32 });
    }, []);

    // Center and orient to match Cylinder (upright Y)
    return (
        <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.5, 0.5]} {...shadowProps}>
           <meshStandardMaterial color={color} />
        </mesh>
    );
};

// Custom Helix Geometry using Tube
const Helix: React.FC<{ color: string, shadowProps: any }> = ({ color, shadowProps }) => {
    const path = useMemo(() => {
        const points = [];
        for (let i = 0; i <= 100; i++) {
            const t = i / 100;
            const angle = 2 * Math.PI * 3 * t; // 3 turns
            const x = Math.cos(angle) * 0.3;
            const z = Math.sin(angle) * 0.3;
            const y = (t - 0.5) * 1; // Height 1, centered
            points.push(new THREE.Vector3(x, y, z));
        }
        return new THREE.CatmullRomCurve3(points);
    }, []);

    return (
        <Tube args={[path, 64, 0.08, 12, false]} {...shadowProps}>
            <meshStandardMaterial color={color} />
        </Tube>
    );
};

interface ModelProps {
  obj: SceneObject;
  isLocked: boolean;
  isVisible: boolean;
  onSelect: (id: string) => void;
  onRegisterRef: (id: string, ref: THREE.Object3D | null) => void;
}

const Model: React.FC<ModelProps> = ({ 
  obj, isLocked, isVisible, onSelect, onRegisterRef
}) => {
  const { gl } = useThree();
  const [loading, setLoading] = useState(obj.type !== 'primitive' && obj.type !== 'terrain');
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  const [hasError, setHasError] = useState(false);
  
  const ktx2Loader = useMemo(() => {
    const loader = new KTX2Loader(globalLoadingManager);
    loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/basis/');
    loader.detectSupport(gl);
    return loader;
  }, [gl]);

  useEffect(() => {
    if (obj.type === 'primitive' || obj.type === 'terrain') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setHasError(false);

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
            setHasError(true);
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
  }, [obj.id, onRegisterRef, loading, hasError]);

  const processedScene = useMemo(() => {
    if ((obj.type === 'primitive' || obj.type === 'terrain') || !loadedScene) return null;
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
      case 'tube': return <Pipe color={color} shadowProps={{...shadowProps, ...interactionProps}} />;
      case 'capsule': return <Capsule args={[0.3, 1, 4, 16]} {...shadowProps} {...interactionProps}>{material}</Capsule>;
      case 'hemisphere': return <Sphere args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} {...shadowProps} {...interactionProps}>{material}</Sphere>;
      case 'octahedron': return <Octahedron args={[0.6]} {...shadowProps} {...interactionProps}>{material}</Octahedron>;
      case 'dodecahedron': return <Dodecahedron args={[0.6]} {...shadowProps} {...interactionProps}>{material}</Dodecahedron>;
      case 'helix': return <Helix color={color} shadowProps={{...shadowProps, ...interactionProps}} />;
      case 'polyhedron': return <Icosahedron args={[0.6]} {...shadowProps} {...interactionProps}>{material}</Icosahedron>;
      case 'pentagrammic-prism': return <PentagrammicPrism color={color} shadowProps={{...shadowProps, ...interactionProps}} />;
      case 'octagonal-pyramid': return <Cylinder args={[0, 0.5, 1, 8]} {...shadowProps} {...interactionProps}>{material}</Cylinder>;
      case 'tetrahedron': return <Tetrahedron args={[0.6]} {...shadowProps} {...interactionProps}>{material}</Tetrahedron>;
      case 'conical-frustum': return <Cylinder args={[0.25, 0.5, 1, 32]} {...shadowProps} {...interactionProps}>{material}</Cylinder>;
      default: return <Box args={[1, 1, 1]} {...shadowProps} {...interactionProps}>{material}</Box>;
    }
  };

  const renderContent = () => {
    if (obj.type === 'terrain' && obj.terrainData) {
      return (
        <ProceduralTerrain 
          data={obj.terrainData} 
          color={obj.color} 
          shadowProps={{ castShadow: true, receiveShadow: true }}
          interactionProps={{ raycast: isLocked ? () => null : undefined }}
        />
      );
    }
    if (obj.type === 'primitive') {
      return renderPrimitive();
    }
    return processedScene && <primitive object={processedScene} />;
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

  if (hasError) {
    return (
      <group ref={groupRef} position={obj.position} rotation={obj.rotation} scale={obj.scale} visible={isVisible}>
        <group ref={contentRef} onPointerDown={(e) => { 
            if (isLocked || !isVisible) return;
            e.stopPropagation(); 
            onSelect(obj.id); 
        }}>
           <Html center>
              <div className="flex items-center gap-1 bg-red-900/90 text-white px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border border-red-500/50 backdrop-blur-sm whitespace-nowrap shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                 <AlertTriangle size={10} className="text-red-400" />
                 LOAD FAILED
              </div>
           </Html>
           <Box args={[1, 1, 1]}>
               <meshBasicMaterial color="#ef4444" wireframe />
           </Box>
        </group>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={obj.position} rotation={obj.rotation} scale={obj.scale} visible={isVisible}>
      <group ref={contentRef} onPointerDown={(e) => { 
        if (isLocked || !isVisible) return;
        e.stopPropagation(); 
        onSelect(obj.id); 
      }}>
        {renderContent()}
      </group>
    </group>
  );
};

// Group Component
const GroupModel: React.FC<{
    group: SceneGroup;
    children: React.ReactNode;
    isLocked: boolean;
    isVisible: boolean;
    onSelect: (id: string) => void;
    onRegisterRef: (id: string, ref: THREE.Object3D | null) => void;
}> = ({ group, children, isLocked, isVisible, onSelect, onRegisterRef }) => {
    const groupRef = useRef<THREE.Group>(null);
    useEffect(() => {
        if (groupRef.current) onRegisterRef(group.id, groupRef.current);
        return () => onRegisterRef(group.id, null);
    }, [group.id, onRegisterRef]);

    return (
        <group
            ref={groupRef}
            position={group.position || [0,0,0]}
            rotation={group.rotation || [0,0,0]}
            scale={group.scale || [1,1,1]}
            visible={isVisible}
        >
            {children}
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
  onUpdateGroup: (id: string, updates: Partial<SceneGroup>) => void;
  onUpdateMany: (updates: { id: string, updates: Partial<SceneObject> }[]) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  snapEnabled: boolean;
  snapSize: number;
  bgSettings: BackgroundSettings;
  showGrid: boolean;
  activeCameraPreset: CameraPreset | null;
  onCameraPresetProcessed: () => void;
  onSetCapturedView: (pos: [number, number, number], target: [number, number, number]) => void;
}

const Viewport: React.FC<ViewportProps> = ({ 
  objects, groups, selectedId, onSelect, onRemove, transformMode, 
  onUpdate, onUpdateGroup, onUpdateMany, canvasRef, snapEnabled, snapSize, 
  bgSettings, showGrid, activeCameraPreset, onCameraPresetProcessed, onSetCapturedView 
}) => {
  const controlsRef = useRef<any>(null);
  const transformRef = useRef<any>(null);
  const [objectRefs, setObjectRefs] = useState<Record<string, THREE.Object3D>>({});

  const handleRegisterRef = useCallback((id: string, ref: THREE.Object3D | null) => {
    setObjectRefs(prev => {
        if (!ref) {
            const { [id]: _, ...rest } = prev;
            return rest;
        }
        return { ...prev, [id]: ref };
    });
  }, []);

  // Handle Transform Controls changes
  useEffect(() => {
    if (transformRef.current) {
        const controls = transformRef.current;
        const onDraggingChanged = (event: any) => {
            if (controlsRef.current) controlsRef.current.enabled = !event.value;
            if (!event.value && controls.object) {
                // Drag finished, commit changes
                const targetObj = controls.object;
                const targetId = Object.keys(objectRefs).find(key => objectRefs[key] === targetObj);
                
                if (targetId) {
                    // Check if it's a group
                    const isGroup = groups.find(g => g.id === targetId);
                    const transforms = {
                        position: targetObj.position.toArray(),
                        rotation: targetObj.rotation.toArray().slice(0, 3) as [number, number, number],
                        scale: targetObj.scale.toArray()
                    };

                    if (isGroup) {
                        onUpdateGroup(targetId, transforms);
                    } else {
                        onUpdate(targetId, transforms);
                    }
                }
            }
        };

        controls.addEventListener('dragging-changed', onDraggingChanged);
        return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
    }
  }, [objectRefs, onUpdate, onUpdateGroup, groups]);

  const selectedRef = selectedId ? objectRefs[selectedId] : null;

  // Capture View function exposed to window for the "Save Preset" feature in AssetPanel
  useEffect(() => {
    (window as any).captureCurrentView = () => {
        if (controlsRef.current) {
            const pos = controlsRef.current.object.position.toArray();
            const target = controlsRef.current.target.toArray();
            onSetCapturedView(pos, target);
        }
    };
    return () => { (window as any).captureCurrentView = undefined; };
  }, [onSetCapturedView]);

  return (
    <div className="flex-1 relative bg-[#050505] overflow-hidden">
      <Canvas
        ref={canvasRef}
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ position: [10, 10, 10], fov: 50 }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <directionalLight 
                position={[10, 10, 5]} 
                intensity={1} 
                castShadow 
                shadow-mapSize={[2048, 2048]} 
            />
            <ContactShadows resolution={1024} scale={50} blur={1} opacity={0.5} far={10} color="#000000" />
            
            <Background settings={bgSettings} />
            
            {showGrid && <Grid infiniteGrid fadeDistance={50} sectionColor="#444" cellColor="#222" />}

            <group>
                {/* Render ungrouped objects */}
                {objects.filter(o => !o.groupId).map(obj => (
                    <Model 
                        key={obj.id} 
                        obj={obj} 
                        isLocked={!!obj.locked}
                        isVisible={obj.visible !== false}
                        onSelect={onSelect}
                        onRegisterRef={handleRegisterRef}
                    />
                ))}

                {/* Render groups */}
                {groups.map(grp => (
                    <GroupModel 
                        key={grp.id}
                        group={grp}
                        isLocked={!!grp.locked}
                        isVisible={grp.visible !== false}
                        onSelect={onSelect}
                        onRegisterRef={handleRegisterRef}
                    >
                         {objects.filter(o => o.groupId === grp.id).map(obj => (
                            <Model 
                                key={obj.id} 
                                obj={obj} 
                                isLocked={!!obj.locked || !!grp.locked}
                                isVisible={obj.visible !== false && grp.visible !== false}
                                onSelect={onSelect}
                                onRegisterRef={handleRegisterRef}
                            />
                        ))}
                    </GroupModel>
                ))}
            </group>

            {selectedRef && selectedRef.parent && (
                <TransformControls 
                    key={selectedId}
                    ref={transformRef}
                    object={selectedRef}
                    mode={transformMode}
                    translationSnap={snapEnabled ? snapSize : null}
                    rotationSnap={snapEnabled ? Math.PI / 12 : null}
                    scaleSnap={snapEnabled ? 0.1 : null}
                />
            )}

            <OrbitControls ref={controlsRef} makeDefault />
            <CameraManager activePreset={activeCameraPreset} onPresetProcessed={onCameraPresetProcessed} controlsRef={controlsRef} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Viewport;