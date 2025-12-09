-- Create enums for roles and statuses
CREATE TYPE public.app_role AS ENUM ('admin', 'lecturer', 'student');
CREATE TYPE public.attendance_status AS ENUM ('present', 'completed', 'left_early', 'absent');
CREATE TYPE public.session_status AS ENUM ('scheduled', 'in_progress', 'ended');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  lecturer_id UUID REFERENCES auth.users NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create class_students junction table
CREATE TABLE public.class_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Create sessions table
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  lecturer_id UUID REFERENCES auth.users NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.session_status NOT NULL DEFAULT 'scheduled',
  start_qr_token TEXT,
  end_qr_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users NOT NULL,
  start_scan_time TIMESTAMP WITH TIME ZONE,
  end_scan_time TIMESTAMP WITH TIME ZONE,
  status public.attendance_status NOT NULL DEFAULT 'absent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION public.has_role(required_role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.app_role AS $$
DECLARE
  user_role public.app_role;
BEGIN
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role('admin'));
CREATE POLICY "Lecturers can view student profiles" ON public.profiles FOR SELECT USING (public.has_role('lecturer'));

-- User roles policies
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role('admin'));

-- Classes policies
CREATE POLICY "Admins can manage all classes" ON public.classes FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Lecturers can manage their classes" ON public.classes FOR ALL USING (auth.uid() = lecturer_id);
CREATE POLICY "Students can view enrolled classes" ON public.classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.class_students WHERE class_id = id AND student_id = auth.uid())
);

-- Class students policies
CREATE POLICY "Admins can manage class enrollments" ON public.class_students FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Lecturers can view their class students" ON public.class_students FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND lecturer_id = auth.uid())
);
CREATE POLICY "Lecturers can manage their class students" ON public.class_students FOR ALL USING (
  EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND lecturer_id = auth.uid())
);
CREATE POLICY "Students can view their enrollments" ON public.class_students FOR SELECT USING (auth.uid() = student_id);

-- Sessions policies
CREATE POLICY "Admins can manage all sessions" ON public.sessions FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Lecturers can manage their sessions" ON public.sessions FOR ALL USING (auth.uid() = lecturer_id);
CREATE POLICY "Students can view sessions for enrolled classes" ON public.sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.class_students WHERE class_id = sessions.class_id AND student_id = auth.uid())
);

-- Attendance policies
CREATE POLICY "Admins can manage all attendance" ON public.attendance FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Lecturers can view attendance for their sessions" ON public.attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND lecturer_id = auth.uid())
);
CREATE POLICY "Lecturers can update attendance for their sessions" ON public.attendance FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND lecturer_id = auth.uid())
);
CREATE POLICY "Students can view their own attendance" ON public.attendance FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can insert their own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update their own attendance" ON public.attendance FOR UPDATE USING (auth.uid() = student_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();