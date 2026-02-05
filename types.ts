
export type PrimitiveType = 'box' | 'sphere' | 'cylinder' | 'plane' | 'cone' | 'torus' | 'pyramid' | 'wedge' | 'oblique-wedge' | 'tube' | 'capsule' | 'hemisphere' | 'octahedron' | 'dodecahedron' | 'helix' | 'polyhedron' | 'pentagrammic-prism' | 'octagonal-pyramid' | 'tetrahedron' | 'conical-frustum' | 'arch' | 'half-pipe';

export type FalloffType = 'none' | 'linear' | 'cosine';

export interface SceneGroup {
  id: string;
  name: string;
  isOpen: boolean;
  locked?: boolean;
  visible?: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface TerrainData {
  method: 'procedural' | 'heightmap';
  heightmapUrl?: string;
  
  // Dimensions
  width: number;
  depth: number;
  heightScale: number; // Amplitude
  segments: number; // Subdivision

  // Noise Parameters
  noiseScale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  seed: number;
  
  // Edge & Refinement
  edgeFalloff: FalloffType;
  falloffDistance: number; // 0 to 0.5
  invert: boolean;
  smoothness: number; // 0 to 1

  // Visualization
  wireframe?: boolean;
  showGradient?: boolean;
}

export interface SceneObject {
  id: string;
  name: string;
  url: string; // Used for GLB models
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  type: 'local' | 'cloud' | 'primitive' | 'terrain';
  format?: 'glb' | 'gltf' | 'obj'; // Added to support multiple formats
  primitiveType?: PrimitiveType;
  terrainData?: TerrainData; // Specific data for terrain objects
  groupId?: string; // Reference to a SceneGroup
  referenceImageUrl?: string; // AI Reference Image
  locked?: boolean;
  visible?: boolean;
  attribution?: {
    author: string;
    url: string;
    license: string;
  };
}

export interface CloudAsset {
  uid: string;
  name: string;
  thumbnail: string;
  downloadUrl?: string; // Optional, fetched on demand for Sketchfab
  sketchfabId?: string;
  author?: string;
  modelUrl?: string;
  license?: string;
}

export interface BackgroundSettings {
  url: string | null;
  position: [number, number, number];
  scale: number;
  opacity: number;
}

export interface CameraPreset {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  isSystem?: boolean;
}

export interface StylePreset {
  id: string;
  name: string;
  prompt: string;
  strength: number;
  lightingReference?: string | null;
  isSystem?: boolean;
}

export type TransformMode = 'translate' | 'rotate' | 'scale';

export const TRANSFORM_MODES: { [key: string]: TransformMode } = {
  TRANSLATE: 'translate',
  ROTATE: 'rotate',
  SCALE: 'scale'
};

// --- Batch Processing Types ---

export type BatchMode = 'iteration' | 'strength' | 'prompt' | 'preset';

export interface BatchConfig {
  mode: BatchMode;
  count: number; // For iteration/prompt
  strengthRange: { start: number; end: number; steps: number };
  selectedPresetIds: string[];
}

export interface BatchResultItem {
  id: string;
  imageUrl: string;
  metadata: string;
  timestamp: number;
}

// --- Array Tool Types ---

export type ArrayType = 'linear' | 'radial' | 'grid';

export interface ArrayConfig {
  type: ArrayType;
  
  // Linear Params
  linearCount: number;
  linearOffset: [number, number, number];
  linearRotation: [number, number, number];
  linearScale: [number, number, number];

  // Radial Params
  radialCount: number;
  radialRadius: number;
  radialArc: number; // Degrees
  radialStartAngle: number; // Degrees
  radialHeightOffset: number; // Spiral effect
  radialFaceCenter: boolean;

  // Grid Params
  gridRows: number; // X
  gridCols: number; // Z
  gridLayers: number; // Y
  gridSpacing: [number, number, number];

  // Randomization
  randomPos: [number, number, number];
  randomRot: [number, number, number];
  randomScale: [number, number, number];
}
