import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, RefreshCw, CheckCircle, Loader2, ScanText } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { toast } from 'sonner';

interface CameraOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTextExtracted: (text: string) => void;
  onImageCaptured?: (imageDataUrl: string) => void;
}

type ModalState = 'camera' | 'captured' | 'processing' | 'done';

export default function CameraOcrModal({ isOpen, onClose, onTextExtracted, onImageCaptured }: CameraOcrModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [modalState, setModalState] = useState<ModalState>('camera');
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState('Initializing...');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
    } catch (err) {
      console.error('Camera access denied:', err);
      setHasPermission(false);
      toast.error('Camera access denied. Please allow camera permissions and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setModalState('camera');
      setCapturedImageUrl(null);
      setOcrProgress('Initializing...');
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImageUrl(imageUrl);
    stopCamera();
    setModalState('captured');
    // Pass image back immediately for parallel image-similarity processing
    onImageCaptured?.(imageUrl);
  };

  const handleRetake = () => {
    setCapturedImageUrl(null);
    setModalState('camera');
    startCamera();
  };

  const handleExtract = async () => {
    if (!capturedImageUrl) return;
    setModalState('processing');
    setOcrProgress('Initializing AI...');

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(`Reading text... ${Math.round(m.progress * 100)}%`);
          } else if (m.status === 'loading language traineddata') {
            setOcrProgress('Loading language model...');
          } else if (m.status === 'initializing tesseract') {
            setOcrProgress('Initializing OCR engine...');
          }
        },
      });

      const { data: { text } } = await worker.recognize(capturedImageUrl);
      const cleanedText = text.replace(/[^a-zA-Z0-9\s\-]/g, ' ').replace(/\s+/g, ' ').trim();

      if (cleanedText.length < 2) {
        toast.error('No readable text found. Try again with better lighting or a clearer angle.');
        setModalState('captured');
        return;
      }

      setModalState('done');
      onTextExtracted(cleanedText);
      toast.success(`Text extracted: "${cleanedText.substring(0, 50)}${cleanedText.length > 50 ? '...' : ''}"`);
      onClose();
    } catch (err) {
      console.error('OCR failed:', err);
      toast.error('OCR processing failed. Please try again.');
      setModalState('captured');
    } finally {
      await worker?.terminate();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-[110] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center gap-2 text-white">
          <ScanText size={22} />
          <h2 className="text-lg font-bold">Scan Product</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/20 text-white transition"
        >
          <X size={24} />
        </button>
      </div>

      {/* Camera / Preview Area */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {/* Live Camera */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${modalState !== 'camera' ? 'hidden' : ''}`}
        />

        {/* Captured image preview */}
        {capturedImageUrl && modalState !== 'camera' && (
          <img
            src={capturedImageUrl}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Permission Denied */}
        {hasPermission === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-8">
            <Camera size={64} className="mb-4 opacity-40" />
            <p className="text-xl font-bold mb-2">Camera Access Denied</p>
            <p className="text-white/60 text-sm">
              Please allow camera permissions in your browser settings, then try again.
            </p>
          </div>
        )}

        {/* Focus guide overlay (only during camera mode) */}
        {modalState === 'camera' && hasPermission === true && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-3/4 h-1/2 border-2 border-white/60 rounded-xl" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }}>
              <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl" />
              <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr" />
              <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl" />
              <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-white rounded-br" />
            </div>
            <p className="absolute bottom-24 text-white text-sm font-medium bg-black/50 px-4 py-1.5 rounded-full">
              Point camera at product label or box
            </p>
          </div>
        )}

        {/* Processing overlay */}
        {modalState === 'processing' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-xs w-full mx-4">
              <Loader2 size={48} className="mx-auto text-primary animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Reading Text</h3>
              <p className="text-sm text-gray-500">{ocrProgress}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 px-6 py-6 bg-black/80 backdrop-blur-sm flex gap-4 items-center justify-center">
        {modalState === 'camera' && (
          <button
            onClick={handleCapture}
            disabled={hasPermission !== true}
            className="w-20 h-20 rounded-full bg-white border-4 border-primary flex items-center justify-center shadow-xl active:scale-95 transition disabled:opacity-50"
          >
            <Camera size={32} className="text-primary" />
          </button>
        )}

        {modalState === 'captured' && (
          <>
            <button
              onClick={handleRetake}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/10 text-white font-bold rounded-2xl border border-white/20 hover:bg-white/20 transition"
            >
              <RefreshCw size={20} />
              Retake
            </button>
            <button
              onClick={handleExtract}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/40 hover:bg-blue-700 transition"
            >
              <CheckCircle size={20} />
              Extract Text
            </button>
          </>
        )}
      </div>
    </div>
  );
}
