-- ============================================
-- EVENTS & RLS FIX SCRIPT
-- ============================================

-- 1. Create EVENTS Table
create table if not exists public.events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  date timestamp with time zone not null,
  location text,
  image_url text, -- For storing event poster/image
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for events
alter table public.events enable row level security;

-- Events Policies
create policy "Events are viewable by everyone" on public.events for select using (true);

create policy "Admins can manage events" on public.events for all using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

-- 2. FIX RLS for VOTING SESSIONS (Allow Admin to Create/Edit/Delete)
-- First drop existing if any to avoid conflicts (though we only had select)
drop policy if exists "Admins can manage sessions" on public.voting_sessions;

create policy "Admins can manage sessions" on public.voting_sessions for all using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

-- 3. FIX RLS for MENU ITEMS (Allow Caterer & Admin to Create/Edit/Delete)
drop policy if exists "Caterers and Admins can manage menu items" on public.menu_items;

create policy "Caterers and Admins can manage menu items" on public.menu_items for all using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() 
    and (profiles.role = 'caterer' or profiles.role = 'admin')
  )
);

-- 4. FIX RLS for VOTES (Allow Students to Delete/Unvote)
drop policy if exists "Users can update/delete own votes" on public.votes;

create policy "Users can update/delete own votes" on public.votes for all using (
  auth.uid() = user_id
);

-- 5. Helper Index (Optional but good)
create index if not exists idx_events_date on public.events(date);
