/**
 * useEmbeddingPrewarm.ts
 * Phase 2 — Background AI Embedding Pre-computation
 *
 * Silently walks all products that have photos and generates + caches their
 * MobileNet embeddings in IndexedDB. Runs once per browser session so that
 * when a cashier takes a photo, all comparisons are instant (no on-the-fly
 * processing for existing products).
 *
 * Safe rules:
 *  - Runs entirely in the background — never blocks UI
 *  - Skips products that already have a cached embedding
 *  - Self-throttles: processes one image at a time with a small delay
 *  - Session-flagged: only runs once per page load
 */

import { useEffect, useRef } from 'react';
import { useProductStore } from '../store/cartStore';
import { loadMobileNet, cosineSimilarity as _cs } from './useImageEmbedding';
import { openDB } from 'idb';

export { cosineSimilarity as _cosineSimilarity } from './useImageEmbedding';

const DB_NAME  = 'jims-image-embeddings';
const STORE    = 'embeddings';

const getDB = () =>
  openDB(DB_NAME, 1, { upgrade(db) { db.createObjectStore(STORE); } });

const cacheKey = (productId: string, imgUrl: string) =>
  `${productId}::${imgUrl.substring(0, 64)}`;

/** Check if an embedding is already cached */
const isCached = async (key: string): Promise<boolean> => {
  try {
    const db  = await getDB();
    const val = await db.get(STORE, key);
    return val != null;
  } catch { return false; }
};

/** Save embedding to IndexedDB */
const saveEmbedding = async (key: string, embedding: number[]): Promise<void> => {
  try {
    const db = await getDB();
    await db.put(STORE, embedding, key);
  } catch (err) {
    console.warn('[Prewarm] Failed to cache embedding:', err);
  }
};

/** Tiny delay helper to avoid starving the event loop */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Session-level guard: only prewarm once per page load
let prewarmDone = false;

export const useEmbeddingPrewarm = () => {
  const { products } = useProductStore();
  const runningRef   = useRef(false);

  useEffect(() => {
    // Don't start if already running, done this session, or no products
    if (prewarmDone || runningRef.current || products.length === 0) return;

    const productsWithImages = products.filter(
      p => !p.isService && p.images && p.images.length > 0
    );
    if (productsWithImages.length === 0) return;

    // Delay prewarm by 10s so it never competes with initial page load
    const delayTimer = setTimeout(() => {
      if (prewarmDone || runningRef.current) return;
      runningRef.current = true;

      (async () => {
        try {
          const model = await loadMobileNet();
          let processed = 0;

          for (const product of productsWithImages) {
            for (const imgUrl of (product.images ?? [])) {
              const key = cacheKey(product.id, imgUrl);
              if (await isCached(key)) continue;

              try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise<void>((resolve, reject) => {
                  img.onload  = () => resolve();
                  img.onerror = reject;
                  img.src     = imgUrl;
                });

                const tensor    = model.infer(img, true);
                const data      = await tensor.data();
                tensor.dispose();
                await saveEmbedding(key, Array.from(data));
                processed++;

                // 100ms yield between images — wider gap to stay non-blocking
                await sleep(100);
              } catch {
                // Silently skip broken images
              }
            }
          }

          if (processed > 0) {
            console.info(`[Prewarm] ✅ Generated ${processed} new AI embeddings in the background.`);
          }
        } catch (err) {
          console.warn('[Prewarm] Background pre-warm failed:', err);
        } finally {
          prewarmDone    = true;
          runningRef.current = false;
        }
      })();
    }, 10000); // 10 second idle delay

    return () => clearTimeout(delayTimer);
  }, [products]);
};

/**
 * Utility: delete all cached embeddings from IndexedDB.
 * Call this after updating the MobileNet model version.
 */
export const clearEmbeddingCache = async (): Promise<void> => {
  try {
    const db = await getDB();
    await db.clear(STORE);
    prewarmDone = false; // allow re-prewarm on next render
    console.info('[Prewarm] 🗑️  Embedding cache cleared.');
  } catch (err) {
    console.error('[Prewarm] Failed to clear cache:', err);
  }
};
