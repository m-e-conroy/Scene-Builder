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

// ... [Existing Background component] ...
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

// ... [Existing CameraManager] ...
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
      camera.position.lerp(targetPos, 0.1);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetFocus, 0.1);
        controlsRef.current.update();
      }
      if (camera.position.distanceTo(targetPos) < 0.01) {
        onPresetProcessed();
      }
    }
  });
  return null;
};

// ... [Existing geometry clean function] ...
const cleanSceneGeometry = (scene: THREE.Object3D): boolean => {
  const invalidObjects: THREE.Object3D[] = [];
  scene.traverse((obj: any) => {
    if (obj.geometry && obj.geometry.attributes.position) {
      const positions = obj.geometry.attributes.position.array;
      let isInvalid = false;
      for (let i = 0; i < positions.length; i++) {
        const val = positions[i];
        if (isNaN(val) || !isFinite(val)) {
          isInvalid = true;
          break;
        }
      }
      if (isInvalid) invalidObjects.push(obj);
    }
  });
  if (invalidObjects.length === 0) return true;
  if (invalidObjects.includes(scene)) return false;
  invalidObjects.forEach(obj => { if (obj.parent) obj.parent.remove(obj); });
  return true;
};

// ... [Existing Custom Shapes: Wedge, ObliqueWedge, PentagrammicPrism, Pipe, Helix] ...
const Wedge: React.FC<{ color: string, shadowProps: any, material?: THREE.Material }> = ({ color, shadowProps, material }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1, 0);
    s.lineTo(0, 1);
    s.lineTo(0, 0);
    return s;
  }, []);
  const extrudeSettings = useMemo(() => ({ depth: 1, bevelEnabled: false }), []);
  return <Extrude args={[shape, extrudeSettings]} {...shadowProps} position={[-0.5, -0.5, -0.5]} material={material}>
    {!material && <meshStandardMaterial color={color} />}
  </Extrude>;
};

const ObliqueWedge: React.FC<{ color: string, shadowProps: any, material?: THREE.Material }> = ({ color, shadowProps, material }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1, 0);
    s.lineTo(0.5, 1); 
    s.lineTo(0, 0);
    return s;
  }, []);
  const extrudeSettings = useMemo(() => ({ depth: 1, bevelEnabled: false }), []);
  return <Extrude args={[shape, extrudeSettings]} {...shadowProps} position={[-0.5, -0.5, -0.5]} material={material}>
    {!material && <meshStandardMaterial color={color} />}
  </Extrude>;
};

const PentagrammicPrism: React.FC<{ color: string, shadowProps: any, material?: THREE.Material }> = ({ color, shadowProps, material }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const points = 5;
    const outerRadius = 0.5;
    const innerRadius = 0.25;
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const a = (i / points) * Math.PI;
        const x = Math.cos(a + Math.PI / 2 * 3) * r;
        const y = Math.sin(a + Math.PI / 2 * 3) * r;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }, []);
  const extrudeSettings = useMemo(() => ({ depth: 1, bevelEnabled: false }), []);
  return <Extrude args={[shape, extrudeSettings]} {...shadowProps} position={[0, 0, -0.5]} material={material}>
    {!material && <meshStandardMaterial color={color} />}
  </Extrude>;
};

const Pipe: React.FC<{ color: string, shadowProps: any, material?: THREE.Material }> = ({ color, shadowProps, material }) => {
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        shape.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, 0.35, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 32 });
    }, []);
    return <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.5, 0.5]} {...shadowProps} material={material}>
        {!material && <meshStandardMaterial color={color} />}
    </mesh>;
};

const Helix: React.FC<{ color: string, shadowProps: any, material?: THREE.Material }> = ({ color, shadowProps, material }) => {
    const path = useMemo(() => {
        const points = [];
        for (let i = 0; i <= 100; i++) {
            const t = i / 100;
            const angle = 2 * Math.PI * 3 * t; 
            const x = Math.cos(angle) * 0.3;
            const z = Math.sin(angle) * 0.3;
            const y = (t - 0.5) * 1; 
            points.push(new THREE.Vector3(x, y, z));
        }
        return new THREE.CatmullRomCurve3(points);
    }, []);
    return <Tube args={[path, 64, 0.08, 12, false]} {...shadowProps} material={material}>
        {!material && <meshStandardMaterial color={color} />}
    </Tube>;
};

const Arch: React.FC<{ color: string, shadowProps: any, material?: THREE.Material }> = ({ color, shadowProps, material }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    // 1 unit wide, 1 unit high
    const w = 1;
    const h = 1;
    const t = 0.25; // Thickness of leg

    // Start bottom left outer
    s.moveTo(-w/2, -h/2);
    // Up to curve start (let's say curve is semi circle at top)
    const legHeight = h - w/2; // 1 - 0.5 = 0.5
    s.lineTo(-w/2, -h/2 + legHeight);
    
    // Outer Arc
    // Center of arc is (0, -h/2 + legHeight) -> (0, 0)
    s.absarc(0, 0, w/2, Math.PI, 0, true);
    
    // Down right outer
    s.lineTo(w/2, -h/2);
    // In right
    s.lineTo(w/2 - t, -h/2);
    // Up right inner
    s.lineTo(w/2 - t, 0);
    
    // Inner Arc
    s.absarc(0, 0, w/2 - t, 0, Math.PI, false);
    
    // Down left inner
    s.lineTo(-w/2 + t, -h/2);
    // Close
    s.lineTo(-w/2, -h/2);
    
    return s;
  }, []);
  
  const extrudeSettings = useMemo(() => ({ depth: 1, bevelEnabled: false }), []);
  
  return <Extrude args={[shape, extrudeSettings]} {...shadowProps} position={[0, 0, -0.5]} material={material}>
    {!material && <meshStandardMaterial color={color} />}
  </Extrude>;
};

const HalfPipe: React.FC<{ color: string, shadowProps: any, material?: THREE.Material }> = ({ color, shadowProps, material }) => {
    const geometry = useMemo(() => {
        const s = new THREE.Shape();
        const rOuter = 0.5;
        const rInner = 0.4;
        
        // C shape facing up
        // Outer arc from PI to 2PI (bottom half)
        s.absarc(0, 0, rOuter, Math.PI, 2 * Math.PI, true); 
        s.lineTo(rInner, 0);
        // Inner arc from 2PI to PI (clockwise)
        s.absarc(0, 0, rInner, 2 * Math.PI, Math.PI, false); 
        s.lineTo(-rOuter, 0);
        
        return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 32 });
    }, []);
    
    return <mesh geometry={geometry} position={[0, 0.25, -0.5]} {...shadowProps} material={material}>
        {!material && <meshStandardMaterial color={color} />}
    </mesh>;
};

// ... [Existing Model Component] ...
interface ModelProps {
  obj: SceneObject;
  isLocked: boolean;
  isVisible: boolean;
  onSelect: (id: string) => void;
  onRegisterRef: (id: string, ref: THREE.Object3D | null) => void;
  overrideMaterial?: THREE.Material; // Added for Array Preview
}

const Model: React.FC<ModelProps> = ({ 
  obj, isLocked, isVisible, onSelect, onRegisterRef, overrideMaterial
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
    const manager = new THREE.LoadingManager();
    const onLoad = (result: any) => {
        if (isMounted) {
            const scene = result.scene ? result.scene : result;
            setLoadedScene(scene);
            setLoading(false);
        }
    };
    const onError = (e: any) => { if (isMounted) { setLoading(false); setHasError(true); } };

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

  useEffect(() => {
    if (groupRef.current) onRegisterRef(obj.id, groupRef.current);
    return () => onRegisterRef(obj.id, null);
  }, [obj.id, onRegisterRef, loading, hasError]);

  const processedScene = useMemo(() => {
    if (obj.type === 'primitive' || obj.type === 'terrain' || !loadedScene) return null;
    const clone = loadedScene.clone(true);
    const isValid = cleanSceneGeometry(clone);
    if (!isValid) return null;
    const box = new THREE.Box3().setFromObject(clone);
    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
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
        if (overrideMaterial) {
            o.material = overrideMaterial;
        } else if (o.material) {
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          const cm = m.clone();
          if (obj.color && cm.color) cm.color.set(obj.color);
          o.material = cm;
        }
        if (isLocked) o.raycast = () => null;
      }
    });
    return clone;
  }, [loadedScene, obj.color, obj.type, isLocked, overrideMaterial]);

  const renderPrimitive = () => {
    const color = obj.color || '#3b82f6';
    const shadowProps = { castShadow: true, receiveShadow: true };
    const interactionProps = { raycast: isLocked ? () => null : undefined };
    
    const meshProps = {
        ...shadowProps,
        ...interactionProps,
        material: overrideMaterial
    };

    const MatChild = !overrideMaterial ? <meshStandardMaterial color={color} /> : null;

    switch (obj.primitiveType) {
      case 'box': return <Box args={[1, 1, 1]} {...meshProps}>{MatChild}</Box>;
      case 'sphere': return <Sphere args={[0.5, 32, 32]} {...meshProps}>{MatChild}</Sphere>;
      case 'cylinder': return <Cylinder args={[0.5, 0.5, 1, 32]} {...meshProps}>{MatChild}</Cylinder>;
      case 'plane': return <Plane args={[1, 1]} {...meshProps}>{MatChild}</Plane>;
      case 'cone': return <Cone args={[0.5, 1, 32]} {...meshProps}>{MatChild}</Cone>;
      case 'torus': return <Torus args={[0.4, 0.1, 16, 100]} {...meshProps}>{MatChild}</Torus>;
      case 'pyramid': return <Cone args={[0.7, 1, 4]} {...meshProps}>{MatChild}</Cone>;
      case 'wedge': return <Wedge color={color} shadowProps={{...shadowProps, ...interactionProps}} material={overrideMaterial} />;
      case 'oblique-wedge': return <ObliqueWedge color={color} shadowProps={{...shadowProps, ...interactionProps}} material={overrideMaterial} />;
      case 'tube': return <Pipe color={color} shadowProps={{...shadowProps, ...interactionProps}} material={overrideMaterial} />;
      case 'capsule': return <Capsule args={[0.3, 1, 4, 16]} {...meshProps}>{MatChild}</Capsule>;
      case 'hemisphere': return <Sphere args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} {...meshProps}>{MatChild}</Sphere>;
      case 'octahedron': return <Octahedron args={[0.6]} {...meshProps}>{MatChild}</Octahedron>;
      case 'dodecahedron': return <Dodecahedron args={[0.6]} {...meshProps}>{MatChild}</Dodecahedron>;
      case 'helix': return <Helix color={color} shadowProps={{...shadowProps, ...interactionProps}} material={overrideMaterial} />;
      case 'polyhedron': return <Icosahedron args={[0.6]} {...meshProps}>{MatChild}</Icosahedron>;
      case 'pentagrammic-prism': return <PentagrammicPrism color={color} shadowProps={{...shadowProps, ...interactionProps}} material={overrideMaterial} />;
      case 'octagonal-pyramid': return <Cylinder args={[0, 0.5, 1, 8]} {...meshProps}>{MatChild}</Cylinder>;
      case 'tetrahedron': return <Tetrahedron args={[0.6]} {...meshProps}>{MatChild}</Tetrahedron>;
      case 'conical-frustum': return <Cylinder args={[0.25, 0.5, 1, 32]} {...meshProps}>{MatChild}</Cylinder>;
      case 'arch': return <Arch color={color} shadowProps={{...shadowProps, ...interactionProps}} material={overrideMaterial} />;
      case 'half-pipe': return <HalfPipe color={color} shadowProps={{...shadowProps, ...interactionProps}} material={overrideMaterial} />;
      default: return <Box args={[1, 1, 1]} {...meshProps}>{MatChild}</Box>;
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
    if (obj.type === 'primitive') return renderPrimitive();
    return processedScene && <primitive object={processedScene} />;
  }

  if (loading) return null; // Simplified loading for brevity

  if (hasError) {
    return (
      <group ref={groupRef} position={obj.position} rotation={obj.rotation} scale={obj.scale} visible={isVisible}>
        <Box args={[1, 1, 1]}><meshBasicMaterial color="red" wireframe /></Box>
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
  previewObjects?: SceneObject[]; // NEW PROP
}

const Viewport: React.FC<ViewportProps> = ({ 
  objects, groups, selectedId, onSelect, onRemove, transformMode, onUpdate, onUpdateMany, canvasRef, 
  snapEnabled, snapSize, bgSettings, showGrid = true, 
  activeCameraPreset, onCameraPresetProcessed, onSetCapturedView, previewObjects = []
}) => {
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const modelRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  const pivotRef = useRef<THREE.Group>(null);
  const boxHelperRef = useRef<THREE.BoxHelper>(null);
  const orbitControlsRef = useRef<any>(null);
  const [activeTarget, setActiveTarget] = useState<THREE.Object3D | null>(null);
  
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const dragOffsets = useRef<Map<string, THREE.Matrix4>>(new Map());

  const isObjectLocked = useCallback((obj: SceneObject) => {
    return !!(obj.locked || (obj.groupId && groups.find(g => g.id === obj.groupId)?.locked));
  }, [groups]);

  const isObjectVisible = useCallback((obj: SceneObject) => {
    if (obj.visible === false) return false;
    if (obj.groupId) {
      const group = groups.find(g => g.id === obj.groupId);
      if (group && group.visible === false) return false;
    }
    return true;
  }, [groups]);

  const isSelectionLocked = useMemo(() => {
    if (!selectedId) return false;
    const group = groups.find(g => g.id === selectedId);
    if (group) return !!group.locked;
    const obj = objects.find(o => o.id === selectedId);
    if (obj) return isObjectLocked(obj);
    return false;
  }, [selectedId, groups, objects, isObjectLocked]);

  const isSelectionVisible = useMemo(() => {
    if (!selectedId) return false;
    const group = groups.find(g => g.id === selectedId);
    if (group) return group.visible !== false;
    const obj = objects.find(o => o.id === selectedId);
    if (obj) return isObjectVisible(obj);
    return false;
  }, [selectedId, groups, objects, isObjectVisible]);

  const registerModelRef = useCallback((id: string, ref: THREE.Object3D | null) => {
    if (ref) {
      modelRefs.current.set(id, ref);
      if (id === selectedIdRef.current) setActiveTarget(ref);
    } else {
      modelRefs.current.delete(id);
      if (id === selectedIdRef.current) setActiveTarget(null);
    }
  }, []);

  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedId), [groups, selectedId]);
  const objectsInSelectedGroup = useMemo(() => objects.filter(o => o.groupId === selectedId), [objects, selectedId]);

  useEffect(() => {
    if (selectedGroup && pivotRef.current) {
      const box = new THREE.Box3();
      let hasObjects = false;
      objectsInSelectedGroup.forEach(obj => {
        const ref = modelRefs.current.get(obj.id);
        if (ref && isObjectVisible(obj)) {
          ref.updateMatrixWorld();
          box.expandByObject(ref);
          hasObjects = true;
        }
      });
      
      if (hasObjects && !box.isEmpty()) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        if (!isNaN(center.x)) {
           pivotRef.current.position.copy(center);
           pivotRef.current.rotation.set(0,0,0);
           pivotRef.current.scale.set(1,1,1);
           pivotRef.current.updateMatrixWorld();
           setActiveTarget(pivotRef.current);
        }
      } else {
        pivotRef.current.position.set(0,0,0);
        setActiveTarget(pivotRef.current);
      }
    } else if (selectedId) {
      const ref = modelRefs.current.get(selectedId);
      if (ref) setActiveTarget(ref);
    } else {
      setActiveTarget(null);
    }
  }, [selectedId, selectedGroup, objectsInSelectedGroup, isObjectVisible]);


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
              const localMatrix = new THREE.Matrix4().multiplyMatrices(pivotInv, ref.matrixWorld);
              dragOffsets.current.set(obj.id, localMatrix);
           }
        });
     }
  }, [selectedGroup, objectsInSelectedGroup]);

  const onTransformChange = useCallback(() => {
     if (boxHelperRef.current) boxHelperRef.current.update();
     if (selectedGroup && pivotRef.current) {
        const pivotMatrix = pivotRef.current.matrixWorld;
        objectsInSelectedGroup.forEach(obj => {
           const ref = modelRefs.current.get(obj.id);
           const offset = dragOffsets.current.get(obj.id);
           if (ref && offset) {
              const newWorld = new THREE.Matrix4().multiplyMatrices(pivotMatrix, offset);
              const pos = new THREE.Vector3();
              const quat = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              newWorld.decompose(pos, quat, scale);
              ref.position.copy(pos);
              ref.quaternion.copy(quat);
              ref.scale.copy(scale);
              ref.updateMatrixWorld();
           }
        });
     }
  }, [selectedGroup, objectsInSelectedGroup]);

  const onTransformEnd = useCallback(() => {
     setOrbitEnabled(true);
     dragOffsets.current.clear();
     if (selectedGroup) {
        const updates = objectsInSelectedGroup.map(obj => {
           const ref = modelRefs.current.get(obj.id);
           if (!ref) return null;
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
         const ref = activeTarget;
         const r = new THREE.Euler().setFromQuaternion(ref.quaternion);
         onUpdate(selectedId, {
             position: [ref.position.x, ref.position.y, ref.position.z],
             rotation: [r.x, r.y, r.z],
             scale: [ref.scale.x, ref.scale.y, ref.scale.z],
         });
     }
  }, [selectedGroup, objectsInSelectedGroup, onUpdate, onUpdateMany, selectedId, activeTarget]);

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

  // Preview Material for Array Tool
  const previewMaterial = useMemo(() => {
      const m = new THREE.MeshStandardMaterial({
          color: 0x3b82f6,
          transparent: true,
          opacity: 0.5,
          wireframe: true
      });
      return m;
  }, []);

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
        
        <Suspense fallback={<Html center><div className="text-white text-xs">Loading...</div></Html>}>
          <Background settings={bgSettings} />
          
          <group>
            {objects.map((obj) => (
              <Model 
                key={obj.id} 
                obj={obj}
                isLocked={isObjectLocked(obj)}
                isVisible={isObjectVisible(obj)}
                onSelect={onSelect} 
                onRegisterRef={registerModelRef}
              />
            ))}
          </group>
          
          {/* ARRAY PREVIEW RENDER */}
          {previewObjects.length > 0 && (
            <group>
                {previewObjects.map(obj => (
                    <Model 
                        key={obj.id}
                        obj={obj}
                        isLocked={true}
                        isVisible={true}
                        onSelect={() => {}} // No selection on ghost
                        onRegisterRef={() => {}} // No ref registration on ghost
                        overrideMaterial={previewMaterial}
                    />
                ))}
            </group>
          )}

          <group ref={pivotRef} />

          {activeTarget && !isSelectionLocked && isSelectionVisible && (
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
