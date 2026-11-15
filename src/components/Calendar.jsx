import { useMemo } from 'react';
import { POLISH_MONTHS, POLISH_DAYS_SHORT, isDayAvailable, formatDate } from '../lib/config';

export default function Calendar({ onDateSelect, bookings }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Tylko kolejny miesiąc (miesiąc do przodu od bieżącego)
  const targetDate = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth() + 1, 1);
  }, [today]);

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();

  /* ── Budowanie siatki dni ── */
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getDayStatus = (dayNum) => {
    if (!dayNum) return 'empty';

    const date = new Date(year, month, dayNum);
    date.setHours(0, 0, 0, 0);

    if (date < today) return 'past';
    if (!isDayAvailable(date)) return 'unavailable';

    const dateStr = formatDate(date);
    const dayBooking = bookings.find((b) => b.booking_date === dateStr);

    if (dayBooking) {
      if (dayBooking.client_name?.startsWith('[ZABLOKOWANY]')) {
        return 'admin-blocked';
      }
      return 'fully-booked';
    }

    return 'available';
  };

  const getIndicatorClass = (status) => {
    if (status === 'available') return 'indicator-free';
    if (status === 'admin-blocked') return 'indicator-blocked';
    if (status === 'fully-booked') return 'indicator-full';
    return '';
  };

  const handleDayClick = (dayNum) => {
    const status = getDayStatus(dayNum);
    if (status === 'available') {
      onDateSelect(new Date(year, month, dayNum));
    }
  };

  return (
    <div className="calendar-card">
      {/* ── Nagłówek miesiąca ── */}
      <div className="calendar-header-simple">
        <h2 id="calendar-heading">
          {POLISH_MONTHS[month]} {year}
        </h2>
      </div>

      {/* ── Nagłówki dni tygodnia ── */}
      <div className="calendar-weekdays">
        {POLISH_DAYS_SHORT.map((d) => (
          <div key={d} className="weekday-label">
            {d}
          </div>
        ))}
      </div>

      {/* ── Siatka dni ── */}
      <div className="calendar-grid" role="grid" aria-labelledby="calendar-heading">
        {cells.map((dayNum, i) => {
          const status = getDayStatus(dayNum);
          const clickable = status === 'available';

          return (
            <div
              key={i}
              className={`day-cell ${status}`}
              onClick={() => dayNum && handleDayClick(dayNum)}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleDayClick(dayNum);
                }
              }}
              aria-label={
                dayNum
                  ? `${dayNum} ${POLISH_MONTHS[month]} — ${status === 'available' ? 'dostępne' : status === 'fully-booked' ? 'zajęte' : 'niedostępne'}`
                  : undefined
              }
            >
              {dayNum && (
                <>
                  <span className="day-number">{dayNum}</span>
                  {(status === 'available' || status === 'fully-booked' || status === 'admin-blocked') && (
                    <span
                      className={`day-indicator ${getIndicatorClass(status)}`}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legenda ── */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-dot indicator-free" />
          <span>Wolny termin (1 os./dzień)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot indicator-blocked" />
          <span>Termin wyłączony</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot indicator-full" />
          <span>Zajęte</span>
        </div>
      </div>

      {/* ── Godziny przyjęć ── */}
      <div className="schedule-info">
        <h3>Godziny przyjęć</h3>
        <div className="schedule-grid">
          <div className="schedule-row">
            <span className="schedule-day">Poniedziałek</span>
            <span className="schedule-time">16:40</span>
          </div>
          <div className="schedule-row">
            <span className="schedule-day">Wtorek</span>
            <span className="schedule-time">15:40</span>
          </div>
          <div className="schedule-row closed">
            <span className="schedule-day">Środa — Piątek</span>
            <span className="schedule-time">Nieczynne</span>
          </div>
          <div className="schedule-row">
            <span className="schedule-day">Sobota & Niedziela</span>
            <span className="schedule-time">12:00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
