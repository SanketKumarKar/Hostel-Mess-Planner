-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create specific types
create type app_role as enum ('student', 'caterer', 'admin');
create type mess_type_enum as enum ('veg', 'non_veg', 'special');
create type meal_type_enum as enum ('breakfast', 'lunch', 'snacks', 'dinner');
create type session_status as enum ('draft', 'open_for_voting', 'closed', 'finalized');

-- PROFILES TABLE (Public profile info, linked to auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  role app_role default 'student',
  mess_type mess_type_enum, -- Only relevant for students
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);


-- VOTING SESSIONS
create table public.voting_sessions (
  id uuid default uuid_generate_v4() primary key,
  start_date date not null,
  end_date date not null,
  title text, -- e.g. "September Week 1"
  status session_status default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_dates check (end_date >= start_date)
);

-- MENU ITEMS (The candidates for the menu)
create table public.menu_items (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.voting_sessions(id) on delete cascade not null,
  date_served date not null,
  meal_type meal_type_enum not null,
  mess_type mess_type_enum not null, -- Which mess this item is for (Veg/NonVeg/Special)
  name text not null,
  description text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- VOTES
create table public.votes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  menu_item_id uuid references public.menu_items(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, menu_item_id) -- Simple prevention of double voting for same item, better logic needed in app
);

-- RLS (Basic setup - refine as needed)
alter table public.voting_sessions enable row level security;
create policy "Sessions viewable by everyone" on public.voting_sessions for select using (true);
-- Admin only insert/update todo later, for now allow authenticated for development speed if needed, but ideally check role

alter table public.menu_items enable row level security;
create policy "Menu items viewable by everyone" on public.menu_items for select using (true);

alter table public.votes enable row level security;
create policy "Users can vote" on public.votes for insert with check (auth.uid() = user_id);
create policy "Users can view own votes" on public.votes for select using (auth.uid() = user_id);

-- HELPER FUNCTIONS can be added here
