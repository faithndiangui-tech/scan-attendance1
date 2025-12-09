import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async () => {
    if (!containerRef.current) return;

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
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

      setIsScanning(true);
      setScanResult(null);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      toast.error('Failed to access camera. Please check permissions.');
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
            <Button onClick={startScanner} className="gap-2">
              <Camera className="w-4 h-4" />
              Start Camera
            </Button>
          </div>
        )}

        {isScanning && (
          <div className="space-y-4">
            <div 
              id="qr-reader" 
              ref={containerRef}
              className="aspect-square rounded-2xl overflow-hidden"
            />
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
    </Card>
  );
}
