import { GoogleGenAI, Type } from "@google/genai";
import { CloudAsset, SceneObject, SceneGroup } from "../types";

// Utility to ensure GitHub links are raw and other common URL fixes
export const sanitizeModelUrl = (url: string): string => {
  let sanitized = url.trim();
  if (sanitized.includes('github.com') && sanitized.includes('/blob/')) {
    sanitized = sanitized.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  if (sanitized.includes('huggingface.co') && sanitized.includes('/blob/')) {
    sanitized = sanitized.replace('/blob/', '/resolve/');
  }
  return sanitized;
};

// Function to process a 3D scene screenshot and transform it into a rendered image
export const processSceneToImage = async (
  base64Image: string,
  prompt: string,
  strength: number,
  objects: SceneObject[],
  groups: SceneGroup[],
  cameraPos: [number, number, number],
  cameraTarget: [number, number, number],
  lightingReferenceUrl?: string | null
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const objectsWithRefs = objects.filter(o => o.referenceImageUrl);

  const parts: any[] = [
    {
      inlineData: {
        mimeType: 'image/png',
        data: base64Image.split(',')[1] 
      }
    }
  ];

  let nextImageIndex = 2; 
  const objectRefIndices: Record<string, number> = {};

  objectsWithRefs.forEach(obj => {
    if (obj.referenceImageUrl) {
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: obj.referenceImageUrl.split(',')[1]
            }
        });
        objectRefIndices[obj.id] = nextImageIndex;
        nextImageIndex++;
    }
  });

  let lightingRefIndex = -1;
  if (lightingReferenceUrl) {
    parts.push({
        inlineData: {
            mimeType: 'image/png',
            data: lightingReferenceUrl.split(',')[1]
        }
    });
    lightingRefIndex = nextImageIndex;
  }

  const describeObject = (o: SceneObject) => {
    const typeDesc = o.type === 'primitive' ? (o.primitiveType || 'geometric shape') : '3D model';
    const p = o.position.map(v => v.toFixed(2));
    const s = o.scale.map(v => v.toFixed(2));
    const r = o.rotation.map(v => (v * 57.29).toFixed(1)); 
    
    const refIdx = objectRefIndices[o.id];
    const refTag = refIdx ? ` [STYLE ANCHOR: Image ${refIdx}]` : "";
    
    return `"${o.name}" | Type: ${typeDesc} | Pos: [${p[0]},${p[1]},${p[2]}] | Scale: [${s[0]},${s[1]},${s[2]}] | Rot: [${r[0]}°,${r[1]}°,${r[2]}°]${refTag}`;
  };

  const sceneSemantics = [
    ...groups.map(group => {
      const children = objects.filter(o => o.groupId === group.id).map(o => `    * ${describeObject(o)}`).join('\n');
      return `- GROUP "${group.name}":\n${children}`;
    }),
    ...objects.filter(o => !o.groupId).map(o => `- UNGROUPED: ${describeObject(o)}`)
  ].join('\n');

  // Multi-ControlNet Simulation Prompt with Pixel Perfect Mode
  const masterPrompt = `
    [PROTOCOL: MAXIMUM STRUCTURAL ADHERENCE - PIXEL PERFECT MODE]
    
    MANDATORY ANCHOR: Image 1 is your EXACT spatial and structural blueprint.
    
    [CONTROLNET PIPELINE SIMULATION]
    1. **DEPTH MAP**: The 2D silhouettes in Image 1 represent absolute 3D depth. Maintain exact occlusion and spatial layering.
    2. **CANNY EDGES**: Every visible line and boundary in Image 1 is a HARD CONSTRAINT. Do not generate outside these boundaries.
    3. **FRUSTUM LOCK**: The camera position [${cameraPos.join(',')}] and target [${cameraTarget.join(',')}] are FINAL.
    
    [INSTRUCTIONS]
    - Transform the "blocky" primitives in Image 1 into photorealistic versions of the objects described below.
    - DO NOT move the camera. 
    - DO NOT change the perspective or vanish points.
    - Align all materials and details 1:1 with the silhouettes provided.
    
    [SCENE SEMANTICS]
    Entities within Image 1:
    ${sceneSemantics}
    
    [STYLE & LIGHTING]
    - Style: "${prompt}"
    - Strength: ${strength.toFixed(2)} (High = stay closer to Image 1 outlines).
    ${lightingRefIndex !== -1 ? `- Global Illumination: Extract color, mood, and light bounce from Reference Image ${lightingRefIndex}.` : '- Lighting: Professional studio cinematic lighting.'}
    
    [NEGATIVE CONSTRAINTS]
    - No camera movement.
    - No perspective interpolation.
    - No rotation of the scene.
    - No hallucinations of objects not present in Image 1.
  `;

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
    console.error("Gemini Neural Render Error:", error);
    return null;
  }
};

export const enhancePrompt = async (currentPrompt: string): Promise<string> => {
  if (!currentPrompt.trim()) return "";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Transform this 3D scene description into a high-end, professional rendering prompt for PBR materials and global illumination. Max 35 words. Prompt: "${currentPrompt}"`,
    });
    return response.text?.trim() || currentPrompt;
  } catch (error) {
    return currentPrompt;
  }
};

export const generatePromptVariations = async (basePrompt: string, count: number): Promise<string[]> => {
  if (!basePrompt.trim() || count < 1) return [basePrompt];
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create ${count} unique style variations for the prompt: "${basePrompt}". Return as a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        }
      }
    });
    return response.text ? JSON.parse(response.text) : [basePrompt];
  } catch (error) {
    return [basePrompt];
  }
};