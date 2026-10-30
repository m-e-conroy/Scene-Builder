import { CloudAsset, SceneObject, SceneGroup } from "../types";

const getCustomApiKey = (): string | null => {
  try {
    return localStorage.getItem("custom_gemini_api_key");
  } catch (e) {
    return null;
  }
};

const getHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const customKey = getCustomApiKey();
  if (customKey) {
    headers["X-Gemini-API-Key"] = customKey;
  }
  return headers;
};

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

// Client proxy function to call server-side render scene route
export const processSceneToImage = async (
  base64Image: string,
  prompt: string,
  strength: number,
  objects: SceneObject[],
  groups: SceneGroup[],
  cameraPos: [number, number, number],
  cameraTarget: [number, number, number],
  lightingReferenceUrl?: string | null,
  model?: string,
  aspectRatio?: string,
  imageSize?: string
): Promise<string | null> => {
  try {
    const response = await fetch("/api/gemini/process-scene", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        base64Image,
        prompt,
        strength,
        objects,
        groups,
        cameraPos,
        cameraTarget,
        lightingReferenceUrl,
        model,
        aspectRatio,
        imageSize
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    if (!data.result) {
      throw new Error("Failed to generate rendered image from Gemini response.");
    }
    return data.result;
  } catch (error) {
    console.error("Client Process Scene Error:", error);
    throw error;
  }
};

// Client proxy function to call server-side prompt enhancer
export const enhancePrompt = async (currentPrompt: string): Promise<string> => {
  if (!currentPrompt.trim()) return "";
  try {
    const response = await fetch("/api/gemini/enhance-prompt", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ currentPrompt })
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data.refined || currentPrompt;
  } catch (error) {
    console.error("Client Enhance Prompt Error:", error);
    return currentPrompt;
  }
};

// Client proxy function to call server-side prompt variation generator
export const generatePromptVariations = async (basePrompt: string, count: number): Promise<string[]> => {
  if (!basePrompt.trim() || count < 1) return [basePrompt];
  try {
    const response = await fetch("/api/gemini/prompt-variations", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ basePrompt, count })
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data.variations || [basePrompt];
  } catch (error) {
    console.error("Client Prompt Variations Error:", error);
    return [basePrompt];
  }
};
