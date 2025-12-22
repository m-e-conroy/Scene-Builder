
import { GoogleGenAI, Type } from "@google/genai";
import { CloudAsset, SceneObject, SceneGroup } from "../types";

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
  strength: number,
  objects: SceneObject[],
  groups: SceneGroup[]
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Collect objects that have reference images
  const objectsWithRefs = objects.filter(o => o.referenceImageUrl);

  // Generate a textual description of the scene semantics
  const sceneSemantics = groups.map(group => {
    const children = objects.filter(o => o.groupId === group.id).map(o => o.name);
    return `- Group "${group.name}": contains ${children.join(', ') || 'nothing'}`;
  }).join('\n') + '\n' + 
  objects.filter(o => !o.groupId).map(o => {
    const refSuffix = o.referenceImageUrl ? " (HAS ATTACHED REFERENCE IMAGE)" : "";
    return `- Ungrouped object: "${o.name}"${refSuffix}`;
  }).join('\n');

  const getFidelityInstruction = (s: number) => {
    const intensity = (1 - s).toFixed(2);
    if (s < 0.35) {
      return `
        [SPATIAL CONSTRAINT: ABSOLUTE]
        - Fidelity Intensity: ${intensity}.
        - You are strictly prohibited from altering the silhouette or volume.
      `;
    } else if (s > 0.75) {
      return `
        [SPATIAL CONSTRAINT: FLUID]
        - Fidelity Intensity: ${intensity}.
        - Use the source image as a depth guide.
      `;
    } else {
      return `
        [SPATIAL CONSTRAINT: BALANCED]
        - Fidelity Intensity: ${intensity}.
        - Preserve primary forms but enhance surface details.
      `;
    }
  };

  const structuralInstruction = getFidelityInstruction(strength);

  const masterPrompt = `
    [TASK: NEURAL RENDER ENGINE]
    Transform the attached 3D block-out into a professional CGI masterpiece. 
    
    [SCENE HIERARCHY & SEMANTICS]
    ${sceneSemantics}
    
    [INSTRUCTIONS: REFERENCE IMAGES]
    I have provided ${objectsWithRefs.length} additional reference images.
    Each reference image corresponds to a specific object in the scene.
    ${objectsWithRefs.map((obj, idx) => `- Reference Image ${idx + 2} (Part ${idx + 2}) is for the object named: "${obj.name}". Use its textures, colors, and materials exactly for that specific object.`).join('\n')}

    [INSTRUCTIONS: SEMANTIC MAPPING]
    - Match the 3D shapes in the primary image to the names provided above.
    - If a box is named "Server Tower", render it with metallic panels.
    - Respect the relationships described in groups.

    [VISUAL STYLE & ENVIRONMENT]
    Prompt: "${prompt}"

    [STRUCTURAL CONSTRAINTS]
    ${structuralInstruction}

    [TECHNICAL SPECIFICATIONS]
    - Realistic Global Illumination (GI) and HDR lighting.
    - PBR surfaces: realistic roughness, metalness.
    - Cinematic post-processing.
  `;

  // Construct parts: Primary Scene + Reference Images + Prompt
  const parts: any[] = [
    {
      inlineData: {
        mimeType: 'image/png',
        data: base64Image.split(',')[1] 
      }
    }
  ];

  // Add all per-object references as parts
  objectsWithRefs.forEach(obj => {
    if (obj.referenceImageUrl) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: obj.referenceImageUrl.split(',')[1]
        }
      });
    }
  });

  // Add the text prompt part last
  parts.push({ text: masterPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
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
      
      Return a JSON array of objects with "name", "downloadUrl", and "thumbnail".`,
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
