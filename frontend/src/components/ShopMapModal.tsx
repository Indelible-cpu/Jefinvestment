import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, MapPin, Save, Map as MapIcon, Image as ImageIcon, Navigation, ZoomIn, ZoomOut } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useProductStore } from '../store/cartStore';
import type { Product } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useImageEmbedding } from '../hooks/useImageEmbedding';
import { toast } from 'sonner';

interface ShopMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  mode: 'view' | 'edit';
  inline?: boolean;
}

export default function ShopMapModal({ isOpen, onClose, product, mode, inline = false }: ShopMapModalProps) {
  const { shopMapImage, updateSettings } = useSettingsStore();
  const { updateProduct } = useProductStore();
  const { user } = useAuthStore();
  const { getEmbedding, cacheEmbedding } = useImageEmbedding();
  const isAdmin = user?.role === 'ADMIN';
  const isEditMode = mode === 'edit' && isAdmin;

  const [mapCoordinates, setMapCoordinates] = useState<{ x: number; y: number } | null>(
    product?.mapCoordinates || null
  );
  const [locationText, setLocationText] = useState(product?.displayLocationText || '');
  const [productImages, setProductImages] = useState<string[]>(product?.images || []);
  const [isSaving, setIsSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMapCoordinates(product?.mapCoordinates || null);
      setLocationText(product?.displayLocationText || '');
      setProductImages(product?.images || []);
      setZoom(1);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode || !product) return;
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMapCoordinates({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    }
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-selected

    const reader = new FileReader();
    reader.onloadend = () => {
      const originalDataUrl = reader.result as string;
      // Compress before saving — Firestore has a 1 MB doc limit
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.6);
        
        toast.promise(updateSettings({ shopMapImage: compressed }), {
          loading: `Uploading map (${Math.round(compressed.length / 1024)} KB)...`,
          success: 'Shop map uploaded successfully to the cloud!',
          error: 'Failed to upload map. Please try again with a smaller photo.'
        });
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditMode || !product) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset

    const reader = new FileReader();
    reader.onloadend = () => {
      const originalDataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1000; // smaller than map because we can have multiple
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.72);
        
        setProductImages(prev => [...prev, compressed]);
        toast.success(`Photo added! (${Math.round(compressed.length / 1024)} KB)`);
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!product || !isEditMode) return;
    setIsSaving(true);
    try {
      await updateProduct({
        ...product,
        mapCoordinates,
        displayLocationText: locationText,
        images: productImages
      });

      // Background task: compute embeddings for images so AI search is instant
      if (productImages.length > 0) {
        toast.info('Generating AI embeddings for photos...', { duration: 2000 });
        Promise.all(productImages.map(async (img) => {
          const key = `${product.id}::${img.substring(0, 64)}`;
          const emb = await getEmbedding(img);
          if (emb) await cacheEmbedding(key, emb);
        })).catch(err => console.warn('Failed to embed images:', err));
      }

      toast.success('Product location and images saved successfully');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save product location');
    } finally {
      setIsSaving(false);
    }
  };

  const hasPinned = !!mapCoordinates;
  const hasLocationText = !!locationText.trim();

  if (!isOpen) return null;

  const content = (
    <div className={`bg-white flex flex-col overflow-hidden ${inline ? 'h-full w-full' : 'rounded-2xl w-full max-w-6xl max-h-[95vh] shadow-2xl'}`}>

        {/* Header */}
        <div className="px-5 py-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <MapIcon size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isEditMode ? 'Set Product Location' : 'Where is this product?'}
              </h2>
              {product && (
                <p className="text-sm text-gray-500 font-medium truncate max-w-[240px]">{product.name}</p>
              )}
            </div>
          </div>
          {!inline && (
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
              <X size={22} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">

          {/* ── No map uploaded yet ── */}
          {!shopMapImage && (
            <div className="flex flex-col items-center justify-center py-10 bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl text-center gap-3">
              <MapIcon size={48} className="text-amber-400" />
              <h3 className="text-lg font-bold text-gray-800">No Shop Map Uploaded Yet</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Take a photo of your shop layout (from above), or draw a simple floor plan and upload it here. Once uploaded, you can pin every product to its exact shelf.
              </p>
              {isAdmin && (
                <label className="relative mt-2 cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleMapUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold shadow hover:bg-blue-700 transition">
                    <Upload size={18} /> Upload Map Image
                  </div>
                </label>
              )}
            </div>
          )}

          {/* ── Map with pin ── */}
          {shopMapImage && (
            <div className="flex flex-col gap-3">
              {/* Controls */}
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs text-gray-400 font-medium mr-auto hidden sm:block">
                  {isEditMode ? '📍 Click anywhere on the map to place the product' : ''}
                </span>
                
                {isAdmin && (
                  <label className="relative cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleMapUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-xs transition">
                      <Upload size={13} /> Replace Map
                    </div>
                  </label>
                )}

                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition text-gray-600" title="Zoom out">
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-xs text-gray-500 w-10 text-center font-medium">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition text-gray-600" title="Zoom in">
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>

              {/* Map container */}
              <div
                ref={containerRef}
                className={`relative overflow-auto bg-gray-100 rounded-xl border-2 ${isEditMode ? 'border-blue-300 cursor-crosshair' : 'border-gray-200'} flex items-start justify-center min-h-[250px] md:min-h-[350px] max-h-[70vh] md:max-h-[80vh]`}
              >
                <div
                  className="relative inline-block"
                  onClick={handleMapClick}
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.2s' }}
                >
                  <img
                    ref={imageRef}
                    src={shopMapImage}
                    alt="Shop Map"
                    className="select-none block"
                    style={{ maxWidth: '100%', display: 'block' }}
                    draggable={false}
                  />

                  {/* ── The Pin ── */}
                  {mapCoordinates && (
                    <div
                      className="absolute"
                      style={{
                        left: `${mapCoordinates.x}%`,
                        top: `${mapCoordinates.y}%`,
                        transform: isEditMode ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)',
                        zIndex: 10,
                      }}
                    >
                      {!isEditMode ? (
                        <div className="relative flex items-center justify-center">
                          <span className="absolute w-7 h-7 rounded-full bg-red-500 opacity-60 animate-ping" />
                          <span className="absolute w-5 h-5 rounded-full bg-red-600 opacity-40 animate-pulse" />
                          <span className="relative w-3 h-3 bg-red-600 rounded-full border-[1.5px] border-white shadow-sm" />
                        </div>
                      ) : (
                        <>
                          {/* Pulse ring */}
                          <span className="absolute inset-0 flex items-end justify-center">
                            <span className="w-5 h-5 rounded-full bg-red-500/30 animate-ping absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1.5" />
                          </span>
                          {/* Shadow dot on ground */}
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-1 bg-black/20 rounded-full blur-[1px]" />
                          {/* Pin icon */}
                          <MapPin size={22} className="text-red-600 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" fill="#dc2626" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── No pin set — view mode warning ── */}
          {shopMapImage && !hasPinned && !isEditMode && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <Navigation size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800 text-sm">Location not set yet</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  An admin needs to open "Edit Location" for this product and click on the map to mark where it is stored.
                </p>
              </div>
            </div>
          )}

          {/* ── Location text description ── */}
          {(hasLocationText || isEditMode) && (
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                📝 Location Description (human-readable hint)
              </label>
              {isEditMode ? (
                <textarea
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder='e.g. "Second shelf from the top, left side of the accessories section"'
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition text-sm"
                  rows={2}
                />
              ) : (
                <div className="p-3 bg-blue-50 text-blue-900 rounded-lg font-medium border border-blue-100 text-sm flex items-start gap-2">
                  <Navigation size={16} className="shrink-0 mt-0.5 text-blue-600" />
                  {locationText}
                </div>
              )}
            </div>
          )}

          {/* ── Product image upload (edit mode) ── */}
          {isEditMode && (
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-gray-700">📷 Product Photos</label>
                <label className="relative cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleProductImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium text-xs transition border border-blue-200">
                    <ImageIcon size={13} /> Add Photo
                  </div>
                </label>
              </div>
              {productImages.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No photos yet. Adding photos enables AI visual search.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto md:flex-wrap pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {productImages.map((img, idx) => (
                    <div key={idx} className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-lg border shadow-sm overflow-hidden relative group">
                      <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setProductImages(productImages.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Product photos in view mode */}
          {!isEditMode && productImages.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">Product Photos</h3>
              <div className="flex gap-3 overflow-x-auto md:flex-wrap pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {productImages.map((img, idx) => (
                  <div key={idx} className="w-20 h-20 md:w-32 md:h-32 shrink-0 rounded-lg border shadow-sm overflow-hidden">
                    <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isEditMode && (
          <div className="px-5 py-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
            <p className="text-xs text-gray-400">
              {hasPinned ? `📍 Pin set at (${mapCoordinates!.x.toFixed(1)}%, ${mapCoordinates!.y.toFixed(1)}%)` : 'No pin placed yet'}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition text-sm">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl font-bold bg-primary text-white hover:bg-blue-700 transition shadow-lg shadow-primary/30 flex items-center gap-2 text-sm disabled:opacity-60"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </div>
        )}
      </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
      {content}
    </div>
  );
}
