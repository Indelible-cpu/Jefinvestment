import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, MapPin, Save, Map as MapIcon, Image as ImageIcon } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useProductStore } from '../store/cartStore';
import type { Product } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface ShopMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  mode: 'view' | 'edit';
}

export default function ShopMapModal({ isOpen, onClose, product, mode }: ShopMapModalProps) {
  const { shopMapImage, updateSettings } = useSettingsStore();
  const { updateProduct } = useProductStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const isEditMode = mode === 'edit' && isAdmin;

  const [mapCoordinates, setMapCoordinates] = useState<{ x: number; y: number } | null>(
    product?.mapCoordinates || null
  );
  const [locationText, setLocationText] = useState(product?.displayLocationText || '');
  const [productImages, setProductImages] = useState<string[]>(product?.images || []);
  const [isSaving, setIsSaving] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMapCoordinates(product?.mapCoordinates || null);
      setLocationText(product?.displayLocationText || '');
      setProductImages(product?.images || []);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode || !product) return;
    
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMapCoordinates({ x, y });
    }
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateSettings({ shopMapImage: reader.result as string });
        toast.success('Shop map updated successfully');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditMode || !product) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductImages([...productImages, reader.result as string]);
        toast.success('Product image added. Remember to save.');
      };
      reader.readAsDataURL(file);
    }
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
      toast.success('Product location and images saved successfully');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save product location');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <MapIcon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEditMode ? 'Edit Product Location' : 'Shop Map'}
              </h2>
              {product && (
                <p className="text-sm text-gray-500 font-medium">{product.name} ({product.sku})</p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {/* Admin Controls */}
          {isAdmin && (
            <div className="flex flex-wrap items-end gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">Upload Shop Map Image</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleMapUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition shadow-sm font-medium w-fit">
                    <Upload size={18} />
                    <span>Choose Map Image</span>
                  </div>
                </div>
              </div>
              
              {isEditMode && (
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Upload Product Image</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleProductImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition shadow-sm font-medium w-fit">
                      <ImageIcon size={18} />
                      <span>Add Product Photo</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Map Display */}
          <div className="bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 p-2 flex flex-col items-center justify-center relative min-h-[300px] overflow-hidden">
            {shopMapImage ? (
              <div 
                className={`relative inline-block ${isEditMode ? 'cursor-crosshair' : ''}`}
                onClick={handleMapClick}
              >
                <img 
                  ref={imageRef}
                  src={shopMapImage} 
                  alt="Shop Map" 
                  className="max-w-full max-h-[50vh] object-contain rounded shadow-sm select-none"
                />
                
                {mapCoordinates && (
                  <div 
                    className="absolute w-8 h-8 -ml-4 -mt-8 flex items-center justify-center text-red-600 drop-shadow-md animate-bounce"
                    style={{ left: `${mapCoordinates.x}%`, top: `${mapCoordinates.y}%` }}
                  >
                    <MapPin size={32} fill="currentColor" className="text-white" />
                  </div>
                )}
                
                {isEditMode && (
                   <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                     Click anywhere on map to set position
                   </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 flex flex-col items-center p-8 text-center">
                <MapIcon size={48} className="mb-3 opacity-50" />
                <p className="font-medium text-lg">No shop map available</p>
                {isAdmin && <p className="text-sm mt-1">Upload a map image using the control above</p>}
              </div>
            )}
          </div>

          {/* Location Info */}
          {(locationText || isEditMode) && (
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-2">Location Description</label>
              {isEditMode ? (
                <textarea
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="e.g. Near the front glass display, second section from the left."
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                  rows={2}
                />
              ) : (
                <div className="p-3 bg-blue-50 text-blue-900 rounded-lg font-medium border border-blue-100">
                  {locationText || 'No description available.'}
                </div>
              )}
            </div>
          )}

          {/* Product Images Preview */}
          {productImages.length > 0 && (
             <div>
               <h3 className="text-sm font-bold text-gray-700 mb-3">Product Photos</h3>
               <div className="flex gap-3 overflow-x-auto pb-2">
                 {productImages.map((img, idx) => (
                   <div key={idx} className="w-24 h-24 shrink-0 rounded-lg border shadow-sm overflow-hidden relative group">
                     <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                     {isEditMode && (
                       <button 
                         onClick={() => setProductImages(productImages.filter((_, i) => i !== idx))}
                         className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                         <X size={14} />
                       </button>
                     )}
                   </div>
                 ))}
               </div>
             </div>
          )}

        </div>

        {/* Footer */}
        {isEditMode && (
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl font-bold bg-primary text-white hover:bg-blue-700 transition shadow-lg shadow-primary/30 flex items-center gap-2"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
