import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client with server-side API Key
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON limit large enough for base64 screenshots and references
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // --- API Endpoints ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // End point: Render Scene
  app.post("/api/gemini/process-scene", async (req, res) => {
    try {
      const {
        base64Image,
        prompt,
        strength,
        objects = [],
        groups = [],
        cameraPos,
        cameraTarget,
        lightingReferenceUrl,
        model = 'gemini-2.5-flash-image'
      } = req.body;

      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
      }

      const objectsWithRefs = objects.filter((o: any) => o.referenceImageUrl);
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

      objectsWithRefs.forEach((obj: any) => {
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

      const describeObject = (o: any) => {
        const typeDesc = o.type === 'primitive' ? (o.primitiveType || 'geometric shape') : '3D model';
        const p = o.position.map((v: number) => v.toFixed(2));
        const s = o.scale.map((v: number) => v.toFixed(2));
        const r = o.rotation.map((v: number) => (v * 57.29).toFixed(1)); 
        
        const refIdx = objectRefIndices[o.id];
        const refTag = refIdx ? ` [STYLE ANCHOR: Image ${refIdx}]` : "";
        
        return `"${o.name}" | Type: ${typeDesc} | Pos: [${p[0]},${p[1]},${p[2]}] | Scale: [${s[0]},${s[1]},${s[2]}] | Rot: [${r[0]}°,${r[1]}°,${r[2]}°]${refTag}`;
      };

      const sceneSemantics = [
        ...groups.map((group: any) => {
          const children = objects.filter((o: any) => o.groupId === group.id).map((o: any) => `    * ${describeObject(o)}`).join('\n');
          return `- GROUP "${group.name}":\n${children}`;
        }),
        ...objects.filter((o: any) => !o.groupId).map((o: any) => `- UNGROUPED: ${describeObject(o)}`)
      ].join('\n');

      // Multi-ControlNet Simulation Prompt with Pixel Perfect Mode
      const masterPrompt = `
        [PROTOCOL: MAXIMUM STRUCTURAL ADHERENCE - PIXEL PERFECT MODE]
        
        MANDATORY ANCHOR: Image 1 is your EXACT spatial and structural blueprint.
        
        [CONTROLNET PIPELINE SIMULATION]
        1. **DEPTH MAP**: The 2D silhouettes in Image 1 represent absolute 3D depth. Maintain exact occlusion and spatial layering.
        2. **CANNY EDGES**: Every visible line and boundary in Image 1 is a HARD CONSTRAINT. Do not generate outside these boundaries.
        3. **FRUSTUM LOCK**: The camera position [${cameraPos?.join(',')}] and target [${cameraTarget?.join(',')}] are FINAL.
        
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
        - Strength: ${strength ? strength.toFixed(2) : '0.50'} (High = stay closer to Image 1 outlines).
        ${lightingRefIndex !== -1 ? `- Global Illumination: Extract color, mood, and light bounce from Reference Image ${lightingRefIndex}.` : '- Lighting: Professional studio cinematic lighting.'}
        
        [NEGATIVE CONSTRAINTS]
        - No camera movement.
        - No perspective interpolation.
        - No rotation of the scene.
        - No hallucinations of objects not present in Image 1.
      `;

      parts.push({ text: masterPrompt });

      // Use dynamic model with a fallback
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      if (response.candidates && response.candidates[0].content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return res.json({ result: `data:image/png;base64,${part.inlineData.data}` });
          }
        }
      }
      return res.status(500).json({ error: "Failed to generate rendered image from Gemini response." });
    } catch (error: any) {
      console.error("Gemini Process Scene Error:", error);
      res.status(500).json({ error: error?.message || "Internal server error during scene processing." });
    }
  });

  // End point: Enhance Prompt
  app.post("/api/gemini/enhance-prompt", async (req, res) => {
    try {
      const { currentPrompt } = req.body;
      if (!currentPrompt || !currentPrompt.trim()) {
        return res.json({ refined: "" });
      }

      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
      }

      // Use recommended model 'gemini-3.5-flash' for basic text tasks
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Transform this 3D scene description into a high-end, professional rendering prompt for PBR materials and global illumination. Max 35 words. Prompt: "${currentPrompt}"`,
      });

      return res.json({ refined: response.text?.trim() || currentPrompt });
    } catch (error: any) {
      console.error("Gemini Enhance Prompt Error:", error);
      res.status(500).json({ error: error?.message || "Internal server error during prompt enhancement." });
    }
  });

  // End point: Generate Prompt Variations
  app.post("/api/gemini/prompt-variations", async (req, res) => {
    try {
      const { basePrompt, count } = req.body;
      if (!basePrompt || !basePrompt.trim() || count < 1) {
        return res.json({ variations: [basePrompt] });
      }

      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
      }

      // Use recommended model 'gemini-3.5-flash' for basic text tasks
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Create ${count} unique style variations for the prompt: "${basePrompt}". Return as a JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          }
        }
      });

      if (response.text) {
        return res.json({ variations: JSON.parse(response.text) });
      }
      return res.json({ variations: [basePrompt] });
    } catch (error: any) {
      console.error("Gemini Prompt Variations Error:", error);
      res.status(500).json({ error: error?.message || "Internal server error during prompt variations." });
    }
  });

  // --- Vite / SPA Routing ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
