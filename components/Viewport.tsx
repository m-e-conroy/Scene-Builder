
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
  Plane as DreiPlane,
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
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { SceneObject, SceneGroup, TransformMode, BackgroundSettings, CameraPreset } from '../types';
import ProceduralTerrain from './ProceduralTerrain';

/** Fix: Define aliases for intrinsic elements to bypass TypeScript's JSX property check errors. */
const MeshStandardMaterial = 'meshStandardMaterial' as any;
const Group = 'group' as any;
const Primitive = 'primitive' as any;
const AmbientLight = 'ambientLight' as any;
const SpotLight = 'spotLight' as any;
const Color = 'color' as any;
const Mesh = 'mesh' as any;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');

// --- Custom Geometry Components ---

const Wedge: React.FC<{ color: string, meshProps: any }> = ({ color, meshProps }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(-0.5, 0.5); s.lineTo(-0.5, -0.5);
    return s;
  }, []);
  return <Extrude args={[shape, { depth: 1, bevelEnabled: false }]} {...meshProps} position={[0, 0, -0.5]}>
    {!meshProps.material && <MeshStandardMaterial color={color} side={THREE.DoubleSide} />}
  </Extrude>;
};

const ObliqueWedge: React.FC<{ color: string, meshProps: any }> = ({ color, meshProps }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.2, 0.5); s.lineTo(-0.5, 0.5); s.lineTo(-0.5, -0.5);
    return s;
  }, []);
  return <Extrude args={[shape, { depth: 1, bevelEnabled: false }]} {...meshProps} position={[0, 0, -0.5]}>
    {!meshProps.material && <MeshStandardMaterial color={color} side={THREE.DoubleSide} />}
  </Extrude>;
};

const Arch: React.FC<{ color: string, meshProps: any }> = ({ color, meshProps }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.5);
    s.lineTo(0.5, -0.5);
    s.lineTo(0.5, 0);
    s.absarc(0, 0, 0.5, 0, Math.PI, false);
    s.lineTo(-0.5, -0.5);
    const hole = new THREE.Path();
    hole.moveTo(-0.3, -0.5);
    hole.lineTo(0.3, -0.5);
    hole.lineTo(0.3, 0);
    hole.absarc(0, 0, 0.3, 0, Math.PI, false);
    hole.lineTo(-0.3, -0.5);
    s.holes.push(hole);
    return s;
  }, []);
  return <Extrude args={[shape, { depth: 1, bevelEnabled: false }]} {...meshProps} position={[0, 0, -0.5]}>
    {!meshProps.material && <MeshStandardMaterial color={color} side={THREE.DoubleSide} />}
  </Extrude>;
};

const HalfPipe: React.FC<{ color: string, meshProps: any }> = ({ color, meshProps }) => {
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        s.absarc(0, 0, 0.5, Math.PI, 0, true);
        s.lineTo(0.4, 0);
        s.absarc(0, 0, 0.4, 0, Math.PI, false);
        s.lineTo(-0.5, 0);
        return s;
    }, []);
    return <Extrude args={[shape, { depth: 1, bevelEnabled: false }]} {...meshProps} position={[0, 0, -0.5]}>
        {!meshProps.material && <MeshStandardMaterial color={color} side={THREE.DoubleSide} />}
    </Extrude>;
};

const StarPrism: React.FC<{ color: string, meshProps: any }> = ({ color, meshProps }) => {
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        const points = 5;
        const outer = 0.5, inner = 0.2;
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outer : inner;
            const a = (i / points) * Math.PI;
            const x = Math.cos(a - Math.PI/2) * r;
            const y = Math.sin(a - Math.PI/2) * r;
            if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
        }
        return s;
    }, []);
    return <Extrude args={[shape, { depth: 1, bevelEnabled: false }]} {...meshProps} position={[0, 0, -0.5]}>
        {!meshProps.material && <MeshStandardMaterial color={color} side={THREE.DoubleSide} />}
    </Extrude>;
};

const Helix: React.FC<{ color: string, meshProps: any }> = ({ color, meshProps }) => {
    const path = useMemo(() => {
        const pts = [];
        for (let i = 0; i < 100; i++) {
            const t = i / 100;
            const a = t * Math.PI * 8;
            pts.push(new THREE.Vector3(Math.cos(a) * 0.4, (t - 0.5) * 1.5, Math.sin(a) * 0.4));
        }
        return new THREE.CatmullRomCurve3(pts);
    }, []);
    return <Tube args={[path, 64, 0.1, 8, false]} {...meshProps}>
        {!meshProps.material && <MeshStandardMaterial color={color} side={THREE.DoubleSide} />}
    </Tube>;
};

const Pipe: React.FC<{ color: string, meshProps: any }> = ({ color, meshProps }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.35, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return s;
  }, []);
  return <Extrude args={[shape, { depth: 1, bevelEnabled: false }]} {...meshProps} position={[0, 0, -0.5]}>
    {!meshProps.material && <MeshStandardMaterial color={color} side={THREE.DoubleSide} />}
  </Extrude>;
};

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

const PrimitiveMesh: React.FC<{ obj: SceneObject, isLocked: boolean, overrideMaterial?: THREE.Material }> = ({ obj, isLocked, overrideMaterial }) => {
    const color = obj.color || '#3b82f6';
    const meshProps = { castShadow: true, receiveShadow: true, raycast: isLocked ? () => null : undefined, material: overrideMaterial };
    const MatChild = !overrideMaterial ? <MeshStandardMaterial color={color} side={THREE.DoubleSide} /> : null;
    
    switch (obj.primitiveType) {
        case 'box': return <Box args={[1, 1, 1]} {...meshProps}>{MatChild}</Box>;
        case 'sphere': return <Sphere args={[0.5, 32, 32]} {...meshProps}>{MatChild}</Sphere>;
        case 'cylinder': return <Cylinder args={[0.5, 0.5, 1, 32]} {...meshProps}>{MatChild}</Cylinder>;
        case 'plane': return <DreiPlane args={[1, 1]} {...meshProps}>{MatChild}</DreiPlane>;
        case 'cone': return <Cone args={[0.5, 1, 32]} {...meshProps}>{MatChild}</Cone>;
        case 'torus': return <Torus args={[0.4, 0.1, 16, 100]} {...meshProps}>{MatChild}</Torus>;
        case 'pyramid': return <Cone args={[0.7, 1, 4]} {...meshProps}>{MatChild}</Cone>;
        case 'wedge': return <Wedge color={color} meshProps={meshProps} />;
        case 'oblique-wedge': return <ObliqueWedge color={color} meshProps={meshProps} />;
        case 'tube': return <Pipe color={color} meshProps={meshProps} />;
        case 'capsule': return <Capsule args={[0.3, 0.6, 4, 16]} {...meshProps}>{MatChild}</Capsule>;
        case 'hemisphere': return <Sphere args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} {...meshProps}>{MatChild}</Sphere>;
        case 'octahedron': return <Octahedron args={[0.6]} {...meshProps}>{MatChild}</Octahedron>;
        case 'dodecahedron': return <Dodecahedron args={[0.6]} {...meshProps}>{MatChild}</Dodecahedron>;
        case 'helix': return <Helix color={color} meshProps={meshProps} />;
        case 'polyhedron': return <Icosahedron args={[0.6]} {...meshProps}>{MatChild}</Icosahedron>;
        case 'pentagrammic-prism': return <StarPrism color={color} meshProps={meshProps} />;
        case 'octagonal-pyramid': return <Cylinder args={[0, 0.5, 1, 8]} {...meshProps}>{MatChild}</Cylinder>;
        case 'tetrahedron': return <Tetrahedron args={[0.6]} {...meshProps}>{MatChild}</Tetrahedron>;
        case 'conical-frustum': return <Cylinder args={[0.25, 0.5, 1, 32]} {...meshProps}>{MatChild}</Cylinder>;
        case 'arch': return <Arch color={color} meshProps={meshProps} />;
        case 'half-pipe': return <HalfPipe color={color} meshProps={meshProps} />;
        default: return <Box args={[1, 1, 1]} {...meshProps}>{MatChild}</Box>;
    }
};

const Model: React.FC<{
    obj: SceneObject;
    isLocked: boolean;
    isVisible: boolean;
    onSelect: (id: string) => void;
    onRegisterRef: (id: string, ref: THREE.Object3D | null) => void;
    overrideMaterial?: THREE.Material;
}> = ({ obj, isLocked, isVisible, onSelect, onRegisterRef, overrideMaterial }) => {
    const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
    const [loading, setLoading] = useState(obj.type !== 'primitive' && obj.type !== 'terrain');
    const groupRef = useRef<THREE.Group>(null);

    useEffect(() => {
        if (obj.type === 'primitive' || obj.type === 'terrain') { setLoading(false); return; }
        setLoadedScene(null);
        setLoading(true);
        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);
        loader.load(obj.url, (result) => {
            setLoadedScene(result.scene);
            setLoading(false);
        }, undefined, (err) => {
            console.error("Error loading model:", err);
            setLoading(false);
        });
    }, [obj.url, obj.type]);

    useEffect(() => { 
        if (groupRef.current) onRegisterRef(obj.id, groupRef.current); 
        return () => onRegisterRef(obj.id, null); 
    }, [obj.id, onRegisterRef, loading]);

    if (!isVisible) return null;

    return (
        <Group ref={groupRef} position={obj.position} rotation={obj.rotation} scale={obj.scale}>
            <Group onPointerDown={(e: any) => { e.stopPropagation(); if(!isLocked) onSelect(obj.id); }}>
                {obj.type === 'primitive' && <PrimitiveMesh obj={obj} isLocked={isLocked} overrideMaterial={overrideMaterial} />}
                {obj.type === 'terrain' && obj.terrainData && <ProceduralTerrain data={obj.terrainData} color={obj.color} shadowProps={{ castShadow: true, receiveShadow: true }} />}
                {obj.type === 'cloud' && loadedScene && <Primitive object={loadedScene.clone()} />}
                {obj.type === 'local' && loadedScene && <Primitive object={loadedScene.clone()} />}
            </Group>
        </Group>
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
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  snapEnabled: boolean;
  snapSize: number;
  bgSettings: BackgroundSettings;
  activeCameraPreset: CameraPreset | null;
  onCameraPresetProcessed: () => void;
  onSetCapturedView: (pos: [number, number, number], target: [number, number, number]) => void;
  previewObjects?: SceneObject[];
  isCapturing?: boolean;
}

const Viewport: React.FC<ViewportProps> = ({ 
  objects, groups, selectedId, onSelect, onRemove, transformMode, onUpdate, onUpdateGroup, onUpdateMany, canvasRef, 
  snapEnabled, snapSize, bgSettings, 
  activeCameraPreset, onCameraPresetProcessed, onSetCapturedView, previewObjects = [],
  isCapturing = false
}) => {
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const modelRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  const orbitControlsRef = useRef<any>(null);
  const [activeTarget, setActiveTarget] = useState<THREE.Object3D | null>(null);

  const registerModelRef = useCallback((id: string, ref: THREE.Object3D | null) => { 
    if (ref) { 
        modelRefs.current.set(id, ref); 
    } else { 
        modelRefs.current.delete(id); 
    } 
  }, []);

  useEffect(() => {
    if (selectedId) {
        const ref = modelRefs.current.get(selectedId);
        const obj = objects.find(o => o.id === selectedId);
        const grp = groups.find(g => g.id === selectedId);
        
        let isVisible = true;
        if (obj) {
            const parentGroup = groups.find(g => g.id === obj.groupId);
            isVisible = (obj.visible !== false) && (!parentGroup || parentGroup.visible !== false);
        } else if (grp) {
            isVisible = grp.visible !== false;
        } else {
            isVisible = false;
        }

        if (ref && (obj || grp) && isVisible && ref.parent) {
            setActiveTarget(ref);
        } else {
            setActiveTarget(null);
        }
    } else {
        setActiveTarget(null);
    }
  }, [selectedId, objects, groups]);

  const handleCameraChange = useCallback(() => {
    if (orbitControlsRef.current) {
        const cam = orbitControlsRef.current.object;
        const target = orbitControlsRef.current.target;
        onSetCapturedView([cam.position.x, cam.position.y, cam.position.z], [target.x, target.y, target.z]);
    }
  }, [onSetCapturedView]);

  return (
    <div className="flex-1 h-full relative bg-[#050505] overflow-hidden">
      <Canvas 
        shadows 
        camera={{ position: [5, 5, 5], fov: 45 }} 
        dpr={isCapturing ? 2 : [1, 1.5]} 
        gl={{ preserveDrawingBuffer: true, antialias: true }} 
        onPointerMissed={() => onSelect(null)} 
        ref={canvasRef}
      >
        <Color attach="background" args={['#080808']} />
        <AmbientLight intensity={1.5} />
        <SpotLight position={[10, 10, 10]} angle={0.15} intensity={100} castShadow />
        <Suspense fallback={null}>
          <Background settings={bgSettings} />
          
          {/* Groups rendering with their children nested for transformation logic */}
          {groups.map((group) => {
              const isGroupVisible = group.visible !== false;
              const groupObjects = objects.filter(o => o.groupId === group.id);
              
              return (
                  <Group 
                      key={group.id} 
                      position={group.position} 
                      rotation={group.rotation} 
                      scale={group.scale}
                      ref={(ref: any) => registerModelRef(group.id, ref)}
                      visible={isGroupVisible}
                  >
                      {groupObjects.map((obj) => (
                          <Model 
                              key={obj.id} 
                              obj={obj} 
                              isLocked={!!obj.locked || !!group.locked} 
                              isVisible={obj.visible !== false} 
                              onSelect={onSelect} 
                              onRegisterRef={registerModelRef} 
                          />
                      ))}
                  </Group>
              );
          })}

          {/* Ungrouped Objects */}
          <Group>
            {objects.filter(o => !o.groupId).map((obj) => (
                <Model 
                    key={obj.id} 
                    obj={obj} 
                    isLocked={!!obj.locked} 
                    isVisible={obj.visible !== false} 
                    onSelect={onSelect} 
                    onRegisterRef={registerModelRef} 
                />
            ))}
          </Group>

          <Group>{previewObjects.map((obj, i) => <Model key={`p-${i}`} obj={obj} isLocked={true} isVisible={true} onSelect={() => {}} onRegisterRef={() => {}} overrideMaterial={new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5, wireframe: true })} />)}</Group>
          
          {activeTarget && activeTarget.parent && !isCapturing && (
              <TransformControls 
                key={`tc-${selectedId}`} 
                object={activeTarget} 
                mode={transformMode} 
                translationSnap={snapEnabled ? snapSize : null}
                rotationSnap={snapEnabled ? 15 * (Math.PI / 180) : null}
                scaleSnap={snapEnabled ? 0.1 : null}
                onMouseDown={() => setOrbitEnabled(false)} 
                onMouseUp={() => {
                    setOrbitEnabled(true);
                    if (activeTarget) {
                        const r = new THREE.Euler().setFromQuaternion(activeTarget.quaternion);
                        const updates = { 
                            position: [activeTarget.position.x, activeTarget.position.y, activeTarget.position.z] as [number, number, number], 
                            rotation: [r.x, r.y, r.z] as [number, number, number], 
                            scale: [activeTarget.scale.x, activeTarget.scale.y, activeTarget.scale.z] as [number, number, number] 
                        };

                        if (groups.some(g => g.id === selectedId)) {
                            onUpdateGroup(selectedId!, updates);
                        } else {
                            onUpdate(selectedId!, updates);
                        }
                    }
                }} 
              />
          )}
          
          <Environment preset="city" />
          <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2.4} far={4.5} />
          <CameraManager activePreset={activeCameraPreset} onPresetProcessed={onCameraPresetProcessed} controlsRef={orbitControlsRef} />
        </Suspense>
        <OrbitControls 
            ref={orbitControlsRef} 
            makeDefault 
            enabled={orbitEnabled} 
            onChange={handleCameraChange} 
            maxPolarAngle={Math.PI / 2.1} 
        />
        {!isCapturing && <Grid infiniteGrid fadeDistance={30} cellSize={snapSize} sectionSize={snapSize * 5} sectionThickness={1.5} sectionColor="#333" cellColor="#222" />}
      </Canvas>
    </div>
  );
};

export default Viewport;
