
export type PrimitiveType = 'box' | 'sphere' | 'cylinder' | 'plane' | 'cone' | 'torus' | 'pyramid' | 'wedge' | 'oblique-wedge' | 'tube' | 'capsule' | 'hemisphere' | 'octahedron' | 'dodecahedron' | 'helix' | 'polyhedron' | 'pentagrammic-prism' | 'octagonal-pyramid' | 'tetrahedron' | 'conical-frustum';

export interface SceneGroup {
  id: string;
  name: string;
  isOpen: boolean;
  locked?: boolean;
  visible?: boolean;
}

export interface SceneObject {
  id: string;
  name: string;
  url: string; // Used for GLB models
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  type: 'local' | 'cloud' | 'primitive';
  format?: 'glb' | 'gltf' | 'obj'; // Added to support multiple formats
  primitiveType?: PrimitiveType;
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

export type TransformMode = 'translate' | 'rotate' | 'scale';

export const TRANSFORM_MODES: { [key: string]: TransformMode } = {
  TRANSLATE: 'translate',
  ROTATE: 'rotate',
  SCALE: 'scale'
};
