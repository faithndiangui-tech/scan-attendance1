import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QRScanner } from '@/components/qr/QRScanner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AttendanceRecord {
  id: string;
  status: 'present' | 'completed' | 'left_early' | 'absent';
  start_scan_time: string | null;
  end_scan_time: string | null;
  sessions: {
    classes: {
      name: string;
      unit_code: string;
    };
    start_time: string;
  };
}

export default function ScanPage() {
  const { user } = useAuth();
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentAttendance();
  }, [user]);

  const fetchRecentAttendance = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          status,
          start_scan_time,
          end_scan_time,
          sessions (
            start_time,
            classes (name, unit_code)
          )
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentAttendance(data as AttendanceRecord[] || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      try {
        // Print detailed info if available
        console.error('Fetch error details:', JSON.stringify(error));
      } catch (_) {
        // ignore stringify errors
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (data: {
    sessionId: string;
    classId: string;
    type: 'START' | 'END';
    token: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'You must be logged in' };
    }

    try {
      // Verify the session exists and token matches
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, status, start_qr_token, end_qr_token, class_id, start_time, end_time')
        .eq('id', data.sessionId)
        .single();

      if (sessionError || !session) {
        return { success: false, message: 'Invalid session' };
      }

      if (session.status === 'ended') {
        return { success: false, message: 'This session has already ended' };
      }

      // Allow scanning if session is in_progress OR current time is within scheduled window
      const now = new Date();
      const sessionStart = new Date(session.start_time);
      const sessionEnd = new Date(session.end_time);
      const withinWindow = now >= sessionStart && now <= sessionEnd;

      if (session.status === 'scheduled' && !withinWindow) {
        return { success: false, message: 'This session has not started yet' };
      }

      // Verify token
      if (data.type === 'START' && session.start_qr_token !== data.token) {
        return { success: false, message: 'Invalid QR code' };
      }

      if (data.type === 'END' && session.end_qr_token !== data.token) {
        return { success: false, message: 'Invalid QR code' };
      }

      // Check if student is enrolled in this class
      const { data: enrollment, error: enrollError } = await supabase
        .from('class_students')
        .select('id')
        .eq('class_id', session.class_id)
        .eq('student_id', user.id)
        .single();

      if (enrollError || !enrollment) {
        return { success: false, message: 'You are not enrolled in this class' };
      }

      if (data.type === 'START') {
        // Check if already marked attendance
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('session_id', data.sessionId)
          .eq('student_id', user.id)
          .single();

        if (existing) {
          return { success: false, message: 'You have already marked attendance for this session' };
        }

        // Create attendance record
        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            session_id: data.sessionId,
            student_id: user.id,
            start_scan_time: new Date().toISOString(),
            status: 'present',
          });

        if (insertError) throw insertError;

        await fetchRecentAttendance();
        return { success: true, message: 'Attendance marked successfully!' };
      } else {
        // Update existing attendance with end time
        const { data: existing, error: existingError } = await supabase
          .from('attendance')
          .select('id, status')
          .eq('session_id', data.sessionId)
          .eq('student_id', user.id)
          .single();

        if (existingError || !existing) {
          return { success: false, message: 'You need to scan the start QR first' };
        }

        if (existing.status === 'completed') {
          return { success: false, message: 'You have already completed attendance' };
        }

        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            end_scan_time: new Date().toISOString(),
            status: 'completed',
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;

        await fetchRecentAttendance();
        return { success: true, message: 'Attendance completed!' };
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      return { success: false, message: 'An error occurred. Please try again.' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'present':
        return <Clock className="w-4 h-4 text-info" />;
      case 'left_early':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Scan Attendance</h1>
          <p className="text-muted-foreground mt-1">
            Scan the QR code displayed by your lecturer
          </p>
        </div>

        <QRScanner onScan={handleScan} />

        {recentAttendance.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Attendance</h2>
            <div className="space-y-2">
              {recentAttendance.map((record) => (
                <Card key={record.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(record.status)}
                      <div>
                        <div className="font-medium text-sm">
                          {record.sessions.classes.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(record.sessions.start_time).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        record.status === 'completed' ? 'completed' : 
                        record.status === 'present' ? 'present' : 
                        record.status === 'left_early' ? 'left-early' : 
                        'absent'
                      }
                    >
                      {record.status.replace('_', ' ')}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
