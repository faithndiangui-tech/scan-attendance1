import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QrCode, Users, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="gradient-hero min-h-screen flex flex-col">
        <header className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-accent" />
            </div>
            <span className="font-bold text-xl text-primary-foreground">QR Attendance</span>
          </div>
          <Link to="/auth">
            <Button variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
              Sign In
            </Button>
          </Link>
        </header>

        <main className="flex-1 container mx-auto px-4 flex items-center">
          <div className="max-w-3xl animate-slide-up">
            <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
              Smart Attendance Tracking for{' '}
              <span className="text-gradient">Modern Classrooms</span>
            </h1>
            <p className="text-xl text-primary-foreground/70 mb-8 max-w-2xl">
              Streamline your class attendance with QR codes. Students scan to check in and out,
              lecturers track in real-time, and admins get complete oversight.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/auth">
                <Button size="lg" className="gradient-accent text-accent-foreground gap-2">
                  Get Started <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </main>

        {/* Features */}
        <section className="container mx-auto px-4 pb-16">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: QrCode, title: 'QR Check-in', desc: 'Scan to start and end attendance' },
              { icon: Users, title: 'Role-Based', desc: 'Admin, Lecturer & Student views' },
              { icon: CheckCircle2, title: 'Real-time', desc: 'Instant attendance tracking' },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="glass-card p-6 animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg text-primary-foreground mb-2">{feature.title}</h3>
                <p className="text-primary-foreground/60">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
