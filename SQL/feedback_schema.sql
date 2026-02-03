-- Create Feedbacks Table
create table public.feedbacks (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.profiles(id) not null,
  caterer_id uuid references public.profiles(id) not null,
  message text not null,
  response text, -- If null, pending. If not null, acknowledged/responded.
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Feedbacks
alter table public.feedbacks enable row level security;

-- Policy: Students can insert their own feedback
create policy "Students can insert own feedback" on public.feedbacks
  for insert with check (auth.uid() = student_id);

-- Policy: Students can view their own feedback
create policy "Students can view own feedback" on public.feedbacks
  for select using (auth.uid() = student_id);

-- Policy: Caterers can view feedback assigned to them
create policy "Caterers can view feedback for them" on public.feedbacks
  for select using (auth.uid() = caterer_id);

-- Policy: Caterers can update response for feedback assigned to them
create policy "Caterers can respond to feedback" on public.feedbacks
  for update using (auth.uid() = caterer_id);

-- Policy: Admins can view all feedbacks
create policy "Admins can view all feedbacks" on public.feedbacks
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create System Settings Table (for Registration Toggles)
create table public.system_settings (
  setting_key text primary key,
  setting_value text not null -- Store as string 'true'/'false' for simplicity
);

-- RLS for System Settings
alter table public.system_settings enable row level security;

-- Policy: Everyone can view settings (needed for registration checks)
create policy "Everyone can view system settings" on public.system_settings
  for select using (true);

-- Policy: Only Admins can update settings
create policy "Admins can update system settings" on public.system_settings
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Insert Default Settings
insert into public.system_settings (setting_key, setting_value)
values 
  ('caterer_registration', 'true'),
  ('admin_registration', 'true')
on conflict (setting_key) do nothing;
