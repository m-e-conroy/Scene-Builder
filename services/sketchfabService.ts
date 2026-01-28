
import { CloudAsset } from "../types";

const BASE_URL = 'https://api.sketchfab.com/v3';

export const searchSketchfab = async (query: string, token?: string): Promise<CloudAsset[]> => {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Token ${token}`;

  // Search for downloadable models, sorted by like count to ensure quality
  const url = `${BASE_URL}/search?type=models&downloadable=true&q=${encodeURIComponent(query)}&sort_by=-likeCount&count=24`;
  
  const res = await fetch(url, { headers });
  if (!res.ok) {
     if (res.status === 401) throw new Error('Invalid Sketchfab API Token');
     throw new Error('Sketchfab search failed');
  }
  
  const data = await res.json();
  
  return data.results.map((item: any) => {
    // Attempt to find the largest thumbnail
    const images = item.thumbnails.images;
    const bestImage = images.sort((a: any, b: any) => b.width - a.width)[0]?.url || '';
    
    // License mapping
    const licenseLabel = item.license ? item.license.label : 'Unknown';

    return {
      uid: item.uid,
      sketchfabId: item.uid,
      name: item.name,
      thumbnail: bestImage,
      author: item.user.displayName,
      modelUrl: item.viewerUrl,
      license: licenseLabel,
      downloadUrl: undefined // To be fetched
    };
  });
};

export const getModelDownloadUrl = async (uid: string, token: string): Promise<string | null> => {
  if (!token) throw new Error('API Token required for download');

  const res = await fetch(`${BASE_URL}/models/${uid}/download`, {
    headers: { 'Authorization': `Token ${token}` }
  });
  
  if (!res.ok) {
      if (res.status === 401) throw new Error('Invalid API Token');
      if (res.status === 403) throw new Error('Access Denied (Check License/Plan)');
      throw new Error('Failed to retrieve download URL');
  }
  
  const data = await res.json();
  
  // Sketchfab returns a list of formats. We prefer glb, then gltf.
  // The structure is usually: { glb: { url: ..., size: ... }, gltf: { ... }, ... }
  
  if (data.glb && data.glb.url) return data.glb.url;
  if (data.gltf && data.gltf.url) return data.gltf.url;
  
  return null;
};
