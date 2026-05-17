
-- Enums
CREATE TYPE public.app_role AS ENUM ('employee', 'manager', 'admin');
CREATE TYPE public.goal_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE public.uom_type AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER', 'TIMELINE', 'ZERO_BASED');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
  LIMIT 1
$$;

-- Goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target NUMERIC NOT NULL,
  weightage NUMERIC NOT NULL,
  uom uom_type NOT NULL DEFAULT 'HIGHER_BETTER',
  deadline DATE,
  status goal_status NOT NULL DEFAULT 'PENDING',
  is_locked BOOLEAN NOT NULL DEFAULT false,
  cycle TEXT NOT NULL DEFAULT 'Q1',
  manager_comments TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_goals_employee ON public.goals(employee_id);
CREATE INDEX idx_goals_cycle ON public.goals(cycle);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Shared goals (split/fork)
CREATE TABLE public.shared_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  child_goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  is_split_forked BOOLEAN NOT NULL DEFAULT true,
  slocked BOOLEAN NOT NULL DEFAULT false,
  allocation_pct NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_goals ENABLE ROW LEVEL SECURITY;

-- Checkins
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  achievement_value NUMERIC NOT NULL,
  completion_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  manager_comments TEXT,
  score NUMERIC,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_goal ON public.checkins(goal_id);
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id UUID,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_timestamp ON public.audit_log(timestamp DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-create profile + default 'employee' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER goals_set_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lock enforcement
CREATE OR REPLACE FUNCTION public.enforce_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_locked = true AND NEW.status = OLD.status THEN
    -- allow status change (approve flow), block other field edits
    IF (OLD.title IS DISTINCT FROM NEW.title) OR (OLD.target IS DISTINCT FROM NEW.target)
       OR (OLD.weightage IS DISTINCT FROM NEW.weightage) OR (OLD.uom IS DISTINCT FROM NEW.uom) THEN
      RAISE EXCEPTION 'Goal is locked and cannot be edited';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER goals_enforce_lock BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lock();

-- RLS policies

-- Profiles
CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Goals
CREATE POLICY "employee view own goals" ON public.goals FOR SELECT TO authenticated
  USING (employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = goals.employee_id AND p.manager_id = auth.uid())
    OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "employee create own goals" ON public.goals FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "update goals" ON public.goals FOR UPDATE TO authenticated
  USING (employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "delete own goals" ON public.goals FOR DELETE TO authenticated
  USING ((employee_id = auth.uid() AND is_locked = false) OR public.has_role(auth.uid(), 'admin'));

-- Shared goals
CREATE POLICY "view shared goals" ON public.shared_goals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = shared_goals.original_goal_id AND
    (g.employee_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "manage shared goals" ON public.shared_goals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Checkins
CREATE POLICY "view checkins" ON public.checkins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = checkins.goal_id AND
    (g.employee_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "create checkins" ON public.checkins FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = checkins.goal_id AND
    (g.employee_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "update checkins" ON public.checkins FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Audit log
CREATE POLICY "admin view audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);
