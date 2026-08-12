/**
 * useImageEmbedding.ts
 * Phase 3 — AI Image Similarity
 *
 * Uses MobileNet v1 (alpha 0.25 — lightest variant ~1.9 MB model) to generate
 * image embeddings. Embeddings are cached in IndexedDB via `idb` so the model
 * only needs to process each product image once per device.
 *
 * Module-level singletons ensure the model is only loaded once per session.
 */
import { useCallback } from 'react';
import { openDB } from 'idb';

// ── IndexedDB cache ────────────────────────────────────────────────────────────
const DB_NAME = 'jims-image-embeddings';
const STORE_NAME = 'embeddings';

const getDB = async () =>
  openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });

// ── Model singleton ────────────────────────────────────────────────────────────
// Lazily import heavy TF.js packages so they don't bloat the initial bundle.
type MobileNetModel = {
  infer: (img: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement, embedding?: boolean) => { data: () => Promise<Float32Array>; dispose: () => void };
};

let modelRef: MobileNetModel | null = null;
let modelLoadPromise: Promise<MobileNetModel> | null = null;

export const loadMobileNet = async (): Promise<MobileNetModel> => {
  if (modelRef) return modelRef;
  if (modelLoadPromise) return await modelLoadPromise;

  modelLoadPromise = (async () => {
    // Dynamic imports keep TF.js out of the initial bundle
    await import('@tensorflow/tfjs');
    const mobilenetModule = await import('@tensorflow-models/mobilenet');
    // alpha 0.25 = lightest/fastest variant — suitable for low-end Android
    const model = await mobilenetModule.load({ version: 1, alpha: 0.25 });
    modelRef = model as unknown as MobileNetModel;
    return modelRef;
  })();

  return await modelLoadPromise;
};

// ── Math helpers ───────────────────────────────────────────────────────────────
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export const useImageEmbedding = () => {
  /**
   * Generate an embedding vector for an image source.
   * Accepts a data URL string, HTMLImageElement, or HTMLCanvasElement.
   */
  const getEmbedding = useCallback(
    async (imageSource: HTMLImageElement | HTMLCanvasElement | string): Promise<number[] | null> => {
      try {
        const model = await loadMobileNet();

        let imgEl: HTMLImageElement | HTMLCanvasElement;
        if (typeof imageSource === 'string') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = imageSource;
          });
          imgEl = img;
        } else {
          imgEl = imageSource;
        }

        const tensor = model.infer(imgEl, true);
        const data = await tensor.data();
        tensor.dispose();
        return Array.from(data);
      } catch (err) {
        console.error('[ImageEmbedding] Failed to generate embedding:', err);
        return null;
      }
    },
    []
  );

  /** Retrieve a cached embedding from IndexedDB. Returns null if not cached. */
  const getCachedEmbedding = useCallback(async (key: string): Promise<number[] | null> => {
    try {
      const db = await getDB();
      const val = await db.get(STORE_NAME, key);
      return val ?? null;
    } catch {
      return null;
    }
  }, []);

  /** Persist an embedding to IndexedDB. */
  const cacheEmbedding = useCallback(async (key: string, embedding: number[]): Promise<void> => {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, embedding, key);
    } catch (err) {
      console.warn('[ImageEmbedding] Failed to cache embedding:', err);
    }
  }, []);

  return { getEmbedding, getCachedEmbedding, cacheEmbedding };
};
