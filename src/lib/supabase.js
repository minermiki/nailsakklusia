import { createClient } from '@supabase/supabase-js';

const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const rawAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function cleanEnv(val) {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

let supabaseUrl = cleanEnv(rawUrl);
const supabaseAnonKey = cleanEnv(rawAnonKey);

if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}`;
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('twoj-projekt')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.info('[Supabase Status] Tryb demo. Szczegóły konfiguracji:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'Ustawiony (' + supabaseUrl.slice(0, 15) + '...)' : 'BRAK / PUSTY',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Ustawiony' : 'BRAK / PUSTY',
  });
} else {
  console.info('[Supabase Status] Połączono z bazą Supabase!');
}

/* ────────────────────────────────────────────
   LocalStorage fallback (tryb demo)
   ──────────────────────────────────────────── */
const STORAGE_KEY = 'nail_bookings';

function getLocalBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

/* ────────────────────────────────────────────
   Helper: data graniczna sprzed N dni (YYYY-MM-DD)
   ──────────────────────────────────────────── */
export function getCutoffDateStr(daysAgo = 3) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ────────────────────────────────────────────
   API: automatyczne usuwanie rezerwacji starszych niż 3 dni od wizyty
   ──────────────────────────────────────────── */
export async function cleanupOldBookings() {
  const cutoffStr = getCutoffDateStr(3);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .lte('booking_date', cutoffStr);

      if (error) {
        console.error('[Supabase] Błąd usuwania rezerwacji starszych niż 3 dni:', error);
      }
    } catch (err) {
      console.error('[Supabase] Wyjątek podczas czyszczenia rezerwacji:', err);
    }
    return;
  }

  // localStorage fallback (tryb demo)
  try {
    const all = getLocalBookings();
    const filtered = all.filter((b) => b.booking_date > cutoffStr);
    if (filtered.length !== all.length) {
      saveLocalBookings(filtered);
    }
  } catch (err) {
    console.error('[Demo] Błąd czyszczenia starych rezerwacji w localStorage:', err);
  }
}

/* ────────────────────────────────────────────
   API: pobierz rezerwacje na dany miesiąc
   ──────────────────────────────────────────── */
export async function fetchBookingsForMonth(year, month) {
  cleanupOldBookings().catch(() => {});

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate);

    if (error) {
      console.error('[Supabase] Błąd pobierania rezerwacji dla miesiąca:', error);
      throw error;
    }
    return data || [];
  }

  // localStorage fallback
  const all = getLocalBookings();
  return all.filter((b) => b.booking_date >= startDate && b.booking_date <= endDate);
}

/* ────────────────────────────────────────────
   API: sprawdź, czy dzień jest już zajęty
   ──────────────────────────────────────────── */
export async function isDateBooked(bookingDate) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('booking_date', bookingDate)
      .limit(1);

    if (error) {
      console.error('[Supabase] Błąd sprawdzania dostępności terminu:', error);
      throw error;
    }
    return Boolean(data && data.length > 0);
  }

  const all = getLocalBookings();
  return all.some((b) => b.booking_date === bookingDate);
}

function createConflictError() {
  const err = new Error('Ten termin jest już zajęty.');
  err.code = 'BOOKING_CONFLICT';
  return err;
}

/* ────────────────────────────────────────────
   API: utwórz rezerwację
   ──────────────────────────────────────────── */
export async function createBooking({ client_name, client_phone, booking_date, booking_time }) {
  cleanupOldBookings().catch(() => {});

  // Sprawdź w bazie czy termin nie został już zajęty
  const alreadyBooked = await isDateBooked(booking_date);
  if (alreadyBooked) {
    throw createConflictError();
  }

  const record = { client_name, client_phone, booking_date, booking_time };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('bookings').insert(record).select();
    if (error) {
      if (error.code === '23505') {
        throw createConflictError();
      }
      console.error('[Supabase] Błąd zapisu rezerwacji:', error);
      throw error;
    }
    return data;
  }

  // localStorage fallback
  const all = getLocalBookings();
  if (all.some((b) => b.booking_date === booking_date)) {
    throw createConflictError();
  }
  const newBooking = {
    ...record,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  all.push(newBooking);
  saveLocalBookings(all);
  return [newBooking];
}

/* ────────────────────────────────────────────
   API: pobierz wszystkie wizyty (Panel Admina)
   ──────────────────────────────────────────── */
export async function fetchAllBookings() {
  await cleanupOldBookings();

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: true });

    if (error) {
      console.error('[Supabase] Błąd pobierania wszystkich rezerwacji:', error);
      throw error;
    }
    return data || [];
  }

  const all = getLocalBookings();
  return [...all].sort((a, b) => a.booking_date.localeCompare(b.booking_date));
}

/* ────────────────────────────────────────────
   API: usuń wizytę / odblokuj dzień (Panel Admina)
   ──────────────────────────────────────────── */
export async function deleteBooking(id, bookingDate) {
  if (isSupabaseConfigured) {
    let query = supabase.from('bookings').delete();
    if (id) {
      query = query.eq('id', id);
    } else if (bookingDate) {
      query = query.eq('booking_date', bookingDate);
    }
    const { error } = await query;
    if (error) {
      console.error('[Supabase] Błąd usuwania rezerwacji:', error);
      throw error;
    }
    return true;
  }

  const all = getLocalBookings();
  const filtered = all.filter((b) => (id ? b.id !== id : b.booking_date !== bookingDate));
  saveLocalBookings(filtered);
  return true;
}

/* ────────────────────────────────────────────
   API: weryfikacja hasła administratora w bazie
   ──────────────────────────────────────────── */
export async function verifyAdminPassword(password) {
  const normalized = (password || '').trim().toLowerCase();
  if (!normalized) return false;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('verify_admin_password', {
      input_password: normalized,
    });
    if (error) {
      console.error('[Supabase] Błąd weryfikacji hasła admina:', error);
      throw error;
    }
    return Boolean(data);
  }

  // Tryb demo bez Supabase
  return normalized === 'demo';
}

/* ────────────────────────────────────────────
   API: wyłącz dzień z puli (zablokuj dzień)
   ──────────────────────────────────────────── */
export async function blockDay(dateStr) {
  return createBooking({
    client_name: '[ZABLOKOWANY]',
    client_phone: null,
    booking_date: dateStr,
    booking_time: 'CAŁY DZIEŃ',
  });
}

