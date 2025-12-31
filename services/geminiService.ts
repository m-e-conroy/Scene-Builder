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
  groups: SceneGroup[],
  lightingReferenceUrl?: string | null
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Collect objects that have reference images
  const objectsWithRefs = objects.filter(o => o.referenceImageUrl);

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
    
    const refTag = o.referenceImageUrl ? " [HAS_REFERENCE_IMAGE]" : "";
    
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

  // Construct parts: Primary Scene + Reference Images + Prompt
  const parts: any[] = [
    {
      inlineData: {
        mimeType: 'image/png',
        data: base64Image.split(',')[1] 
      }
    }
  ];

  let nextImageIndex = 2; // Image 1 is the main viewport

  // Process Object References
  const objRefInstructions = objectsWithRefs.map(obj => {
    if (obj.referenceImageUrl) {
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: obj.referenceImageUrl.split(',')[1]
            }
        });
        const msg = `- Reference Image ${nextImageIndex} corresponds to object: "${obj.name}". Apply its style/texture to that specific object in the scene.`;
        nextImageIndex++;
        return msg;
    }
    return '';
  }).join('\n');

  // Process Lighting Reference
  let lightingRefInstruction = "";
  if (lightingReferenceUrl) {
    parts.push({
        inlineData: {
            mimeType: 'image/png',
            data: lightingReferenceUrl.split(',')[1]
        }
    });
    lightingRefInstruction = `
    [INSTRUCTIONS: GLOBAL LIGHTING REFERENCE]
    - Reference Image ${nextImageIndex} is the GLOBAL LIGHTING SOURCE.
    - You MUST replicate the exact shadow length, light direction, color temperature, and intensity from this image.
    - The entire scene should feel like it exists in the same environment as this reference image.
    `;
    nextImageIndex++;
  }

  const masterPrompt = `
    [TASK: NEURAL RENDER ENGINE]
    Transform the attached 3D viewport screenshot into a high-quality rendered image.
    
    [SCENE GRAPH & SEMANTICS]
    The image contains the following objects. Use their names to infer their material and appearance:
    ${sceneSemantics}
    
    [INSTRUCTIONS: REFERENCE IMAGES]
    I have provided additional reference images.
    ${objRefInstructions}
    ${lightingRefInstruction}

    [INSTRUCTIONS: SEMANTIC MAPPING]
    1. **Identify Objects**: Look at the "viewport color" and "world coordinates" in the Scene Graph above to identify which shape in the image corresponds to which name.
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