import React, { useMemo } from 'react';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { TerrainData } from '../types';

interface ProceduralTerrainProps {
  data: TerrainData;
  color?: string;
  shadowProps?: { castShadow: boolean; receiveShadow: boolean };
  interactionProps?: any;
}

// Simple seeded random function (Linear Congruential Generator)
const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const ProceduralTerrain: React.FC<ProceduralTerrainProps> = ({ 
  data, 
  color = '#8ba88e', 
  shadowProps, 
  interactionProps 
}) => {
  const { width, depth, segments, roughness, elevation, seed, waterLevel } = data;

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
    
    // Create noise function with seed
    const rng = seededRandom(seed);
    const noise2D = createNoise2D(rng);

    const posAttribute = geo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttribute.count; i++) {
      vertex.fromBufferAttribute(posAttribute, i);
      
      // Calculate noise based on X/Y position
      // We use vertex.x and vertex.y because PlaneGeometry is created on XY plane by default
      // We will rotate the mesh -90deg X later to lay it flat
      let noiseVal = noise2D(vertex.x * roughness, vertex.y * roughness);
      
      // Normalize noise roughly to 0..1 range (simplex output is -1..1)
      // Then apply water level (flatten bottom)
      let height = noiseVal; 
      
      // Apply elevation scale
      if (height < waterLevel) {
          height = waterLevel; // Flatten valleys
      }
      
      // Apply height to Z (which becomes up-down after rotation)
      vertex.z = height * elevation;

      posAttribute.setZ(i, vertex.z);
    }

    geo.computeVertexNormals();
    return geo;
  }, [width, depth, segments, roughness, elevation, seed, waterLevel]);

  return (
    <mesh 
      geometry={geometry} 
      rotation={[-Math.PI / 2, 0, 0]} // Rotate to lay flat on ground
      {...shadowProps}
      {...interactionProps}
    >
      <meshStandardMaterial 
        color={color} 
        flatShading={segments < 50} // Low poly look if low resolution
        roughness={0.8}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default ProceduralTerrain;