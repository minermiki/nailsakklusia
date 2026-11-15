/* ============================================================
   Konfiguracja grafiku i slotów czasowych
   ============================================================ */

/**
 * Grafik pracy — klucz to Date.getDay() (0 = Niedziela … 6 = Sobota).
 * Zmień sloty lub dodaj nowe dni wg potrzeb.
 */
export const SCHEDULE = {
  0: {
    // Niedziela
    available: true,
    fixedTime: '12:00',
    description: '12:00',
    slots: ['12:00'],
  },
  1: {
    // Poniedziałek
    available: true,
    fixedTime: '16:40',
    description: '16:40',
    slots: ['16:40'],
  },
  2: {
    // Wtorek
    available: true,
    fixedTime: '15:40',
    description: '15:40',
    slots: ['15:40'],
  },
  3: {
    // Środa
    available: false,
    fixedTime: null,
    description: 'Nieczynne',
    slots: [],
  },
  4: {
    // Czwartek
    available: false,
    fixedTime: null,
    description: 'Nieczynne',
    slots: [],
  },
  5: {
    // Piątek
    available: false,
    fixedTime: null,
    description: 'Nieczynne',
    slots: [],
  },
  6: {
    // Sobota
    available: true,
    fixedTime: '12:00',
    description: '12:00',
    slots: ['12:00'],
  },
};

/* ────────── Polskie nazwy ────────── */

export const POLISH_MONTHS = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

export const POLISH_DAYS_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

export const POLISH_DAYS_FULL = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

/* ────────── Helpery ────────── */

/** Zwraca pełną konfigurację grafiku dla danej daty */
export function getDaySchedule(date) {
  const dow = date.getDay();
  return SCHEDULE[dow] || { available: false, fixedTime: null, description: 'Nieczynne' };
}

/** Zwraca dostępne sloty dla danej daty (kompatybilność wsteczna) */
export function getSlotsForDate(date) {
  const dow = date.getDay();
  const entry = SCHEDULE[dow];
  if (!entry || !entry.available) return [];
  return entry.slots || [];
}

/** Czy dany dzień jest w grafiku i nie jest w przeszłości? */
export function isDayAvailable(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d < today) return false;
  const dow = d.getDay();
  return SCHEDULE[dow]?.available || false;
}

/** Formatuje datę do YYYY-MM-DD */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Zwraca polską nazwę dnia tygodnia */
export function getPolishDayName(date) {
  // getDay: 0=Sun → index 6; 1=Mon → index 0; …
  const idx = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return POLISH_DAYS_FULL[idx];
}
