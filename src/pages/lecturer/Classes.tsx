import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface ClassRow {
  id: string;
  name: string;
  unit_code: string;
  description?: string | null;
}

export default function Classes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [description, setDescription] = useState('');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, [user]);

  const fetchClasses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, unit_code, description')
        .eq('lecturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClasses((data as ClassRow[]) || []);
    } catch (err) {
      console.error('Error fetching classes:', err);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const createClass = async () => {
    if (!name || !unitCode) {
      toast.error('Please provide class name and unit code');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert({ name, unit_code: unitCode, description, lecturer_id: user!.id })
        .select('id, name, unit_code, description')
        .single();
      if (error) throw error;
      setClasses(prev => [data as ClassRow, ...prev]);
      setName('');
      setUnitCode('');
      setDescription('');
      toast.success('Class created');
      navigate('/lecturer/sessions');
    } catch (err) {
      console.error('Error creating class:', err);
      toast.error('Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
            <p className="text-muted-foreground">Create and manage your classes</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit Code</Label>
              <Input value={unitCode} onChange={(e) => setUnitCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={createClass} disabled={creating}>
                {creating ? 'Creating...' : 'Create Class'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/lecturer/sessions')}>Cancel</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading classes...</div>
          ) : classes.length === 0 ? (
            <Card>
              <CardContent className="py-6">No classes yet.</CardContent>
            </Card>
          ) : (
            classes.map(c => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{c.unit_code}</div>
                    {c.description && <div className="text-sm text-muted-foreground">{c.description}</div>}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
