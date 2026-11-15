import { useState, useEffect } from 'react';
import { getDaySchedule, POLISH_MONTHS, getPolishDayName, formatDate } from '../lib/config';
import { createBooking, isDateBooked } from '../lib/supabase';

export default function BookingModal({ date, _bookings, onClose, onBookingComplete, onRefresh }) {
  const schedule = getDaySchedule(date);
  const fixedTime = schedule.fixedTime || '12:00';

  const [instagram, setInstagram] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTaken, setIsTaken] = useState(false);

  const dateStr = formatDate(date);
  const dayName = getPolishDayName(date);

  useEffect(() => {
    let active = true;
    isDateBooked(dateStr)
      .then((taken) => {
        if (!active || !taken) return;
        setIsTaken(true);
        setError('Ten termin został już zarezerwowany. Wybierz inny dzień.');
        onRefresh?.();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [dateStr, onRefresh]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!instagram.trim() || isTaken) return;

    setLoading(true);
    setError('');

    try {
      await createBooking({
        client_name: instagram.trim(),
        client_phone: null,
        booking_date: dateStr,
        booking_time: fixedTime,
      });
      onBookingComplete();
      onClose();
    } catch (err) {
      console.error('Booking error:', err);
      if (err?.code === 'BOOKING_CONFLICT') {
        setIsTaken(true);
        setError('Ten termin został właśnie zarezerwowany przez inną osobę. Wybierz inny dzień.');
        onRefresh?.();
      } else {
        setError('Nie udało się zapisać. Spróbuj ponownie.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ── nagłówek ── */}
        <div className="modal-header">
          <div>
            <h3 id="modal-title">
              {date.getDate()} {POLISH_MONTHS[date.getMonth()]}
            </h3>
            <p className="modal-subtitle">{dayName} — 1 osoba dziennie</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Zamknij">
            ×
          </button>
        </div>

        {/* ── treść ── */}
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="booking-form">
            {/* Informacja o stałej godzinie */}
            <div className="fixed-time-card">
              <span className="fixed-time-label">Godzina wizyty</span>
              <span className="fixed-time-value">{fixedTime}</span>
              <span className="fixed-time-note">Stała godzina przyjęć w ten dzień</span>
            </div>

            {/* Instagram */}
            <div className="form-group">
              <label htmlFor="booking-instagram">
                Instagram *
              </label>
              <div className="input-with-prefix">
                <span className="input-prefix">@</span>
                <input
                  id="booking-instagram"
                  type="text"
                  value={instagram.replace(/^@/, '')}
                  onChange={(e) => setInstagram(e.target.value.replace(/^@/, ''))}
                  placeholder="twoj_profil"
                  required
                  autoComplete="off"
                  autoFocus
                  disabled={isTaken}
                />
              </div>
              <span className="field-hint">Podaj swój profil na IG do potwierdzenia wizyty</span>
            </div>

            {error && <p className="form-error">{error}</p>}

            {isTaken ? (
              <button
                type="button"
                className="submit-btn"
                onClick={onClose}
              >
                Wybierz inny termin
              </button>
            ) : (
              <button
                type="submit"
                className="submit-btn"
                disabled={!instagram.trim() || loading}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  `Zarezerwuj wizytę na ${fixedTime}`
                )}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
