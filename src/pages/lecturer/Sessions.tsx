import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Play, Square } from 'lucide-react';

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
  classes?: ClassData;
}

interface AttendanceRow {
  id: string;
  student_id: string;
  status: string;
  start_scan_time: string | null;
  end_scan_time: string | null;
}

function generateToken(): string {
  return crypto.randomUUID();
}

export default function Sessions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [creating, setCreating] = useState(false);
  const [attendees, setAttendees] = useState<Record<string, AttendanceRow[]>>({});

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, unit_code')
        .eq('lecturer_id', user.id);
      if (classesError) throw classesError;
      setClasses(classesData || []);

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
        .order('start_time', { ascending: false });
      if (sessionsError) throw sessionsError;
      setSessions(sessionsData as SessionData[] || []);
    } catch (error) {
      console.error('Error fetching sessions page data:', error);
      toast.error('Failed to load sessions');
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
      toast.success('Session created');
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const loadAttendees = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, student_id, status, start_scan_time, end_scan_time')
        .eq('session_id', sessionId);
      if (error) throw error;
      setAttendees(prev => ({ ...prev, [sessionId]: data || [] }));
    } catch (error) {
      console.error('Error loading attendees:', error);
      toast.error('Failed to load attendees');
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

  if (classes.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
              <p className="text-muted-foreground">Manage your class sessions and view attendees</p>
            </div>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-2xl gradient-accent flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-accent-foreground" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">No Classes Found</h2>
              <p className="text-muted-foreground text-center">
                You need to create a class first before creating sessions.
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate('/lecturer/classes')}>Create Class</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
            <p className="text-muted-foreground">Manage your class sessions and view attendees</p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Session
            </Button>
          )}
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Class</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">Choose a class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.unit_code})
                    </option>
                  ))}
                </select>
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

        <div className="grid gap-4">
          {sessions.map(session => (
            <Card key={session.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{session.classes?.name || session.class_id}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(session.start_time).toLocaleString()} -{' '}
                      {new Date(session.end_time).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.status === 'scheduled' && (
                      <Button
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('sessions')
                              .update({ status: 'in_progress' })
                              .eq('id', session.id);
                            if (error) throw error;
                            setSessions(prev =>
                              prev.map(s =>
                                s.id === session.id ? { ...s, status: 'in_progress' } : s
                              )
                            );
                            toast.success('Session started');
                          } catch (err) {
                            console.error(err);
                            toast.error('Failed to start session');
                          }
                        }}
                      >
                        <Play className="w-4 h-4" /> Start
                      </Button>
                    )}
                    {session.status === 'in_progress' && (
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('sessions')
                              .update({ status: 'ended' })
                              .eq('id', session.id);
                            if (error) throw error;
                            setSessions(prev =>
                              prev.map(s =>
                                s.id === session.id ? { ...s, status: 'ended' } : s
                              )
                            );
                            toast.success('Session ended');
                          } catch (err) {
                            console.error(err);
                            toast.error('Failed to end session');
                          }
                        }}
                      >
                        <Square className="w-4 h-4" /> End
                      </Button>
                    )}
                    <Button onClick={() => loadAttendees(session.id)}>View Attendees</Button>
                  </div>
                </div>

                {attendees[session.id] && (
                  <div className="mt-2">
                    <h4 className="font-medium">Attendees</h4>
                    <div className="text-sm text-muted-foreground">
                      {attendees[session.id].length === 0 ? (
                        <div>No attendees yet</div>
                      ) : (
                        <ul className="list-disc pl-6">
                          {attendees[session.id].map(a => (
                            <li key={a.id}>
                              {a.student_id} — {a.status}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
