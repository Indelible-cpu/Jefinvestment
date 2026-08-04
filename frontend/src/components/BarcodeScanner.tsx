import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 15, qrbox: { width: 300, height: 200 } },
      (decodedText) => {
        // Success callback
        html5QrCode.stop().then(() => {
          onScan(decodedText);
        }).catch(console.error);
      },
      (_error) => {
        // Error callback
      }
    ).catch(err => {
      console.error("Error starting scanner:", err);
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="font-bold text-lg">Scan Barcode / QR Code</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition text-gray-500">
            <X size={20} />
          </button>
        </div>
        <div className="bg-black flex-1 flex flex-col justify-center" style={{ minHeight: '320px' }}>
          <div id="reader" className="w-full overflow-hidden"></div>
        </div>
        <p className="text-center text-sm text-gray-500 py-3 bg-gray-50">
          Point your camera at a barcode to scan automatically.
        </p>
      </div>
    </div>
  );
}
