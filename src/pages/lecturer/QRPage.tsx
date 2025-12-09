import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QRGenerator } from '@/components/qr/QRGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Play, Square, QrCode, Clock, Users } from 'lucide-react';

interface ClassData {
  id: string;
  name: string;
  unit_code: string;
}

interface SessionData {
  id: string;
  class_id: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'in_progress' | 'ended';
  start_qr_token: string | null;
  end_qr_token: string | null;
  classes: ClassData;
}

function generateToken(): string {
  return crypto.randomUUID();
}

export default function QRPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state for new session
  const [showForm, setShowForm] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch lecturer's classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, unit_code')
        .eq('lecturer_id', user.id);

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Fetch active sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          class_id,
          start_time,
          end_time,
          status,
          start_qr_token,
          end_qr_token,
          classes (id, name, unit_code)
        `)
        .eq('lecturer_id', user.id)
        .in('status', ['scheduled', 'in_progress'])
        .order('start_time', { ascending: false });

      if (sessionsError) throw sessionsError;
      setSessions(sessionsData as SessionData[] || []);

      // Find active in-progress session
      const inProgress = sessionsData?.find(s => s.status === 'in_progress');
      if (inProgress) {
        setActiveSession(inProgress as SessionData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!selectedClass || !startTime || !endTime) {
      toast.error('Please fill all fields');
      return;
    }

    setCreating(true);
    try {
      const startToken = generateToken();
      
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          class_id: selectedClass,
          lecturer_id: user!.id,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          status: 'scheduled',
          start_qr_token: startToken,
        })
        .select(`
          id,
          class_id,
          start_time,
          end_time,
          status,
          start_qr_token,
          end_qr_token,
          classes (id, name, unit_code)
        `)
        .single();

      if (error) throw error;

      setSessions(prev => [data as SessionData, ...prev]);
      setShowForm(false);
      setSelectedClass('');
      setStartTime('');
      setEndTime('');
      toast.success('Session created successfully');
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const startSession = async (session: SessionData) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'in_progress' })
        .eq('id', session.id);

      if (error) throw error;

      const updatedSession = { ...session, status: 'in_progress' as const };
      setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s));
      setActiveSession(updatedSession);
      toast.success('Session started - Start QR is now active');
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error('Failed to start session');
    }
  };

  const generateEndQR = async () => {
    if (!activeSession) return;

    try {
      const endToken = generateToken();
      
      const { error } = await supabase
        .from('sessions')
        .update({ end_qr_token: endToken })
        .eq('id', activeSession.id);

      if (error) throw error;

      const updatedSession = { ...activeSession, end_qr_token: endToken };
      setSessions(prev => prev.map(s => s.id === activeSession.id ? updatedSession : s));
      setActiveSession(updatedSession);
      toast.success('End QR code generated');
    } catch (error) {
      console.error('Error generating end QR:', error);
      toast.error('Failed to generate end QR');
    }
  };

  const endSession = async () => {
    if (!activeSession) return;

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'ended' })
        .eq('id', activeSession.id);

      if (error) throw error;

      // Update students who didn't scan end QR to "left_early"
      await supabase
        .from('attendance')
        .update({ status: 'left_early' })
        .eq('session_id', activeSession.id)
        .eq('status', 'present')
        .is('end_scan_time', null);

      setSessions(prev => prev.filter(s => s.id !== activeSession.id));
      setActiveSession(null);
      toast.success('Session ended');
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">QR Attendance</h1>
            <p className="text-muted-foreground">
              Generate QR codes for class attendance
            </p>
          </div>
          {!showForm && classes.length > 0 && (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Session
            </Button>
          )}
        </div>

        {classes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <QrCode className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Classes Found</h2>
              <p className="text-muted-foreground text-center">
                You need to create a class first before generating QR codes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {showForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Session</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Class</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} ({cls.unit_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="datetime-local"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={createSession} disabled={creating}>
                      {creating ? 'Creating...' : 'Create Session'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSession && (
              <div className="grid md:grid-cols-2 gap-6">
                <QRGenerator
                  sessionId={activeSession.id}
                  classId={activeSession.class_id}
                  type="START"
                  token={activeSession.start_qr_token || ''}
                  className={activeSession.classes.name}
                  unitCode={activeSession.classes.unit_code}
                />

                {activeSession.end_qr_token ? (
                  <QRGenerator
                    sessionId={activeSession.id}
                    classId={activeSession.class_id}
                    type="END"
                    token={activeSession.end_qr_token}
                    className={activeSession.classes.name}
                    unitCode={activeSession.classes.unit_code}
                  />
                ) : (
                  <Card className="flex flex-col items-center justify-center">
                    <CardContent className="text-center py-12 space-y-4">
                      <Clock className="w-16 h-16 text-muted-foreground mx-auto" />
                      <h3 className="text-lg font-semibold">End QR Not Generated</h3>
                      <p className="text-sm text-muted-foreground">
                        Generate the end QR when class is about to finish
                      </p>
                      <Button onClick={generateEndQR} variant="accent" className="gap-2">
                        <QrCode className="w-4 h-4" />
                        Generate End QR
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card className="md:col-span-2">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="present">In Progress</Badge>
                      <span className="font-medium">{activeSession.classes.name}</span>
                    </div>
                    <Button variant="destructive" onClick={endSession} className="gap-2">
                      <Square className="w-4 h-4" />
                      End Session
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {!activeSession && sessions.filter(s => s.status === 'scheduled').length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Scheduled Sessions</h2>
                <div className="grid gap-4">
                  {sessions
                    .filter(s => s.status === 'scheduled')
                    .map((session) => (
                      <Card key={session.id}>
                        <CardContent className="flex items-center justify-between py-4">
                          <div>
                            <div className="font-medium">{session.classes.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(session.start_time).toLocaleString()} - {new Date(session.end_time).toLocaleTimeString()}
                            </div>
                          </div>
                          <Button onClick={() => startSession(session)} className="gap-2">
                            <Play className="w-4 h-4" />
                            Start Session
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {!activeSession && sessions.length === 0 && !showForm && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <QrCode className="w-16 h-16 text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No Active Sessions</h2>
                  <p className="text-muted-foreground text-center mb-4">
                    Create a new session to start generating QR codes
                  </p>
                  <Button onClick={() => setShowForm(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Session
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
