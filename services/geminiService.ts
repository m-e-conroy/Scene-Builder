
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

  // Convert Hugging Face blob links to resolve links
  if (sanitized.includes('huggingface.co') && sanitized.includes('/blob/')) {
    sanitized = sanitized.replace('/blob/', '/resolve/');
  }
  
  return sanitized;
};

// Function to process a 3D scene screenshot and transform it into a rendered image using Gemini 2.5 Flash Image.
export const processSceneToImage = async (
  base64Image: string,
  prompt: string,
  strength: number,
  objects: SceneObject[],
  groups: SceneGroup[],
  lightingReferenceUrl?: string | null
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Collect objects that have reference images
  const objectsWithRefs = objects.filter(o => o.referenceImageUrl);

  // Initialize parts with the main scene image (Image 1)
  const parts: any[] = [
    {
      inlineData: {
        mimeType: 'image/png',
        data: base64Image.split(',')[1] 
      }
    }
  ];

  let nextImageIndex = 2; // Image 1 is the main viewport
  const objectRefIndices: Record<string, number> = {};

  // Add Object Reference Images to parts and map them
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

  // Add Lighting Reference Image if present
  let lightingRefIndex = -1;
  if (lightingReferenceUrl) {
    parts.push({
        inlineData: {
            mimeType: 'image/png',
            data: lightingReferenceUrl.split(',')[1]
        }
    });
    lightingRefIndex = nextImageIndex;
    // nextImageIndex++; 
  }

  // Helper to generate a detailed description for each object
  // This helps the AI map the visual block-out to the semantic name provided by the user
  const describeObject = (o: SceneObject) => {
    const typeDesc = o.type === 'primitive' ? (o.primitiveType || 'geometric shape') : '3D model';
    const colorDesc = o.color ? `displayed as ${o.color}` : 'default color';
    
    // Formatting precision for cleaner prompt
    const p = o.position.map(v => v.toFixed(1));
    const s = o.scale.map(v => v.toFixed(1));
    const r = o.rotation.map(v => (v * 57.29).toFixed(0)); // Rad to Deg

    const posDesc = `pos[${p[0]},${p[1]},${p[2]}]`;
    const scaleDesc = `size[${s[0]},${s[1]},${s[2]}]`;
    const rotDesc = `rot[${r[0]}°,${r[1]}°,${r[2]}°]`;
    
    // Explicitly link the object to its reference image index in the description
    const refIdx = objectRefIndices[o.id];
    const refTag = refIdx ? ` [MUST MATCH STYLE OF REFERENCE IMAGE ${refIdx}]` : "";
    
    return `"${o.name}" (${typeDesc}, ${colorDesc}, ${posDesc}, ${scaleDesc}, ${rotDesc})${refTag}`;
  };

  // Generate a comprehensive, hierarchical description of the scene
  const sceneSemantics = [
    ...groups.map(group => {
      const children = objects.filter(o => o.groupId === group.id).map(o => `    - ${describeObject(o)}`).join('\n');
      return `- Group "${group.name}":\n${children}`;
    }),
    ...objects.filter(o => !o.groupId).map(o => `- Ungrouped: ${describeObject(o)}`)
  ].join('\n');

  const getFidelityInstruction = (s: number) => {
    const intensity = (1 - s).toFixed(2);
    if (s < 0.35) {
      return `
        [SPATIAL CONSTRAINT: ABSOLUTE]
        - Fidelity Intensity: ${intensity}.
        - You are strictly prohibited from altering the silhouette or volume of the provided 3D block-out.
        - Render exactly what is seen, just applying realistic materials based on object names.
      `;
    } else if (s > 0.75) {
      return `
        [SPATIAL CONSTRAINT: FLUID]
        - Fidelity Intensity: ${intensity}.
        - Use the source image as a loose spatial guide.
        - You may reimagine details and forms significantly to better match the style of the prompt.
      `;
    } else {
      return `
        [SPATIAL CONSTRAINT: BALANCED]
        - Fidelity Intensity: ${intensity}.
        - Preserve the primary forms and layout of the block-out.
        - Enhance surface details, lighting, and small geometric features.
      `;
    }
  };

  const structuralInstruction = getFidelityInstruction(strength);

  // Generate Reference Instructions with Strict Constraints
  const objRefInstructions = objectsWithRefs.map(obj => {
    const idx = objectRefIndices[obj.id];
    if (!idx) return '';
    return `
    [STRICT CONSTRAINT: LOCALIZED TEXTURE APPLICATION]
    - Reference Image ${idx} is a MATERIAL SOURCE strictly for the object named "${obj.name}".
    - ACTION: Apply the texture, color, and material properties of Image ${idx} ONLY to the geometry of "${obj.name}" defined in Image 1.
    - NEGATIVE CONSTRAINT: DO NOT allow the style of Image ${idx} to bleed into the background or other objects.
    `;
  }).join('\n');

  // Generate Lighting Instructions
  let lightingRefInstruction = "";
  if (lightingRefIndex !== -1) {
    lightingRefInstruction = `
    [INSTRUCTIONS: GLOBAL LIGHTING & ATMOSPHERE ONLY]
    - Reference Image ${lightingRefIndex} is provided STRICTLY for lighting analysis.
    - DO NOT composite, blend, or place this image content into the scene.
    - DO NOT use the geometry or objects from Reference Image ${lightingRefIndex}.
    - EXTRACT the lighting direction, color temperature, shadow softness, and exposure from Reference Image ${lightingRefIndex}.
    - APPLY these extracted lighting parameters to the 3D scene provided in Image 1.
    `;
  }

  const masterPrompt = `
    [TASK: NEURAL RENDER ENGINE]
    Transform Image 1 (the 3D viewport screenshot) into a high-quality rendered image.
    
    [SCENE GRAPH & SEMANTICS]
    Image 1 contains the following objects. Use their names to infer their material and appearance:
    ${sceneSemantics}
    
    [INSTRUCTIONS: REFERENCE IMAGES]
    I have provided additional reference images.
    ${objRefInstructions}
    ${lightingRefInstruction}

    [INSTRUCTIONS: SEMANTIC MAPPING]
    1. **Identify Objects**: Look at the "viewport color" and "world coordinates" in the Scene Graph above to identify which shape in Image 1 corresponds to which name.
    2. **Apply Materials**: Use the object's NAME to determine its material. 
       - Example: If an object is named "Wooden Crates", render it with wood texture.
       - Example: If an object is named "Neon Sign", make it emit light.
    3. **Respect Hierarchy**: Objects in the same group often share context or lighting conditions.
    4. **Scale & Rotation**: Pay attention to 'size' and 'rot' attributes. A flat box might be a "Rug", a tall box might be a "Door".

    [VISUAL STYLE & USER PROMPT]
    "${prompt}"

    [STRUCTURAL CONSTRAINTS]
    ${structuralInstruction}

    [TECHNICAL SPECIFICATIONS]
    - Realistic Global Illumination (GI) and HDR lighting.
    - Physically Based Rendering (PBR) materials.
    - Cinematic post-processing.
    - The final output must structurally match Image 1, but with the lighting style of the Reference Image (if provided).
    - ISOLATION: Ensure object-specific references do not contaminate the rest of the scene.
  `;

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
 * Enhances a short user prompt into a professional image generation prompt.
 */
export const enhancePrompt = async (currentPrompt: string): Promise<string> => {
  if (!currentPrompt.trim()) return "";
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Act as an expert prompt engineer for photorealistic AI rendering.
      
      Task: Rewrite and enhance the following user prompt to be more descriptive, artistic, and detailed. 
      Focus on adding details about:
      1. Lighting (e.g., volumetric, cinematic, studio, soft)
      2. Material properties (e.g., matte, glossy, PBR, textured)
      3. Camera settings (e.g., depth of field, 85mm lens, wide angle)
      4. Atmosphere/Mood
      5. Technical quality (e.g., 8k, unreal engine 5, octane render)
      
      Constraints:
      - Keep the core subject/intent of the user exactly the same.
      - Do NOT add conversational text. Output ONLY the raw prompt string.
      - Keep it under 80 words.

      User Prompt: "${currentPrompt}"`,
    });

    return response.text?.trim() || currentPrompt;
  } catch (error) {
    console.error("Prompt Enhancement Error:", error);
    return currentPrompt;
  }
};

/**
 * Generates variations of a prompt for batch processing.
 */
export const generatePromptVariations = async (basePrompt: string, count: number): Promise<string[]> => {
  if (!basePrompt.trim() || count < 1) return [basePrompt];

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate ${count} distinct, creative variations of the following image prompt. 
      Keep the core subject identical, but vary the artistic style, lighting, and mood descriptors.
      
      Original Prompt: "${basePrompt}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        }
      }
    });
    
    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return Array(count).fill(basePrompt);
  } catch (error) {
    console.error("Prompt Variation Error:", error);
    // Fallback: Return copies of original
    return Array(count).fill(basePrompt);
  }
};
