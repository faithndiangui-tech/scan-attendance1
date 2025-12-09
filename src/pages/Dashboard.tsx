import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  QrCode,
  ScanLine
} from 'lucide-react';

interface Stats {
  totalClasses: number;
  totalSessions: number;
  totalStudents: number;
  completedAttendance: number;
  leftEarlyCount: number;
  presentCount: number;
}

export default function Dashboard() {
  const { role, user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalClasses: 0,
    totalSessions: 0,
    totalStudents: 0,
    completedAttendance: 0,
    leftEarlyCount: 0,
    presentCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;

      try {
        if (role === 'admin') {
          const [classesRes, sessionsRes, studentsRes, attendanceRes] = await Promise.all([
            supabase.from('classes').select('id', { count: 'exact' }),
            supabase.from('sessions').select('id', { count: 'exact' }),
            supabase.from('user_roles').select('id', { count: 'exact' }).eq('role', 'student'),
            supabase.from('attendance').select('status'),
          ]);

          const completed = attendanceRes.data?.filter(a => a.status === 'completed').length || 0;
          const leftEarly = attendanceRes.data?.filter(a => a.status === 'left_early').length || 0;
          const present = attendanceRes.data?.filter(a => a.status === 'present').length || 0;

          setStats({
            totalClasses: classesRes.count || 0,
            totalSessions: sessionsRes.count || 0,
            totalStudents: studentsRes.count || 0,
            completedAttendance: completed,
            leftEarlyCount: leftEarly,
            presentCount: present,
          });
        } else if (role === 'lecturer') {
          const [classesRes, sessionsRes] = await Promise.all([
            supabase.from('classes').select('id', { count: 'exact' }).eq('lecturer_id', user.id),
            supabase.from('sessions').select('id', { count: 'exact' }).eq('lecturer_id', user.id),
          ]);

          setStats({
            ...stats,
            totalClasses: classesRes.count || 0,
            totalSessions: sessionsRes.count || 0,
          });
        } else if (role === 'student') {
          const [enrollmentsRes, attendanceRes] = await Promise.all([
            supabase.from('class_students').select('id', { count: 'exact' }).eq('student_id', user.id),
            supabase.from('attendance').select('status').eq('student_id', user.id),
          ]);

          const completed = attendanceRes.data?.filter(a => a.status === 'completed').length || 0;
          const leftEarly = attendanceRes.data?.filter(a => a.status === 'left_early').length || 0;
          const present = attendanceRes.data?.filter(a => a.status === 'present').length || 0;

          setStats({
            ...stats,
            totalClasses: enrollmentsRes.count || 0,
            completedAttendance: completed,
            leftEarlyCount: leftEarly,
            presentCount: present,
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user, role]);

  const adminCards = [
    { title: 'Total Classes', value: stats.totalClasses, icon: BookOpen, color: 'bg-primary/10 text-primary' },
    { title: 'Total Sessions', value: stats.totalSessions, icon: Calendar, color: 'bg-accent/10 text-accent' },
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'bg-info/10 text-info' },
    { title: 'Completed', value: stats.completedAttendance, icon: CheckCircle2, color: 'bg-success/10 text-success' },
  ];

  const lecturerCards = [
    { title: 'My Classes', value: stats.totalClasses, icon: BookOpen, color: 'bg-primary/10 text-primary' },
    { title: 'Total Sessions', value: stats.totalSessions, icon: Calendar, color: 'bg-accent/10 text-accent' },
    { title: 'Generate QR', value: null, icon: QrCode, color: 'bg-info/10 text-info', link: '/lecturer/qr' },
    { title: 'View Sessions', value: null, icon: Clock, color: 'bg-warning/10 text-warning', link: '/lecturer/sessions' },
  ];

  const studentCards = [
    { title: 'Enrolled Classes', value: stats.totalClasses, icon: BookOpen, color: 'bg-primary/10 text-primary' },
    { title: 'Completed', value: stats.completedAttendance, icon: CheckCircle2, color: 'bg-success/10 text-success' },
    { title: 'In Progress', value: stats.presentCount, icon: Clock, color: 'bg-info/10 text-info' },
    { title: 'Left Early', value: stats.leftEarlyCount, icon: AlertTriangle, color: 'bg-warning/10 text-warning' },
  ];

  const cards = role === 'admin' ? adminCards : role === 'lecturer' ? lecturerCards : studentCards;

  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {role === 'admin' && 'Manage users, classes, and view attendance logs'}
            {role === 'lecturer' && 'Manage your classes and track attendance'}
            {role === 'student' && 'View your classes and attendance history'}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-8 w-8 bg-muted rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, index) => (
              <Card 
                key={card.title} 
                className="animate-slide-up hover:shadow-lg transition-shadow cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => card.link && navigate(card.link)}
                role={card.link ? 'button' : undefined}
                tabIndex={card.link ? 0 : undefined}
                onKeyDown={(e) => {
                  if (card.link && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    navigate(card.link as string);
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  {card.value !== null ? (
                    <div className="text-3xl font-bold">{card.value}</div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Click to open</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {role === 'student' && (
          <Card className="gradient-card border-accent/20 animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 rounded-2xl gradient-accent flex items-center justify-center mb-6 animate-pulse-glow">
                <ScanLine className="w-10 h-10 text-accent-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Ready to Scan?</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Scan the QR code displayed by your lecturer to mark your attendance for the class.
              </p>
              <a href="/student/scan">
                <button className="gradient-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
                  Open Scanner
                </button>
              </a>
            </CardContent>
          </Card>
        )}

        {role === 'lecturer' && (
          <Card className="gradient-card border-accent/20 animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 rounded-2xl gradient-accent flex items-center justify-center mb-6">
                <QrCode className="w-10 h-10 text-accent-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Start a Session</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Generate a QR code for your class session to allow students to mark their attendance.
              </p>
              <a href="/lecturer/qr">
                <button className="gradient-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
                  Generate QR Code
                </button>
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
