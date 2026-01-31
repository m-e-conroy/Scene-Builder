import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { TerrainData } from '../types';

interface ProceduralTerrainProps {
  data: TerrainData;
  color?: string;
  shadowProps?: { castShadow: boolean; receiveShadow: boolean };
  interactionProps?: any;
}

// Seeded Random Helper
const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

// Fractal Brownian Motion Noise
const fbm = (x: number, y: number, noise2D: (x: number, y: number) => number, octaves: number, persistence: number, lacunarity: number) => {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;  
  for(let i=0; i < octaves; i++) {
    total += noise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return total / maxValue; // Normalize to -1..1 range (approx)
};

// Edge Falloff Calculation
const applyFalloff = (x: number, y: number, width: number, depth: number, type: string, dist: number) => {
  if (type === 'none' || dist <= 0) return 1;

  // Normalized coordinates 0..1
  const nx = x / width + 0.5; // PlaneGeometry is centered, so x is -width/2 to width/2
  const ny = y / depth + 0.5;

  // Distance from nearest edge
  const d = Math.min(nx, 1 - nx, ny, 1 - ny) * 2; // 0 at edge, 1 at center

  if (d >= dist) return 1;

  const t = d / dist; // 0 at edge, 1 at start of falloff

  if (type === 'linear') return t;
  if (type === 'cosine') return (1 - Math.cos(t * Math.PI)) / 2; // Smooth ease-in-out
  
  return 1;
};

const ProceduralTerrain: React.FC<ProceduralTerrainProps> = ({ 
  data, 
  color = '#8ba88e', 
  shadowProps, 
  interactionProps 
}) => {
  const { 
    width, depth, segments, heightScale, 
    method, heightmapUrl,
    noiseScale, octaves, persistence, lacunarity, seed,
    edgeFalloff, falloffDistance, invert, smoothness,
    wireframe, showGradient
  } = data;

  const [heightmapData, setHeightmapData] = useState<Float32Array | null>(null);

  // Load Heightmap Image
  useEffect(() => {
    if (method !== 'heightmap' || !heightmapUrl) {
      setHeightmapData(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = heightmapUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Resolution matches segments for 1:1 vertex mapping
      canvas.width = segments + 1;
      canvas.height = segments + 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, segments + 1, segments + 1);
        const imgData = ctx.getImageData(0, 0, segments + 1, segments + 1);
        const data = imgData.data;
        const heights = new Float32Array(data.length / 4);
        for (let i = 0; i < heights.length; i++) {
          // Use Red channel, normalize 0..1
          heights[i] = data[i * 4] / 255;
        }
        setHeightmapData(heights);
      }
    };
  }, [method, heightmapUrl, segments]);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
    const posAttribute = geo.attributes.position;
    const rng = seededRandom(seed);
    const noise2D = createNoise2D(rng);
    const vertex = new THREE.Vector3();
    
    // Array to store raw heights for smoothing pass
    const rawHeights = new Float32Array(posAttribute.count);
    const colors = [];

    // 1. Generate Raw Heights
    for (let i = 0; i < posAttribute.count; i++) {
      vertex.fromBufferAttribute(posAttribute, i);
      
      let h = 0;

      if (method === 'heightmap' && heightmapData) {
        // Map vertex index to heightmap pixel
        // PlaneGeometry vertex order matches row-by-row (usually)
        if (i < heightmapData.length) {
          h = heightmapData[i];
        }
      } else {
        // Procedural
        const nx = vertex.x * (noiseScale / 10);
        const ny = vertex.y * (noiseScale / 10);
        // Map FBM output (-1..1) to 0..1
        h = (fbm(nx, ny, noise2D, octaves, persistence, lacunarity) + 1) / 2;
      }

      if (invert) h = 1 - h;
      
      // Edge Falloff
      h *= applyFalloff(vertex.x, vertex.y, width, depth, edgeFalloff, falloffDistance);
      
      rawHeights[i] = h;
    }

    // 2. Smoothing Pass (Simple Neighbor Average)
    const smoothedHeights = new Float32Array(rawHeights);
    if (smoothness > 0) {
      const gridW = segments + 1;
      const gridH = segments + 1;
      
      for (let i = 0; i < posAttribute.count; i++) {
        const x = i % gridW;
        const y = Math.floor(i / gridW);
        
        let sum = 0;
        let count = 0;

        // 3x3 kernel
        for(let dy = -1; dy <= 1; dy++) {
          for(let dx = -1; dx <= 1; dx++) {
             const nx = x + dx;
             const ny = y + dy;
             if(nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
               const idx = ny * gridW + nx;
               sum += rawHeights[idx];
               count++;
             }
          }
        }
        
        const avg = sum / count;
        // Blend original with average based on smoothness factor (0..1)
        smoothedHeights[i] = THREE.MathUtils.lerp(rawHeights[i], avg, smoothness);
      }
    }

    // 3. Apply Heights & Colors
    for (let i = 0; i < posAttribute.count; i++) {
       const h = smoothedHeights[i];
       posAttribute.setZ(i, h * heightScale);

       // Gradient Visualization
       if (showGradient) {
          const c = new THREE.Color();
          // Simple gradient: Blue(Low) -> Green(Mid) -> White(High)
          if (h < 0.2) c.setHex(0x224488);
          else if (h < 0.5) c.setHex(0x448844);
          else if (h < 0.8) c.setHex(0x886633);
          else c.setHex(0xffffff);
          
          colors.push(c.r, c.g, c.b);
       }
    }

    if (showGradient) {
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    
    geo.computeVertexNormals();
    return geo;
  }, [width, depth, segments, heightScale, method, heightmapData, noiseScale, octaves, persistence, lacunarity, seed, edgeFalloff, falloffDistance, invert, smoothness, showGradient]);

  return (
    <mesh 
      geometry={geometry} 
      rotation={[-Math.PI / 2, 0, 0]} 
      {...shadowProps}
      {...interactionProps}
    >
      <meshStandardMaterial 
        color={showGradient ? undefined : color} 
        vertexColors={showGradient}
        wireframe={wireframe}
        flatShading={segments < 50 && !smoothness}
        roughness={0.9}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default ProceduralTerrain;