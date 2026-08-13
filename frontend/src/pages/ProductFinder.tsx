import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Search as SearchIcon, MapPin, ScanBarcode,
  Box, Map as MapIcon,
  Image as ImageIcon, Camera, Sparkles, Loader2
} from 'lucide-react';
import { useProductStore } from '../store/cartStore';
import type { Product } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import ShopMapModal from '../components/ShopMapModal';
import { useImageEmbedding, cosineSimilarity } from '../hooks/useImageEmbedding';
import { toast } from 'sonner';

// Lazy-loaded heavy components (only downloaded when user opens them)
const CameraOcrModal = lazy(() => import('../components/CameraOcrModal'));
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'));

// ── Similarity threshold: only show image matches above 40% ─────────────────
const SIMILARITY_THRESHOLD = 0.40;

interface ImageMatch {
  product: Product;
  score: number; // 0–1
}

export default function ProductFinder() {
  const { products } = useProductStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const { getEmbedding, getCachedEmbedding, cacheEmbedding } = useImageEmbedding();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapMode, setMapMode] = useState<'view' | 'edit'>('view');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  // Phase 3 image similarity state
  const [imageMatches, setImageMatches] = useState<ImageMatch[]>([]);
  const [isImageSearching, setIsImageSearching] = useState(false);
  const [imageSearchProgress, setImageSearchProgress] = useState({ current: 0, total: 0 });
  const [lastScannedImage, setLastScannedImage] = useState<string | null>(null);

  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const normalizeString = (str: string) =>
    str.toLowerCase().replace(/[\s\-_.,()[\]]+/g, '');

  // Character bigram similarity for typo tolerance (0–1)
  const bigramSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const getBigrams = (s: string) => {
      const set = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
      return set;
    };
    const ba = getBigrams(a), bb = getBigrams(b);
    let intersection = 0;
    ba.forEach(g => { if (bb.has(g)) intersection++; });
    return (2 * intersection) / (ba.size + bb.size || 1);
  };

  // ── Ranked Text Search ─────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const q = normalizeString(debouncedSearch);
    const raw = debouncedSearch.toLowerCase().trim();

    type Scored = { product: Product; score: number };
    const scored: Scored[] = [];

    for (const p of products) {
      if (p.isService) continue;
      const name = normalizeString(p.name);
      const sku  = normalizeString(p.sku);
      const aliases = (p.aliases || []).map(normalizeString);
      const allFields = [name, sku, ...aliases];

      let score = 0;

      // Exact full match — highest priority
      if (allFields.some(f => f === q)) { score = 100; }
      // Starts-with match
      else if (allFields.some(f => f.startsWith(q))) { score = 80; }
      // Contains match
      else if (allFields.some(f => f.includes(q))) { score = 60; }
      // Bigram typo-tolerance (catches 1–2 character typos)
      else {
        const best = Math.max(...allFields.map(f => bigramSimilarity(q, f)));
        if (best >= 0.5) score = Math.round(best * 50); // 25–50 range
      }

      // Also check raw (un-normalized) search against display name for flexibility
      if (score === 0 && p.name.toLowerCase().includes(raw)) score = 55;

      if (score > 0) scored.push({ product: p, score });
    }

    // Sort by score descending (best match first)
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.product);
  }, [debouncedSearch, products]);

  // ── Closest-match suggestion when nothing found ────────────────────────────
  const closestMatch = useMemo(() => {
    if (filteredProducts.length > 0 || !debouncedSearch.trim()) return null;
    const q = normalizeString(debouncedSearch);
    let best: Product | null = null, bestScore = 0;
    for (const p of products) {
      if (p.isService) continue;
      const score = bigramSimilarity(q, normalizeString(p.name));
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= 0.35 ? best : null;
  }, [debouncedSearch, filteredProducts.length, products]);


  // ── Map handlers ───────────────────────────────────────────────────────────
  const handleOpenMap = useCallback((product: Product, edit: boolean = false) => {
    setSelectedProduct(product);
    setMapMode(edit ? 'edit' : 'view');
    setMapModalOpen(true);
  }, []);

  const handleOpenGlobalMap = () => {
    setSelectedProduct(null);
    setMapMode('edit');
    setMapModalOpen(true);
  };

  // ── Auto-select single match ───────────────────────────────────────────────
  useEffect(() => {
    if (debouncedSearch.trim() && filteredProducts.length === 1) {
      // Auto-select on desktop, auto-open modal on mobile
      setSelectedProduct(filteredProducts[0]);
      setMapMode('view');
      // Only auto-open modal on mobile to avoid stealing focus on desktop
      if (window.innerWidth < 768) {
         setMapModalOpen(true);
      }
    }
  }, [debouncedSearch, filteredProducts]);

  // ── OCR text handler (Phase 2) ─────────────────────────────────────────────
  const handleOcrText = (text: string) => {
    setSearchTerm(text);
    setDebouncedSearch(text);
  };

  // ── Image similarity handler (Phase 3) ────────────────────────────────────
  const handleImageCaptured = useCallback(async (imageDataUrl: string) => {
    // Clear previous image results
    setImageMatches([]);
    setLastScannedImage(imageDataUrl);

    // Only search products that have at least one stored image
    const productsWithImages = products.filter(
      p => !p.isService && p.images && p.images.length > 0
    );

    if (productsWithImages.length === 0) {
      toast.info('No products have photos yet. Add product photos via Edit Location/Photos.');
      return;
    }

    setIsImageSearching(true);
    setImageSearchProgress({ current: 0, total: productsWithImages.length });
    toast.info('Comparing image against product photos...');

    try {
      // 1. Generate embedding for the captured query image
      const queryEmbedding = await getEmbedding(imageDataUrl);
      if (!queryEmbedding) {
        toast.error('Could not process the captured image. Please try again.');
        setIsImageSearching(false);
        return;
      }

      // 2. For each product with images, get or generate embeddings and compare
      const matches: ImageMatch[] = [];

      for (const product of productsWithImages) {
        let bestScore = 0;

        for (const imgUrl of (product.images ?? [])) {
          const cacheKey = `${product.id}::${imgUrl.substring(0, 64)}`;

          // Try cache first to avoid re-processing
          let productEmbedding = await getCachedEmbedding(cacheKey);

          if (!productEmbedding) {
            productEmbedding = await getEmbedding(imgUrl);
            if (productEmbedding) {
              await cacheEmbedding(cacheKey, productEmbedding);
            }
          }

          if (productEmbedding) {
            const score = cosineSimilarity(queryEmbedding, productEmbedding);
            if (score > bestScore) bestScore = score;
          }
        }

        if (bestScore >= SIMILARITY_THRESHOLD) {
          matches.push({ product, score: bestScore });
        }

        // Yield and update progress every 10 products
        if ((matches.length + 1) % 10 === 0) {
          setImageSearchProgress(prev => ({ ...prev, current: prev.current + 10 }));
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      setImageSearchProgress({ current: productsWithImages.length, total: productsWithImages.length });

      // 3. Sort by score descending
      matches.sort((a, b) => b.score - a.score);
      setImageMatches(matches);

      if (matches.length === 0) {
        toast.info('No visually similar products found. Try a clearer photo or add product photos.');
      } else {
        toast.success(`Found ${matches.length} visually similar product${matches.length > 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('[ImageSearch] Error:', err);
      toast.error('Image similarity search failed. Please try again.');
    } finally {
      setIsImageSearching(false);
    }
  }, [products, getEmbedding, getCachedEmbedding, cacheEmbedding]);

  // ── Product card ───────────────────────────────────────────────────────────
  const renderProductCard = (product: Product, confidenceScore?: number) => {
    return (
      <div key={product.id + (confidenceScore ?? 'text')} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden">

        {/* Top image strip */}
        <div className="relative w-full h-36 bg-gray-100 shrink-0">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1">
              <ImageIcon size={32} />
              <span className="text-[10px] font-medium text-gray-400">No Photo</span>
            </div>
          )}
          {/* Badge top-left: AI match indicator */}
          <div className="absolute top-2 left-2">
            {confidenceScore !== undefined ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-full shadow">
                <Sparkles size={9} />{Math.round(confidenceScore * 100)}% match
              </span>
            ) : product.images && product.images.length > 0 ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow">
                <Sparkles size={9} />AI Ready
              </span>
            ) : null}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2 p-3 flex-1">
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2" title={product.name}>{product.name}</h3>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">{product.sku}</p>
          </div>
          {product.displayLocationText && (
            <p className="text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 font-medium line-clamp-1">
              📍 {product.displayLocationText}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex border-t border-gray-100 divide-x divide-gray-100">
          <button
            onClick={() => handleOpenMap(product, false)}
            className="flex-1 py-2.5 text-sm font-bold text-gray-800 flex items-center justify-center gap-1.5 hover:bg-gray-50 transition"
          >
            <MapPin size={14} /> Locate
          </button>
          {isAdmin && (
            <button
              onClick={() => handleOpenMap(product, true)}
              className="flex-1 py-2.5 text-sm font-bold text-blue-600 flex items-center justify-center gap-1.5 hover:bg-blue-50 transition"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    );
  };

  const hasAnyResults = filteredProducts.length > 0 || imageMatches.length > 0;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (filteredProducts.length === 1) {
        handleOpenMap(filteredProducts[0], false);
      } else if (filteredProducts.length > 1) {
        toast.info('Multiple products found. Please click "Open Map" on the correct item.');
      } else {
        toast.error('No products found matching that search.');
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-white">
      {/* ── LEFT PANEL: Search & Results ── */}
      <div className="w-full md:w-5/12 lg:w-1/3 flex flex-col p-4 md:p-6 border-r border-gray-200 overflow-y-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SearchIcon className="text-primary" />
            Product Finder
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Search by name, alias, barcode — or scan a product with your camera.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenGlobalMap}
            className="px-4 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl border border-blue-200 hover:bg-blue-100 transition flex items-center gap-2"
          >
            <MapIcon size={18} />
            Manage Shop Map
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon className="h-6 w-6 text-gray-400 group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="e.g. A12, Galaxy A12, SM-A125... (Press Enter to auto-locate)"
          className="w-full pl-12 pr-24 py-4 bg-white border-2 border-gray-200 rounded-2xl text-lg focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none shadow-sm"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
          <button
            onClick={() => { setImageMatches([]); setCameraModalOpen(true); }}
            title="Scan product with camera (OCR + AI Image Match)"
            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
          >
            <Camera className="h-6 w-6" />
          </button>
          <div className="text-gray-300">|</div>
          <button
            onClick={() => setBarcodeModalOpen(true)}
            title="Barcode scan"
            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
          >
            <ScanBarcode className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* AI Image Searching spinner & progress */}
      {isImageSearching && (
        <div className="flex flex-col gap-3 px-5 py-4 bg-purple-50 border border-purple-200 rounded-2xl text-purple-800">
          <div className="flex items-center gap-3">
            <Loader2 size={22} className="animate-spin shrink-0" />
            <div>
              <p className="font-bold text-sm">AI Image Matching</p>
              <p className="text-xs text-purple-600">
                Comparing photo against product images... ({imageSearchProgress.current}/{imageSearchProgress.total})
              </p>
            </div>
            {lastScannedImage && (
              <img src={lastScannedImage} alt="Scanned" className="ml-auto w-12 h-12 rounded-lg object-cover border border-purple-200 shrink-0" />
            )}
          </div>
          {imageSearchProgress.total > 0 && (
            <div className="w-full bg-purple-200 rounded-full h-1.5">
              <div 
                className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(imageSearchProgress.current / imageSearchProgress.total) * 100}%` }}
              ></div>
            </div>
          )}
        </div>
      )}

      {/* Image Match Results (Phase 3) */}
      {!isImageSearching && imageMatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-600" />
            <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wider">
              {imageMatches.length} AI Image Match{imageMatches.length > 1 ? 'es' : ''}
            </h2>
            <button onClick={() => setImageMatches([])} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {imageMatches.map(({ product, score }) => renderProductCard(product, score))}
          </div>
        </div>
      )}

      {/* Text Search Results (Phases 1 & 2) */}
      {debouncedSearch && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            {filteredProducts.length} Text Results
          </h2>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {filteredProducts.map(product => renderProductCard(product))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
              <Box size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No products found for "{debouncedSearch}"</h3>
              {closestMatch ? (
                <div className="mt-4 inline-block bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                  <p className="text-sm text-amber-700 font-medium mb-2">Did you mean:</p>
                  <button
                    onClick={() => { setSearchTerm(closestMatch.name); setDebouncedSearch(closestMatch.name); }}
                    className="font-bold text-primary hover:underline text-base"
                  >
                    {closestMatch.name}
                  </button>
                  <button
                    onClick={() => handleOpenMap(closestMatch, false)}
                    className="ml-3 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-gray-700 transition"
                  >
                    📍 Locate It
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 mt-1">Try adjusting your search or scan with the camera.</p>
              )}
            </div>
          )}

        </div>
      )}

      {/* Empty state — nothing searched yet */}
      {!debouncedSearch && !hasAnyResults && !isImageSearching && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <SearchIcon size={32} className="text-primary" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Find Any Product Instantly</h3>
          <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed">
            Type a product name, model number, or alias above — or tap the 📷 camera icon to scan a product box with OCR and AI image matching.
          </p>
        </div>
      )}

      </div>

      {/* ── RIGHT PANEL: Desktop Live Map Preview ── */}
      <div className="hidden md:flex flex-1 bg-gray-50 p-6 relative overflow-hidden">
        <ShopMapModal
          isOpen={true}
          onClose={() => {}}
          product={selectedProduct}
          mode={mapMode}
          inline={true}
        />
      </div>

      {/* ── Mobile Map Modal ── */}
      <div className="md:hidden">
        <ShopMapModal
          isOpen={mapModalOpen}
          onClose={() => setMapModalOpen(false)}
          product={selectedProduct}
          mode={mapMode}
        />
      </div>

      {/* Camera OCR + Image Similarity Modal (lazy-loaded) */}
      <Suspense fallback={<div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center"><Loader2 size={40} className="text-white animate-spin" /></div>}>
        {cameraModalOpen && (
          <CameraOcrModal
            isOpen={cameraModalOpen}
            onClose={() => setCameraModalOpen(false)}
            onTextExtracted={handleOcrText}
            onImageCaptured={handleImageCaptured}
          />
        )}
      </Suspense>

      {/* Barcode Scanner Modal (lazy-loaded) */}
      <Suspense fallback={<div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center"><Loader2 size={40} className="text-white animate-spin" /></div>}>
        {barcodeModalOpen && (
          <BarcodeScanner
            onClose={() => setBarcodeModalOpen(false)}
            onScan={(text) => {
              setSearchTerm(text);
              setDebouncedSearch(text);
              setBarcodeModalOpen(false);
              toast.success(`Barcode scanned: ${text}`);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
