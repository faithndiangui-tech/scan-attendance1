import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  QrCode,
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  ScanLine,
  LogOut,
  ChevronRight,
  GraduationCap,
  Shield,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navigation = {
    admin: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Users', href: '/admin/users', icon: Users },
      { name: 'Classes', href: '/admin/classes', icon: BookOpen },
      { name: 'Attendance Logs', href: '/admin/attendance', icon: Calendar },
    ],
    lecturer: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'My Classes', href: '/lecturer/classes', icon: BookOpen },
      { name: 'Sessions', href: '/lecturer/sessions', icon: Calendar },
      { name: 'Generate QR', href: '/lecturer/qr', icon: QrCode },
    ],
    student: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'My Classes', href: '/student/classes', icon: BookOpen },
      { name: 'Scan QR', href: '/student/scan', icon: ScanLine },
      { name: 'Attendance History', href: '/student/history', icon: Calendar },
    ],
  };

  const currentNav = role ? navigation[role] : [];

  const roleLabels = {
    admin: { label: 'Administrator', icon: Shield, color: 'text-destructive' },
    lecturer: { label: 'Lecturer', icon: Users, color: 'text-accent' },
    student: { label: 'Student', icon: GraduationCap, color: 'text-info' },
  };

  const currentRole = role ? roleLabels[role] : null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border hidden lg:flex lg:flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-6 border-b border-border">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-accent">
            <QrCode className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="font-bold text-lg">QR Attendance</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {currentNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-3">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              {currentRole && (
                <div className={cn('flex items-center gap-1 text-xs', currentRole.color)}>
                  <currentRole.icon className="w-3 h-3" />
                  {currentRole.label}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-accent">
            <QrCode className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="font-bold text-lg">QR Attendance</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      {/* Mobile navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-card border-t border-border flex items-center justify-around px-2 lg:hidden">
        {currentNav.slice(0, 4).map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.name.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
