import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Camera, CameraOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QRData {
  sessionId: string;
  classId: string;
  type: 'START' | 'END';
  token: string;
  timestamp: number;
}

interface QRScannerProps {
  onScan: (data: QRData) => Promise<{ success: boolean; message: string }>;
}

export function QRScanner({ onScan }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label?: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStartClick = () => {
    setShowPermissionDialog(true);
  };

  const startScanner = async () => {
    try {
      // Create or get the reader element and place it into the DOM before
      // creating the Html5Qrcode instance. Html5Qrcode requires the element
      // to exist when constructed.
      let readerDiv = document.getElementById('qr-reader');
      if (!readerDiv) {
        readerDiv = document.createElement('div');
        readerDiv.id = 'qr-reader';
        readerDiv.style.width = '100%';
        readerDiv.style.height = '100%';
      }

      // Ensure the container is rendered so we can move the reader into it.
      setIsScanning(true);
      setScanResult(null);
      setShowPermissionDialog(false);

      // Wait a tick for the container to render
      await new Promise(resolve => setTimeout(resolve, 100));

      const container = document.getElementById('qr-reader-container');
      if (container && !container.contains(readerDiv)) {
        container.appendChild(readerDiv);
      }

      // If there is no container (unexpected), append to body to avoid
      // Html5Qrcode throwing "element not found".
      if (!document.getElementById('qr-reader')) {
        document.body.appendChild(readerDiv);
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      // Get available cameras
      const cams = await Html5Qrcode.getCameras();
      if (!cams || cams.length === 0) {
        toast.error('No cameras found on this device');
        setIsScanning(false);
        return;
      }

      const camList = cams.map(c => ({ id: c.id, label: c.label }));
      setCameras(camList);
      const initialCameraId = selectedCameraId || camList[0].id;
      setSelectedCameraId(initialCameraId);

      const startScanWithCamera = async (cameraId: string) => {
        try {
          await scanner.start(
            cameraId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            async (decodedText) => {
              try {
                setProcessing(true);
                const data: QRData = JSON.parse(decodedText);

                // Validate QR data structure
                if (!data.sessionId || !data.classId || !data.type || !data.token) {
                  setScanResult({ success: false, message: 'Invalid QR code format' });
                  return;
                }

                // Stop scanning while processing
                await scanner.stop();
                setIsScanning(false);

                // Process the scan
                const result = await onScan(data);
                setScanResult(result);

                if (result.success) {
                  toast.success(result.message);
                } else {
                  toast.error(result.message);
                }
              } catch (err) {
                setScanResult({ success: false, message: 'Invalid QR code' });
                toast.error('Invalid QR code format');
              } finally {
                setProcessing(false);
              }
            },
            () => {
              // QR code not detected - do nothing
            }
          );
        } catch (err) {
          console.error('Failed to start scanner with camera:', err);
          throw err;
        }
      };

      await startScanWithCamera(initialCameraId);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setIsScanning(false);
      
        const errorStr = String(err);
        const errorMessage = (err as any)?.message || errorStr;
      
        console.log('Error details:', { errorMessage, errorStr });
      
        if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission') || errorMessage.includes('denied')) {
          toast.error('Camera access denied. Please allow camera permissions in your browser settings.');
        } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('No camera')) {
          toast.error('No camera found on this device.');
        } else if (errorMessage.includes('NotReadableError') || errorMessage.includes('Could not access camera')) {
          toast.error('Camera is in use by another application. Please close other apps using the camera.');
        } else {
          toast.error('Failed to access camera. Please check permissions.');
        }
    }
  };

  const switchCamera = async (cameraId: string) => {
    if (!scannerRef.current) return;
    setSwitching(true);
    try {
      // Stop current scanner then start with new camera
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping scanner before switching:', e);
      }
      // start with new camera
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      setSelectedCameraId(cameraId);
      await scanner.start(cameraId, { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, async (decodedText) => {
        try {
          setProcessing(true);
          const data: QRData = JSON.parse(decodedText);
          if (!data.sessionId || !data.classId || !data.type || !data.token) {
            setScanResult({ success: false, message: 'Invalid QR code format' });
            return;
          }
          await scanner.stop();
          setIsScanning(false);
          const result = await onScan(data);
          setScanResult(result);
          if (result.success) toast.success(result.message); else toast.error(result.message);
        } catch (err) {
          setScanResult({ success: false, message: 'Invalid QR code' });
        } finally {
          setProcessing(false);
        }
      }, () => {});
    } catch (err) {
      console.error('Error switching camera:', err);
      toast.error('Failed to switch camera');
    } finally {
      setSwitching(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);

    // Remove the reader element from the DOM to clean up
    try {
      const reader = document.getElementById('qr-reader');
      if (reader && reader.parentElement) {
        reader.parentElement.removeChild(reader);
      }
    } catch (e) {
      console.warn('Failed to remove qr-reader element:', e);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const resetScanner = () => {
    setScanResult(null);
    setProcessing(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Scan Attendance QR</CardTitle>
        <p className="text-sm text-muted-foreground">
          Point your camera at the QR code displayed by your lecturer
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScanning && !scanResult && (
          <div className="aspect-square bg-muted rounded-2xl flex flex-col items-center justify-center gap-4">
            <Camera className="w-16 h-16 text-muted-foreground" />
            <Button onClick={handleStartClick} className="gap-2">
              <Camera className="w-4 h-4" />
              Start Camera
            </Button>
          </div>
        )}

        {isScanning && (
          <div className="space-y-4">
            <div 
              ref={containerRef}
              className="aspect-square rounded-2xl overflow-hidden bg-muted"
              id="qr-reader-container"
            />
            {cameras.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Camera:</label>
                <select
                  className="p-2 border rounded"
                  value={selectedCameraId || ''}
                  onChange={async (e) => {
                    const id = e.target.value;
                    if (!id) return;
                    await switchCamera(id);
                  }}
                  disabled={switching}
                >
                  {cameras.map(c => (
                    <option key={c.id} value={c.id}>{c.label || c.id}</option>
                  ))}
                </select>
              </div>
            )}
            <Button 
              variant="outline" 
              onClick={stopScanner} 
              className="w-full gap-2"
            >
              <CameraOff className="w-4 h-4" />
              Stop Camera
            </Button>
          </div>
        )}

        {processing && (
          <div className="aspect-square bg-muted rounded-2xl flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <p className="text-muted-foreground">Processing...</p>
          </div>
        )}

        {scanResult && (
          <div className="space-y-4">
            <div className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-4 ${
              scanResult.success ? 'bg-success/10' : 'bg-destructive/10'
            }`}>
              {scanResult.success ? (
                <CheckCircle2 className="w-20 h-20 text-success" />
              ) : (
                <XCircle className="w-20 h-20 text-destructive" />
              )}
              <Badge variant={scanResult.success ? 'success' : 'destructive'}>
                {scanResult.success ? 'Success' : 'Error'}
              </Badge>
              <p className="text-center px-4 font-medium">{scanResult.message}</p>
            </div>
            <Button onClick={resetScanner} className="w-full">
              Scan Another
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Camera Permission Required</AlertDialogTitle>
            <AlertDialogDescription>
              This app needs access to your camera to scan QR codes for attendance. Please allow camera access when prompted by your browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startScanner}>
              Allow Camera Access
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
