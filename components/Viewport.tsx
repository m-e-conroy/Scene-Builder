
import React, { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
import { SceneObject, TransformMode, BackgroundSettings } from '../types';
import { Trash2, AlertTriangle, RefreshCw, ZapOff } from 'lucide-react';

// Static loaders shared across all model instances
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

interface ModelProps {
  obj: SceneObject;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  transformMode: TransformMode;
  onUpdate: (id: string, updates: Partial<SceneObject>) => void;
  setOrbitEnabled: (enabled: boolean) => void;
  snapEnabled: boolean;
  snapSize: number;
}

const Model: React.FC<ModelProps> = ({ 
  obj, isSelected, onSelect, onRemove, transformMode, onUpdate, setOrbitEnabled, snapEnabled, snapSize 
}) => {
  const { gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(obj.type !== 'primitive');
  const [loadedGltf, setLoadedGltf] = useState<any>(null);
  const [currentUrl, setCurrentUrl] = useState(obj.url);
  
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

    setError(null);
    setLoading(true);
    
    const loader = new GLTFLoader(loadingManager);
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2Loader);
    
    let isMounted = true;

    loader.load(
      currentUrl,
      (gltf) => {
        if (!isMounted) {
          gltf.scene.traverse((node: any) => {
            if (node.isMesh) {
              node.geometry.dispose();
              if (node.material.dispose) node.material.dispose();
            }
          });
          return;
        }
        setLoadedGltf(gltf);
        setLoading(false);
      },
      undefined,
      (err) => {
        if (!isMounted) return;
        console.error(`Failed to load model: ${currentUrl}`, err);
        setError("Load Failed");
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [currentUrl, ktx2Loader, obj.type]);

  const groupRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const helperRef = useRef<THREE.BoxHelper>(null);

  const processedScene = useMemo(() => {
    if (obj.type === 'primitive') return null;
    if (!loadedGltf || !loadedGltf.scene) return null;
    
    // Deep clone to isolate from other instances
    const clone = loadedGltf.scene.clone(true);
    
    // Calculate bounding box for normalization
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    
    // Scale normalization: Fit into roughly 1-unit bounds if model is too big/small
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = maxDim > 0 ? (1 / maxDim) : 1;
    
    clone.scale.setScalar(scaleFactor);
    // Center the geometry relative to the group pivot
    clone.position.copy(center).multiplyScalar(-scaleFactor);
    
    clone.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // Prevent flickering/disappearing
        
        if (o.material) {
          // Handle single or multi-material meshes safely
          const processMat = (m: THREE.Material) => {
            const cm = m.clone();
            if ('color' in cm && obj.color) {
              (cm as any).color.set(obj.color);
            }
            return cm;
          };

          if (Array.isArray(o.material)) {
            o.material = o.material.map(processMat);
          } else {
            o.material = processMat(o.material);
          }
        }
      }
    });

    return clone;
  }, [loadedGltf, obj.color, obj.type]);

  useEffect(() => {
    return () => {
      if (processedScene) {
        processedScene.traverse((node: any) => {
          if (node.isMesh) {
            node.geometry.dispose();
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach((m: any) => m && m.dispose());
          }
        });
      }
    };
  }, [processedScene]);

  useFrame(() => {
    if ((isSelected || hovered) && helperRef.current && contentRef.current) {
      contentRef.current.updateWorldMatrix(true, false);
      helperRef.current.setFromObject(contentRef.current);
      helperRef.current.update();
    }
  });

  const renderPrimitive = () => {
    const material = <meshStandardMaterial color={obj.color || '#3b82f6'} castShadow receiveShadow />;
    switch (obj.primitiveType) {
      case 'box': return <Box args={[1, 1, 1]}>{material}</Box>;
      case 'sphere': return <Sphere args={[0.5, 32, 32]}>{material}</Sphere>;
      case 'cylinder': return <Cylinder args={[0.5, 0.5, 1, 32]}>{material}</Cylinder>;
      case 'plane': return <Plane args={[1, 1]}>{material}</Plane>;
      case 'cone': return <Cone args={[0.5, 1, 32]}>{material}</Cone>;
      case 'torus': return <Torus args={[0.4, 0.1, 16, 100]}>{material}</Torus>;
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

  if (error) {
    return (
      <group position={obj.position}>
        <Box args={[1, 1, 1]} onPointerDown={(e) => { e.stopPropagation(); onSelect(obj.id); }}>
          <meshStandardMaterial color="#221111" transparent opacity={0.3} wireframe />
        </Box>
        <Html center position={[0, 1.2, 0]}>
          <div className="flex flex-col items-center gap-2">
            <div className="bg-red-600/90 text-white text-[8px] font-black px-2 py-1.5 rounded-md flex items-center gap-2 whitespace-nowrap">
              <AlertTriangle size={10} /> {error}
            </div>
            <button onClick={() => onRemove(obj.id)} className="bg-white text-black p-1 rounded-full shadow-lg hover:bg-gray-200"><Trash2 size={10} /></button>
          </div>
        </Html>
      </group>
    );
  }

  return (
    <>
      <group ref={groupRef} position={obj.position} rotation={obj.rotation} scale={obj.scale}>
        <group ref={contentRef} onPointerDown={(e) => { e.stopPropagation(); onSelect(obj.id); }} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
          {obj.type === 'primitive' ? renderPrimitive() : (processedScene && <primitive object={processedScene} />)}
        </group>
      </group>
      {(isSelected || hovered) && contentRef.current && <boxHelper ref={helperRef} args={[contentRef.current, isSelected ? 0x3b82f6 : 0x555555]} />}
      {isSelected && groupRef.current && (
        <TransformControls 
          object={groupRef.current} 
          mode={transformMode}
          translationSnap={snapEnabled ? snapSize : null}
          rotationSnap={snapEnabled ? Math.PI / 12 : null}
          scaleSnap={snapEnabled ? (snapSize / 10) : null}
          onMouseDown={() => setOrbitEnabled(false)}
          onMouseUp={() => {
            setOrbitEnabled(true);
            const { x, y, z } = groupRef.current!.position;
            const { x: rx, y: ry, z: rz } = groupRef.current!.rotation;
            const { x: sx, y: sy, z: sz } = groupRef.current!.scale;
            onUpdate(obj.id, { position: [x, y, z], rotation: [rx, ry, rz], scale: [sx, sy, sz] });
          }}
        />
      )}
    </>
  );
};

const CanvasBridge = ({ bridgeRef }: { bridgeRef: React.RefObject<HTMLCanvasElement | null> }) => {
  const { gl } = useThree();
  useEffect(() => { 
    if (bridgeRef) (bridgeRef as any).current = gl.domElement; 
  }, [gl, bridgeRef]);
  return null;
};

interface ViewportProps {
  objects: SceneObject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  transformMode: TransformMode;
  onUpdate: (id: string, updates: Partial<SceneObject>) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  snapEnabled: boolean;
  snapSize: number;
  bgSettings: BackgroundSettings;
  showGrid?: boolean;
}

const Viewport: React.FC<ViewportProps> = ({ 
  objects, selectedId, onSelect, onRemove, transformMode, onUpdate, canvasRef, snapEnabled, snapSize, bgSettings, showGrid = true
}) => {
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [contextLost, setContextLost] = useState(false);

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    setContextLost(true);
  };

  const handleContextRestored = () => {
    window.location.reload();
  };

  if (contextLost) {
    return (
      <div className="flex-1 h-full bg-[#050505] flex flex-col items-center justify-center p-8 text-center">
        <ZapOff size={48} className="text-red-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">GPU Engine Blocked</h2>
        <button onClick={() => window.location.reload()} className="bg-white text-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest">Reboot</button>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full relative bg-[#050505] overflow-hidden">
      <Canvas 
        shadows 
        camera={{ position: [5, 5, 5], fov: 45 }} 
        dpr={[1, 1.5]}
        gl={{ 
          preserveDrawingBuffer: true, 
          antialias: true,
          powerPreference: 'high-performance',
        }} 
        onPointerMissed={() => onSelect(null)}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', handleContextLost, false);
          gl.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);
        }}
      >
        <CanvasBridge bridgeRef={canvasRef} />
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
                isSelected={selectedId === obj.id} 
                onSelect={onSelect} 
                onRemove={onRemove}
                transformMode={transformMode} 
                onUpdate={onUpdate} 
                setOrbitEnabled={setOrbitEnabled} 
                snapEnabled={snapEnabled} 
                snapSize={snapSize} 
              />
            ))}
          </group>
          <Environment preset="city" />
          <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2.4} far={4.5} />
        </Suspense>

        <OrbitControls makeDefault enabled={orbitEnabled} maxPolarAngle={Math.PI / 2.1} />
        
        {showGrid && (
          <Grid 
            infiniteGrid 
            fadeDistance={30} 
            cellSize={snapSize} 
            sectionSize={snapSize * 5} 
            sectionThickness={1.5} 
            sectionColor="#333" 
            cellColor="#222" 
          />
        )}
      </Canvas>
    </div>
  );
};

export default Viewport;
