-- Update handle_new_user() to support OAuth providers (like Google)
-- which supply 'full_name' or 'name' instead of 'display_name' in raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, adult_confirmed)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    ),
    -- For email signup, adult_confirmed is passed in raw_user_meta_data.
    -- For Google OAuth, default to true unless explicitly set to false.
    coalesce((new.raw_user_meta_data->>'adult_confirmed')::boolean, true)
  )
  on conflict (user_id) do update
  set
    display_name = coalesce(
      nullif(public.profiles.display_name, ''),
      nullif(excluded.display_name, ''),
      public.profiles.display_name
    ),
    adult_confirmed = coalesce(public.profiles.adult_confirmed, excluded.adult_confirmed, true);

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

