-- ============================================================
-- SQL Schema dla bazy danych Supabase (Booking Page)
-- Skopiuj i wklej ten kod w Supabase -> SQL Editor -> Run
-- ============================================================

-- 1. Tworzenie tabeli rezerwacji (jeśli jeszcze nie istnieje)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  client_name text not null,
  client_phone text,
  booking_date text not null,
  booking_time text not null
);

-- 2. Indeks dla szybkiego filtrowania po dacie oraz blokada podwójnych rezerwacji
create index if not exists bookings_booking_date_idx on public.bookings (booking_date);
create unique index if not exists bookings_booking_date_unique_idx on public.bookings (booking_date);

-- 3. Włączenie ochrony Row Level Security (RLS)
alter table public.bookings enable row level security;

-- Usuwamy stare polityki, jeśli istniały (zapobiega konfliktom)
drop policy if exists "Zezwól na publiczny odczyt rezerwacji" on public.bookings;
drop policy if exists "Zezwól na publiczne tworzenie rezerwacji" on public.bookings;
drop policy if exists "Zezwól na publiczne usuwanie rezerwacji" on public.bookings;

-- 4. Polityka SELECT: każdy (anonimowy odwiedzający) może odczytać terminy,
-- aby kalendarz wiedział, które dni są wolne, a które zajęte
create policy "Zezwól na publiczny odczyt rezerwacji"
  on public.bookings
  for select
  to anon, authenticated
  using (true);

-- 5. Polityka INSERT: klienci mogą dokonywać rezerwacji, a admin blokować dni
create policy "Zezwól na publiczne tworzenie rezerwacji"
  on public.bookings
  for insert
  to anon, authenticated
  with check (true);

-- 6. Polityka DELETE: panel administratora może odwoływać wizyty lub odblokowywać dni
create policy "Zezwól na publiczne usuwanie rezerwacji"
  on public.bookings
  for delete
  to anon, authenticated
  using (true);

-- ============================================================
-- 7. Automatyczne usuwanie rezerwacji 3 dni po terminie
-- ============================================================

-- Funkcja usuwająca rezerwacje, których data minęła o ponad 3 dni
create or replace function public.delete_old_bookings()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.bookings
  where booking_date ~ '^\d{4}-\d{2}-\d{2}$'
    and booking_date::date <= (current_date - interval '3 days');
end;
$$;

-- Trigger: czyści stare rezerwacje w bazie przy każdym nowym zapisie
create or replace function public.trg_cleanup_old_bookings_func()
returns trigger
language plpgsql
security definer
as $$
begin
  delete from public.bookings
  where booking_date ~ '^\d{4}-\d{2}-\d{2}$'
    and booking_date::date <= (current_date - interval '3 days');
  return new;
end;
$$;

drop trigger if exists trg_cleanup_old_bookings on public.bookings;
create trigger trg_cleanup_old_bookings
  after insert on public.bookings
  for each statement
  execute function public.trg_cleanup_old_bookings_func();

-- Harmonogram pg_cron (opcjonalny, uruchamiany codziennie o 03:00 UTC)
-- Wymaga aktywnego rozszerzenia pg_cron w Supabase: Database -> Extensions -> pg_cron
do $$
begin
  if exists (
    select 1 from pg_available_extensions where name = 'pg_cron'
  ) then
    create extension if not exists pg_cron;
    
    perform cron.unschedule('cleanup-old-bookings-job')
    where exists (select 1 from cron.job where jobname = 'cleanup-old-bookings-job');

    perform cron.schedule(
      'cleanup-old-bookings-job',
      '0 3 * * *',
      'select public.delete_old_bookings();'
    );
  end if;
exception when others then
  raise notice 'pg_cron nie jest dostępny - czyszczenie działa poprzez trigger i aplikację.';
end $$;

-- ============================================================
-- 8. Bezpieczne hasło administratora w bazie danych
-- ============================================================

-- Tabela ustawień (RLS włączony bez publicznych polityk: nikt nie odczyta jej przez API)
create table if not exists public.admin_settings (
  key text primary key,
  value text not null
);

alter table public.admin_settings enable row level security;

-- Funkcja weryfikująca hasło po stronie bazy danych (zwraca tylko true/false)
create or replace function public.verify_admin_password(input_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
  input_hash text;
begin
  select value into stored_hash
  from public.admin_settings
  where key = 'admin_password_hash';

  if stored_hash is null then
    return false;
  end if;

  input_hash := encode(sha256(convert_to(lower(trim(coalesce(input_password, ''))), 'UTF8')), 'hex');
  return stored_hash = input_hash;
end;
$$;

grant execute on function public.verify_admin_password(text) to anon, authenticated;

-- Ustawienie lub zmiana hasła administratora (uruchom w SQL Editor, podmieniając TWOJE_TAJNE_HASLO):
-- insert into public.admin_settings (key, value)
-- values (
--   'admin_password_hash',
--   encode(sha256(convert_to(lower(trim('TWOJE_TAJNE_HASLO')), 'UTF8')), 'hex')
-- )
-- on conflict (key) do update set value = excluded.value;
