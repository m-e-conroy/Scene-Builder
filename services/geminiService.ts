
import { GoogleGenAI, Type } from "@google/genai";
import { CloudAsset } from "../types";

// Utility to ensure GitHub links are raw and other common URL fixes
export const sanitizeModelUrl = (url: string): string => {
  let sanitized = url.trim();
  
  // Convert GitHub blob links to raw links
  if (sanitized.includes('github.com') && sanitized.includes('/blob/')) {
    sanitized = sanitized
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
  }
  
  return sanitized;
};

// Function to process a 3D scene screenshot and transform it into a rendered image using Gemini 2.5 Flash Image.
export const processSceneToImage = async (
  base64Image: string,
  prompt: string,
  strength: number
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const getFidelityInstruction = (s: number) => {
    const intensity = (1 - s).toFixed(2);
    if (s < 0.35) {
      return `
        [SPATIAL CONSTRAINT: ABSOLUTE]
        - Fidelity Intensity: ${intensity}.
        - You are strictly prohibited from altering the silhouette, volume, or perspective of the objects.
        - Every pixel of the geometry in the source image is a fixed physical structure.
        - Focus exclusively on realistic light transport, PBR materials, and environmental integration.
      `;
    } else if (s > 0.75) {
      return `
        [SPATIAL CONSTRAINT: FLUID]
        - Fidelity Intensity: ${intensity}.
        - Use the source image as a composition and depth guide (Depth-Mapping).
        - Maintain the general volume but feel free to add intricate decorative geometry, secondary objects, and atmospheric density that complements the core shapes.
      `;
    } else {
      return `
        [SPATIAL CONSTRAINT: BALANCED]
        - Fidelity Intensity: ${intensity}.
        - Preserve the primary geometric forms and their 3D coordinate relationships.
        - You may enhance surface details (beveling, weathering, paneling) while keeping the base mesh proportions 1:1.
      `;
    }
  };

  const structuralInstruction = getFidelityInstruction(strength);

  const masterPrompt = `
    [TASK: NEURAL RENDER ENGINE]
    Transform the attached 3D block-out into a professional CGI masterpiece. 
    
    [GEOMETRY & DEPTH ANALYSIS]
    1. ANALYZE PERSPECTIVE: Identify the horizon line and vanishing points from the grid lines. Ensure all rendered lines align with this perspective.
    2. DEPTH OCCLUSION: Respect object layering. Objects in the foreground must have crisp edges; objects in the background should follow atmospheric perspective (subtle haze/desaturation).
    3. CONTACT GEOMETRY: Pay extreme attention to the points where objects intersect the floor. Generate realistic contact shadows (Ambient Occlusion) to ground the scene.
    4. VOLUME PRESERVATION: Treat every shape as a physical 3D mass. Avoid flattening or warping the geometry.

    [VISUAL STYLE & ENVIRONMENT]
    Prompt: "${prompt}"

    [STRUCTURAL CONSTRAINTS]
    ${structuralInstruction}

    [TECHNICAL SPECIFICATIONS]
    - Realistic Global Illumination (GI) and High Dynamic Range (HDR) lighting.
    - Physically Based Rendering (PBR) surfaces: simulate realistic roughness, metalness, and subsurface scattering.
    - Cinematic post-processing: Subtle chromatic aberration, film grain, and 8k sharpness.
    - Tone Mapping: Professional color grade suitable for a high-budget film or architectural visualization.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Image.split(',')[1] 
            }
          },
          {
            text: masterPrompt
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini AI Transformation Error:", error);
    return null;
  }
};

/**
 * Searches for public 3D models (.glb) using Gemini with Google Search.
 */
export const search3DModels = async (query: string): Promise<CloudAsset[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for high-quality, public domain .glb 3D models for: "${query}". 
      
      CRITICAL REJECTION RULES (DEAD PATHS - DO NOT USE):
      1. NEVER use "pmndrs/market-assets" paths (e.g. tree-spruce, tree-lime). They are 404.
      2. NEVER use "aframevr/aframe" showcase paths (e.g. anime-UI/assets/bench.glb). They are 404.
      3. NEVER return links from "vazxmixjsiawhamofees.supabase.co" or "cdn.wellpi.com".
      4. NEVER guess GitHub file names. If you haven't seen the exact path in search results, don't return it.
      
      PREFERRED STABLE SOURCES:
      1. Khronos Group glTF Sample Models (Very Reliable): "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/[ModelName]/glTF-Binary/[ModelName].glb"
      2. Google Model Viewer Shared Assets: "https://modelviewer.dev/shared-assets/models/[ModelName].glb"
      3. Three.js Examples Assets: "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/..."
      
      Return a JSON array of objects with "name", "downloadUrl", and "thumbnail". 
      Ensure "thumbnail" is a valid direct image link or leave empty to use a placeholder.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              downloadUrl: { type: Type.STRING },
              thumbnail: { type: Type.STRING }
            },
            required: ["name", "downloadUrl"]
          }
        }
      },
    });

    const results = JSON.parse(response.text || "[]");
    return results.map((item: any, index: number) => ({
      uid: `ai-search-${index}-${Date.now()}`,
      name: item.name,
      downloadUrl: sanitizeModelUrl(item.downloadUrl),
      thumbnail: item.thumbnail && item.thumbnail.startsWith('http') 
        ? item.thumbnail 
        : `https://placehold.co/400x400/111/444?text=${encodeURIComponent(item.name)}`
    }));
  } catch (error) {
    console.error("3D Search Error:", error);
    return [];
  }
};
