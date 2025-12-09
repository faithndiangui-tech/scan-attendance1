import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface QRGeneratorProps {
  sessionId: string;
  classId: string;
  type: 'START' | 'END';
  token: string;
  className?: string;
  unitCode?: string;
}

export function QRGenerator({ 
  sessionId, 
  classId, 
  type, 
  token,
  className = 'Class',
  unitCode = ''
}: QRGeneratorProps) {
  const [copied, setCopied] = useState(false);

  const qrData = JSON.stringify({
    sessionId,
    classId,
    type,
    token,
    timestamp: Date.now(),
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrData);
      setCopied(true);
      toast.success('QR data copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Badge variant={type === 'START' ? 'present' : 'completed'}>
            {type === 'START' ? 'Start Attendance' : 'End Attendance'}
          </Badge>
        </div>
        <CardTitle className="text-xl">{className}</CardTitle>
        {unitCode && (
          <p className="text-sm text-muted-foreground">{unitCode}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-inner">
          <QRCodeSVG
            value={qrData}
            size={240}
            level="H"
            includeMargin
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
        </div>
        
        <p className="text-sm text-muted-foreground text-center">
          {type === 'START' 
            ? 'Students should scan this QR to mark their arrival'
            : 'Students should scan this QR before leaving'
          }
        </p>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy QR Data'}
        </Button>
      </CardContent>
    </Card>
  );
}
