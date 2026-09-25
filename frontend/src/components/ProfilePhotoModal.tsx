import { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, Trash2, Loader2, User, GitBranch, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePhotoModal({ isOpen, onClose }: ProfilePhotoModalProps) {
  const { user, updateProfile } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset preview when modal opens/closes or user changes
  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(user?.profilePic || null);
    }
  }, [isOpen, user?.profilePic]);

  if (!isOpen || !user) return null;

  // Helper to compress image to base64 if needed
  const compressImage = (file: File, maxSize: number = 320): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', { description: 'Please choose an image file (PNG, JPG, WebP, etc.).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large', { description: 'Please choose an image under 5MB.' });
      return;
    }

    setIsUploading(true);
    try {
      // Create instant local preview
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      let finalURL = '';
      try {
        const storageRef = ref(storage, `profile-pictures/${user.id}`);
        await uploadBytes(storageRef, file);
        finalURL = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn('Firebase Storage upload failed, using compressed base64 image:', storageErr);
        finalURL = await compressImage(file, 280);
      }

      await updateProfile(user.name, finalURL);
      setPreviewUrl(finalURL);
      toast.success('Profile picture updated!', { description: 'Your new photo is now active and synced.' });
    } catch (err: any) {
      toast.error('Upload failed', { description: err.message || 'Could not update profile picture.' });
      setPreviewUrl(user.profilePic || null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!user.profilePic) return;
    setIsUploading(true);
    try {
      await updateProfile(user.name, '');
      setPreviewUrl(null);
      toast.success('Profile picture removed');
    } catch (err: any) {
      toast.error('Failed to remove photo', { description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const displayImage = previewUrl || user.profilePic;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden flex flex-col text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Profile Photo</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">View and update your profile picture</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col items-center text-center">
          {/* Large Image Preview with Change Overlay */}
          <div className="relative group mb-4">
            <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800 border-4 border-white dark:border-zinc-700 shadow-xl flex items-center justify-center relative">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 dark:text-zinc-500">
                  <User size={80} strokeWidth={1.5} />
                  <span className="text-xs mt-2 font-medium">No photo set</span>
                </div>
              )}

              {/* Uploading Overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-2">
                  <Loader2 size={32} className="animate-spin text-blue-400" />
                  <span className="text-xs font-semibold">Updating photo...</span>
                </div>
              )}
            </div>

            {/* Camera Badge to Trigger Upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-2 right-2 bg-primary hover:bg-blue-700 text-white p-3 rounded-full shadow-lg border-2 border-white dark:border-zinc-900 transition-transform active:scale-95 hover:scale-105 disabled:opacity-50"
              title="Upload new photo"
            >
              <Camera size={20} />
            </button>
          </div>

          {/* User Details */}
          <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{user.name}</h3>
          <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
              <ShieldCheck size={12} />
              {user.role}
            </span>
            {user.branchName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                <GitBranch size={12} />
                {user.branchName}
              </span>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 bg-gray-50 dark:bg-zinc-900/80 border-t border-gray-100 dark:border-zinc-800 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>{displayImage ? 'Change Photo' : 'Upload Photo'}</span>
                </>
              )}
            </button>

            {displayImage && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isUploading}
                className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-400 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium transition border border-red-200 dark:border-red-900/50 disabled:opacity-50"
                title="Remove current photo"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-1.5 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
