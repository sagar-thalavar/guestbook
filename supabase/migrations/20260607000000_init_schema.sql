-- ==========================================================================
-- GUESTBOOK INITIAL DATABASE SCHEMA & SECURITY POLICIES
-- ==========================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- --- Tables ---

-- 1. Profiles Table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'visitor' check (role in ('visitor', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- 2. Guestbook Entries Table
create table public.guestbook_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  original_name text not null,
  selfie_url text, -- nullable, uploaded to storage
  mood text,
  message varchar(200) not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  
  -- Rejection Details
  rejection_reason text check (
    rejection_reason in (
      'unclear_photo', 
      'inappropriate_content', 
      'image_not_visitor', 
      'duplicate_submission', 
      'spam_submission', 
      'other'
    )
  ),
  custom_rejection_reason text,
  reupload_attempts integer not null default 0 check (reupload_attempts <= 3),
  
  -- Consent Trackers
  consent_given boolean not null check (consent_given = true),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Guestbook Entries
alter table public.guestbook_entries enable row level security;

-- 3. Audit Logs Table (Admin actions tracker)
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid, -- nullable to keep log if entry is deleted
  actor_id uuid references auth.users on delete set null,
  action text not null check (action in ('approval', 'rejection', 'deletion')),
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Audit Logs
alter table public.audit_logs enable row level security;


-- --- Helper Functions & Triggers ---

-- Automatically Update updated_at Timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger on_profile_update
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger on_entry_update
  before update on public.guestbook_entries
  for each row execute procedure public.handle_updated_at();

-- Check if current authenticated user is an administrator
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Auto-create Profile record upon signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', ''), 
    'visitor' -- default role is always visitor
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- --- Row Level Security (RLS) Policies ---

-- Profiles Policies
create policy "Allow users to view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Allow admins to view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Allow admins to modify profiles"
  on public.profiles for update
  using (public.is_admin());


-- Guestbook Entries Policies
create policy "Allow visitors to view their own entries"
  on public.guestbook_entries for select
  using (auth.uid() = user_id);

create policy "Allow admins to view all entries"
  on public.guestbook_entries for select
  using (public.is_admin());

create policy "Allow visitors to submit entries"
  on public.guestbook_entries for insert
  with check (auth.uid() = user_id);

create policy "Allow visitors to edit their pending or rejected entries"
  on public.guestbook_entries for update
  using (auth.uid() = user_id and status in ('pending', 'rejected'))
  with check (auth.uid() = user_id and status in ('pending', 'rejected'));

create policy "Allow admins to moderate all entries"
  on public.guestbook_entries for update
  using (public.is_admin());

create policy "Allow admins to delete entries"
  on public.guestbook_entries for delete
  using (public.is_admin());

create policy "Allow visitors to delete their own entries during account deletion"
  on public.guestbook_entries for delete
  using (auth.uid() = user_id);


-- Audit Logs Policies
create policy "Allow admins to view audit logs"
  on public.audit_logs for select
  using (public.is_admin());

create policy "Allow system/admins to insert audit logs"
  on public.audit_logs for insert
  with check (public.is_admin());
