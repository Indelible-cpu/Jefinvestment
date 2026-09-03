import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, RefreshCw, CheckCircle, FlipHorizontal } from 'lucide-react';
import { toast } from 'sonner';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  captureMode?: 'portrait' | 'document';
  onCapture: (imageDataUrl: string) => void;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  title,
  captureMode = 'portrait',
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    captureMode === 'portrait' ? 'user' : 'environment'
  );
  const [devicesCount, setDevicesCount] = useState<number>(1);

  // Check available video devices
  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        setDevicesCount(videoDevs.length);
      }).catch(() => {});
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: captureMode === 'portrait' ? 1280 : 1920 },
          height: { ideal: captureMode === 'portrait' ? 1280 : 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
    } catch (err) {
      console.error('Camera access error:', err);
      // If requested facingMode failed, try fallback without facing constraint
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
      } catch (fallbackErr) {
        console.error('Fallback camera error:', fallbackErr);
        setHasPermission(false);
        toast.error('Camera access denied. Please check your browser permissions.');
      }
    }
  }, [captureMode, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setCapturedImageUrl(null);
      const defaultFacing = captureMode === 'portrait' ? 'user' : 'environment';
      setFacingMode(defaultFacing);
      startCamera(defaultFacing);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, captureMode, startCamera, stopCamera]);

  const toggleCamera = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if using front selfie camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedImageUrl(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImageUrl(null);
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (!capturedImageUrl) return;
    onCapture(capturedImageUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[120] flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-950/80 border-b border-gray-800 text-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-gray-100">{title}</h3>
              <p className="text-xs text-gray-400">
                {captureMode === 'portrait' ? 'Align face in the frame' : 'Align ID card or document clearly'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!capturedImageUrl && devicesCount > 1 && (
              <button
                type="button"
                onClick={toggleCamera}
                title="Switch Camera"
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition"
              >
                <FlipHorizontal size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="relative flex-1 min-h-[320px] sm:min-h-[380px] bg-black flex items-center justify-center overflow-hidden">
          {!capturedImageUrl ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />
              
              {/* Overlay guidelines */}
              {hasPermission && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  {captureMode === 'portrait' ? (
                    <div className="w-56 h-64 border-2 border-dashed border-blue-400/70 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                      <span className="text-white/70 text-xs font-medium bg-black/60 px-2 py-0.5 rounded-full">
                        Face Guide
                      </span>
                    </div>
                  ) : (
                    <div className="w-full max-w-sm h-52 border-2 border-white/70 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
                      <span className="text-white/80 text-xs font-medium bg-black/60 px-3 py-1 rounded-full">
                        Card / ID Outline
                      </span>
                    </div>
                  )}
                </div>
              )}

              {hasPermission === false && (
                <div className="text-center p-6 text-white max-w-xs">
                  <Camera size={48} className="mx-auto mb-3 text-red-400 opacity-60" />
                  <p className="font-semibold text-sm mb-1">Camera Permission Required</p>
                  <p className="text-xs text-gray-400">Please enable camera access in your browser settings to take photos directly.</p>
                </div>
              )}
            </>
          ) : (
            <img
              src={capturedImageUrl}
              alt="Snapshot Preview"
              className="w-full h-full object-contain bg-gray-950"
            />
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer controls */}
        <div className="p-4 bg-gray-950/90 border-t border-gray-800 flex items-center justify-between gap-3">
          {!capturedImageUrl ? (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={handleCapture}
                disabled={!hasPermission}
                className="w-16 h-16 rounded-full bg-white border-4 border-blue-600 flex items-center justify-center shadow-lg active:scale-95 transition disabled:opacity-40"
                title="Take Snapshot"
              >
                <Camera size={26} className="text-blue-600" />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-medium text-sm transition"
              >
                <RefreshCw size={16} /> Retake
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition shadow-lg shadow-blue-600/30"
              >
                <CheckCircle size={16} /> Use Photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
