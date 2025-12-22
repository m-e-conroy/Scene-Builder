
import React, { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
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
import { SceneObject, TransformMode, BackgroundSettings, PrimitiveType } from '../types';
import { Trash2, AlertTriangle, RefreshCw } from 'lucide-react';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');

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
  const [retried, setRetried] = useState(false);
  
  const manager = useMemo(() => {
    const m = new THREE.LoadingManager();
    m.setURLModifier((url) => {
      if (url.startsWith('blob:') || url.startsWith('http') || url.startsWith('data:')) return url;
      return url;
    });
    return m;
  }, [currentUrl]);

  const ktx2Loader = useMemo(() => {
    const loader = new KTX2Loader(manager);
    loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/basis/');
    loader.detectSupport(gl);
    return loader;
  }, [gl, manager]);

  useEffect(() => {
    if (obj.type === 'primitive') {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    setLoadedGltf(null);
    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2Loader);
    
    const timeout = setTimeout(() => {
      if (loading && !loadedGltf && !error) {
        setError("Request Timed Out");
        setLoading(false);
      }
    }, 15000);

    loader.load(
      currentUrl,
      (gltf) => {
        setLoadedGltf(gltf);
        setLoading(false);
        clearTimeout(timeout);
      },
      undefined,
      (err) => {
        console.error(`Failed to load model: ${currentUrl}`, err);
        
        if (!retried && currentUrl.includes('raw.githubusercontent.com')) {
          let newUrl = '';
          if (currentUrl.includes('/master/')) {
            newUrl = currentUrl.replace('/master/', '/main/');
          } else if (currentUrl.includes('/main/')) {
            newUrl = currentUrl.replace('/main/', '/master/');
          }
          
          if (newUrl) {
            setRetried(true);
            setCurrentUrl(newUrl);
            return;
          }
        }

        setError("404: Invalid File or CORS Error");
        setLoading(false);
        clearTimeout(timeout);
      }
    );

    return () => clearTimeout(timeout);
  }, [currentUrl, manager, ktx2Loader, obj.type]);

  const groupRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const helperRef = useRef<THREE.BoxHelper>(null);

  const processedScene = useMemo(() => {
    if (obj.type === 'primitive') return null;
    if (!loadedGltf || !loadedGltf.scene) return null;
    const clone = loadedGltf.scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
          const clonedMat = mat.clone();
          clonedMat.side = THREE.DoubleSide;
          if (obj.color) clonedMat.color.set(obj.color);
          mesh.material = clonedMat;
        }
      }
    });
    clone.position.sub(center);
    return clone;
  }, [loadedGltf, obj.color, obj.type]);

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
            <span className="text-[8px] text-white font-black uppercase tracking-widest whitespace-nowrap">Loading {obj.name}</span>
          </div>
        </Html>
      </group>
    );
  }

  if (error) {
    return (
      <group position={obj.position} rotation={obj.rotation} scale={obj.scale}>
        <Box 
          args={[1, 1, 1]} 
          onPointerDown={(e) => { e.stopPropagation(); onSelect(obj.id); }}
        >
          <meshStandardMaterial color="#221111" transparent opacity={0.5} wireframe />
        </Box>
        <Html center position={[0, 1.2, 0]}>
          <div className="flex flex-col items-center gap-2">
            <div className="bg-red-600/90 text-white text-[8px] font-black px-2 py-1.5 rounded-md whitespace-nowrap shadow-2xl border border-red-500 flex items-center gap-2 backdrop-blur-sm">
              <AlertTriangle size={10} />
              {error}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }}
              className="bg-white hover:bg-red-500 hover:text-white text-black p-1.5 rounded-full transition-all shadow-lg"
              title="Remove broken object"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </Html>
      </group>
    );
  }

  return (
    <>
      <group 
        ref={groupRef} 
        position={obj.position} 
        rotation={obj.rotation} 
        scale={obj.scale}
      >
        <group 
          ref={contentRef} 
          onPointerDown={(e) => { 
            e.stopPropagation(); 
            onSelect(obj.id); 
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          {obj.type === 'primitive' ? renderPrimitive() : <primitive object={processedScene!} />}
        </group>
      </group>
      
      {(isSelected || hovered) && contentRef.current && (
        <boxHelper 
          ref={helperRef} 
          args={[contentRef.current, isSelected ? 0x3b82f6 : 0x555555]} 
        />
      )}
      
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
  useEffect(() => { if (bridgeRef) (bridgeRef as any).current = gl.domElement; }, [gl, bridgeRef]);
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

  return (
    <div className="flex-1 h-full relative bg-[#050505] overflow-hidden">
      <Canvas 
        shadows 
        camera={{ position: [5, 5, 5], fov: 45 }} 
        gl={{ preserveDrawingBuffer: true, antialias: true }} 
        onPointerMissed={() => onSelect(null)}
      >
        <CanvasBridge bridgeRef={canvasRef} />
        <color attach="background" args={['#080808']} />
        <ambientLight intensity={1.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} intensity={100} castShadow />
        
        <Suspense fallback={<Html center><div className="flex flex-col items-center gap-4 bg-black/90 p-8 rounded-2xl border border-white/10"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div><span className="text-[10px] text-white font-black tracking-widest uppercase">Rendering Engine</span></div></Html>}>
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
          <ContactShadows 
            position={[0, -0.01, 0]} 
            opacity={0.4} 
            scale={20} 
            blur={2.4} 
            far={4.5} 
            raycast={() => null}
          />
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
            raycast={() => null}
          />
        )}
      </Canvas>
    </div>
  );
};

export default Viewport;
