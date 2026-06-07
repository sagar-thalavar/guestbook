-- ==========================================================================
-- GUESTBOOK SECURITY CONTROLS, STORAGE POLICIES & DATA RETENTION
-- ==========================================================================

-- 1. Create function to log admin moderation actions
create or replace function public.log_admin_action()
returns trigger as $$
begin
  -- Only log if the status was changed to approved or rejected
  if (new.status in ('approved', 'rejected')) then
    insert into public.audit_logs (entry_id, actor_id, action, details)
    values (
      new.id,
      auth.uid(),
      case
        when new.status = 'approved' then 'approval'::text
        when new.status = 'rejected' then 'rejection'::text
      end,
      jsonb_build_object(
        'reason', new.rejection_reason,
        'custom_reason', new.custom_rejection_reason
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for admin moderation logging
drop trigger if exists on_entry_moderation on public.guestbook_entries;
create trigger on_entry_moderation
  after update on public.guestbook_entries
  for each row
  when (new.status is distinct from old.status)
  execute procedure public.log_admin_action();


-- 2. Storage Policies for 'selfies' Bucket
-- Ensure the storage extension is enabled
create schema if not exists storage;

-- Insert selfies bucket if it doesn't exist (runs safely)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfies', 'selfies', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Drop existing policies if they exist to avoid duplication errors
drop policy if exists "Allow users to upload selfies" on storage.objects;
drop policy if exists "Allow users to view own selfies" on storage.objects;
drop policy if exists "Allow admins to view all selfies" on storage.objects;
drop policy if exists "Allow users to delete own selfies" on storage.objects;
drop policy if exists "Allow admins to delete selfies" on storage.objects;

-- Create storage access control policies
create policy "Allow users to upload selfies"
  on storage.objects for insert
  with check (
    bucket_id = 'selfies' 
    and auth.role() = 'authenticated' 
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Allow users to view own selfies"
  on storage.objects for select
  using (
    bucket_id = 'selfies'
    and auth.role() = 'authenticated'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Allow admins to view all selfies"
  on storage.objects for select
  using (
    bucket_id = 'selfies'
    and public.is_admin()
  );

create policy "Allow users to delete own selfies"
  on storage.objects for delete
  using (
    bucket_id = 'selfies'
    and auth.role() = 'authenticated'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Allow admins to delete selfies"
  on storage.objects for delete
  using (
    bucket_id = 'selfies'
    and public.is_admin()
  );


-- 3. Data Retention: Auto-Purge Rejected Entries older than 7 days
create or replace function public.purge_stale_rejected_entries()
returns void as $$
begin
  -- Delete database records
  delete from public.guestbook_entries
  where status = 'rejected'
    and updated_at < (now() - interval '7 days');
end;
$$ language plpgsql security definer;

-- Enable pg_cron if available and schedule the daily cleanup job
create extension if not exists pg_cron;

select cron.schedule(
  'purge-stale-rejected-entries-daily',
  '0 0 * * *', -- every day at midnight
  $$select public.purge_stale_rejected_entries()$$
);


-- 4. RPC to allow users to delete their own account securely
create or replace function public.delete_own_user_account()
returns void as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;
