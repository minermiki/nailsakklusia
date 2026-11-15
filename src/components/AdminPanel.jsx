import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAllBookings, deleteBooking, blockDay, verifyAdminPassword } from '../lib/supabase';
import { POLISH_MONTHS, POLISH_DAYS_SHORT, getPolishDayName } from '../lib/config';

export default function AdminPanel({ onNavigateHome }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('nail_admin_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Wyszukiwarka / filtr
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'all' | 'blocked'

  /* ── Pobieranie wszystkich danych ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllBookings();
      setBookings(data);
    } catch (err) {
      console.error('Błąd pobierania danych admina:', err);
      showMessage('Błąd ładowania danych', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const showMessage = (text, type = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3500);
  };

  /* ── Logowanie ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!passwordInput.trim() || authLoading) return;

    setAuthLoading(true);
    setAuthError('');
    try {
      const ok = await verifyAdminPassword(passwordInput);
      if (ok) {
        sessionStorage.setItem('nail_admin_auth', 'true');
        setIsAuthenticated(true);
      } else {
        setAuthError('Nieprawidłowe hasło');
      }
    } catch (err) {
      console.error('Błąd logowania:', err);
      setAuthError('Błąd weryfikacji hasła w bazie danych');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('nail_admin_auth');
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  /* ── Usuwanie wizyty / odblokowanie ── */
  const handleDelete = async (booking) => {
    const isBlock = booking.client_name?.startsWith('[ZABLOKOWANY]');
    const confirmMsg = isBlock
      ? `Czy na pewno chcesz przywrócić dzień ${booking.booking_date} do puli rezerwacji?`
      : `Czy na pewno chcesz odwołać wizytę dla @${cleanIg(booking.client_name)} z dnia ${booking.booking_date} o ${booking.booking_time}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteBooking(booking.id, booking.booking_date);
      showMessage(isBlock ? 'Dzień został odblokowany' : 'Wizyta została odwołana');
      loadData();
    } catch (err) {
      console.error(err);
      showMessage('Nie udało się wykonać operacji', 'error');
    }
  };

  // Stan minikalendarza wyłączania dni (domyślnie kolejny miesiąc)
  const [adminCalDate, setAdminCalDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 1);
  });

  const prevAdminMonth = () => {
    setAdminCalDate(new Date(adminCalDate.getFullYear(), adminCalDate.getMonth() - 1, 1));
  };
  const nextAdminMonth = () => {
    setAdminCalDate(new Date(adminCalDate.getFullYear(), adminCalDate.getMonth() + 1, 1));
  };

  /* ── Kliknięcie dnia w minikalendarzu administratora ── */
  const handleDayClickInAdminCalendar = async (dateStr) => {
    const booking = bookings.find((b) => b.booking_date === dateStr);

    // 1. Jeśli dzień jest już wyłączony na żółto przez admina -> Odblokuj
    if (booking && booking.client_name?.startsWith('[ZABLOKOWANY]')) {
      const confirmUnblock = window.confirm(
        `Dzień ${dateStr} jest wyłączony z puli.\n\nCzy chcesz go przywrócić do puli rezerwacji?`
      );
      if (!confirmUnblock) return;
      try {
        await deleteBooking(booking.id, booking.booking_date);
        showMessage(`Dzień ${dateStr} został przywrócony do puli`);
        loadData();
      } catch (err) {
        console.error(err);
        showMessage('Błąd odblokowywania dnia', 'error');
      }
      return;
    }

    // 2. Jeśli na ten dzień jest już rezerwacja klientki
    if (booking) {
      const igUser = cleanIg(booking.client_name);
      const action = window.confirm(
        `W dniu ${dateStr} (${booking.booking_time}) zapisana jest klientka @${igUser}.\n\nCzy chcesz odwołać tę wizytę i wyłączyć dzień z puli?`
      );
      if (!action) return;
      try {
        await deleteBooking(booking.id, booking.booking_date);
        await blockDay(dateStr);
        showMessage(`Wizyta @${igUser} odwołana, a dzień ${dateStr} wyłączony`);
        loadData();
      } catch (err) {
        console.error(err);
        showMessage('Błąd podczas operacji', 'error');
      }
      return;
    }

    // 3. Wolny dzień -> Wyłącz z puli na żółto
    const confirmBlock = window.confirm(
      `Czy chcesz wyłączyć dzień ${dateStr} z puli rezerwacji?`
    );
    if (!confirmBlock) return;

    try {
      await blockDay(dateStr);
      showMessage(`Dzień ${dateStr} został wyłączony z puli`);
      loadData();
    } catch (err) {
      console.error(err);
      showMessage('Błąd wyłączania dnia', 'error');
    }
  };

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const cleanIg = (name) => {
    if (!name) return '';
    return name.replace(/^@/, '').replace(/^\[ZABLOKOWANY\]\s*/, '');
  };

  /* ── Podział wizyt ── */
  const { upcomingBookings, allClientBookings, blockedDays } = useMemo(() => {
    const clients = bookings.filter((b) => !b.client_name?.startsWith('[ZABLOKOWANY]'));
    const blocked = bookings.filter((b) => b.client_name?.startsWith('[ZABLOKOWANY]'));

    const upcoming = clients
      .filter((b) => b.booking_date >= todayStr)
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time));

    const sortedAll = [...clients].sort((a, b) => b.booking_date.localeCompare(a.booking_date));

    return {
      upcomingBookings: upcoming,
      allClientBookings: sortedAll,
      blockedDays: blocked,
    };
  }, [bookings, todayStr]);

  const filteredAll = useMemo(() => {
    if (!searchQuery.trim()) return allClientBookings;
    const q = searchQuery.toLowerCase();
    return allClientBookings.filter(
      (b) =>
        b.client_name?.toLowerCase().includes(q) ||
        b.booking_date?.includes(q) ||
        b.booking_time?.includes(q)
    );
  }, [allClientBookings, searchQuery]);

  /* ── Formatowanie daty ── */
  const formatFriendlyDate = (dateString) => {
    if (!dateString) return '';
    const [y, m, d] = dateString.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = getPolishDayName(dateObj);
    return `${dayName}, ${d} ${POLISH_MONTHS[m - 1]} ${y}`;
  };

  /* ────────────────────────────────────────────────────────────
     EKRAN LOGOWANIA
     ──────────────────────────────────────────────────────────── */
  if (!isAuthenticated) {
    return (
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h2>Panel Administratora</h2>
          <p>Podaj hasło, aby zarządzać wizytami i kalendarzem</p>
        </div>

        <form onSubmit={handleLogin} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="admin-pwd">Hasło dostępu</label>
            <input
              id="admin-pwd"
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                if (authError) setAuthError('');
              }}
              placeholder="Wpisz hasło..."
              autoFocus
              required
            />
          </div>

          {authError && <p className="form-error">{authError}</p>}

          <button type="submit" className="submit-btn" disabled={authLoading}>
            {authLoading ? 'Sprawdzam...' : 'Zaloguj się'}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={onNavigateHome}
          >
            ← Wróć do kalendarza
          </button>
        </form>
      </div>
    );
  }

  /* ── Dane minikalendarza dla administratora ── */
  const calYear = adminCalDate.getFullYear();
  const calMonth = adminCalDate.getMonth();
  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const adminCells = [];
  for (let i = 0; i < startOffset; i++) adminCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) adminCells.push(d);

  /* ────────────────────────────────────────────────────────────
     GŁÓWNY PANEL ADMINA
     ──────────────────────────────────────────────────────────── */
  return (
    <div className="admin-container">
      {/* ── Górny pasek nawigacji admina ── */}
      <header className="admin-header">
        <div className="admin-title-area">
          <button className="nav-back-link" onClick={onNavigateHome}>
            ← Strona główna
          </button>
          <h2>Panel Administratora</h2>
        </div>
        <div className="admin-actions">
          <button className="refresh-btn" onClick={loadData} title="Odśwież dane" disabled={loading}>
            {loading ? 'Odświeżam...' : 'Odśwież'}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Wyloguj
          </button>
        </div>
      </header>

      {/* Komunikat akcji */}
      {actionMessage && (
        <div className={`admin-alert ${actionMessage.type}`}>
          {actionMessage.text}
        </div>
      )}

      {/* ── Kafelki statystyk ── */}
      <div className="admin-stats-grid">
        <div className="stat-card">
          <span className="stat-number">{upcomingBookings.length}</span>
          <span className="stat-label">Nadchodzące wizyty</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{allClientBookings.length}</span>
          <span className="stat-label">Wszystkie wizyty</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{blockedDays.length}</span>
          <span className="stat-label">Dni wyłączone z puli</span>
        </div>
      </div>

      {/* ── Minikalendarz: Klikaj dni, aby wyłączyć na żółto lub odblokować ── */}
      <div className="admin-card mini-calendar-card">
        <div className="mini-calendar-header">
          <div>
            <h3>Kalendarz dostępności dni</h3>
            <p className="card-desc">
              Kliknij dowolny dzień, aby wyłączyć go z puli (oznaczyć na żółto) lub kliknij żółty dzień, aby go przywrócić.
            </p>
          </div>
          <div className="mini-cal-nav">
            <button type="button" className="mini-nav-btn" onClick={prevAdminMonth} aria-label="Poprzedni miesiąc">
              ‹
            </button>
            <span className="mini-nav-title">
              {POLISH_MONTHS[calMonth]} {calYear}
            </span>
            <button type="button" className="mini-nav-btn" onClick={nextAdminMonth} aria-label="Następny miesiąc">
              ›
            </button>
          </div>
        </div>

        <div className="mini-calendar-weekdays">
          {POLISH_DAYS_SHORT.map((d) => (
            <div key={d} className="mini-weekday-label">
              {d}
            </div>
          ))}
        </div>

        <div className="mini-calendar-grid">
          {adminCells.map((dayNum, i) => {
            if (!dayNum) {
              return <div key={i} className="mini-day-cell empty" />;
            }

            const dStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const booking = bookings.find((b) => b.booking_date === dStr);
            const isBlocked = booking && booking.client_name?.startsWith('[ZABLOKOWANY]');
            const isClientBooked = booking && !isBlocked;

            let statusClass = 'status-free';
            let tooltip = 'Wolny termin — kliknij, aby wyłączyć';

            if (isBlocked) {
              statusClass = 'status-blocked';
              tooltip = 'Wyłączony z puli — kliknij, aby przywrócić';
            } else if (isClientBooked) {
              statusClass = 'status-booked';
              tooltip = `Zajęty: @${cleanIg(booking.client_name)} (${booking.booking_time}) — kliknij, by odwołać`;
            }

            return (
              <button
                key={i}
                type="button"
                className={`mini-day-cell ${statusClass}`}
                onClick={() => handleDayClickInAdminCalendar(dStr)}
                title={tooltip}
                aria-label={`${dStr}: ${tooltip}`}
              >
                <span className="mini-day-num">{dayNum}</span>
                <span className="mini-indicator-dot" />
              </button>
            );
          })}
        </div>

        <div className="mini-cal-legend">
          <div className="mini-legend-item">
            <span className="mini-swatch free" />
            <span>Wolny</span>
          </div>
          <div className="mini-legend-item">
            <span className="mini-swatch blocked" />
            <span>Wyłączony (żółty)</span>
          </div>
          <div className="mini-legend-item">
            <span className="mini-swatch booked" />
            <span>Zajęty</span>
          </div>
        </div>
      </div>

      {/* ── Nawigacja po zakładkach ── */}
      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Nadchodzące wizyty ({upcomingBookings.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Wszystkie wizyty ({allClientBookings.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'blocked' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocked')}
        >
          Dni wyłączone z puli ({blockedDays.length})
        </button>
      </div>

      {/* ── Treść zakładki ── */}
      <div className="admin-card list-card">
        {/* ZAKŁADKA 1: Nadchodzące wizyty */}
        {activeTab === 'upcoming' && (
          <div>
            <div className="card-header-row">
              <h3>Nadchodzące wizyty</h3>
              <span className="count-tag">{upcomingBookings.length} terminów</span>
            </div>

            {upcomingBookings.length === 0 ? (
              <p className="empty-state">Brak nadchodzących wizyt w kalendarzu.</p>
            ) : (
              <div className="bookings-list">
                {upcomingBookings.map((b) => {
                  const isToday = b.booking_date === todayStr;
                  const igUsername = cleanIg(b.client_name);

                  return (
                    <div key={b.id || b.booking_date} className={`booking-row-item ${isToday ? 'today-highlight' : ''}`}>
                      <div className="booking-date-badge">
                        <span className="badge-time">{b.booking_time}</span>
                        {isToday && <span className="today-badge">DZISIAJ</span>}
                      </div>

                      <div className="booking-info">
                        <div className="booking-client">
                          <a
                            href={`https://instagram.com/${igUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ig-link"
                            title="Otwórz profil na Instagramie"
                          >
                            @{igUsername}
                          </a>
                        </div>
                        <div className="booking-full-date">
                          {formatFriendlyDate(b.booking_date)}
                        </div>
                      </div>

                      <div className="booking-actions">
                        <button
                          type="button"
                          className="cancel-btn"
                          onClick={() => handleDelete(b)}
                          title="Odwołaj i zwolnij termin"
                        >
                          Odwołaj
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ZAKŁADKA 2: Wszystkie wizyty */}
        {activeTab === 'all' && (
          <div>
            <div className="card-header-row">
              <div>
                <h3>Historia wszystkich wizyt</h3>
                <p className="card-desc" style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #888)' }}>
                  Rezerwacje są automatycznie usuwane z bazy danych 3 dni po dacie wizyty.
                </p>
              </div>
              <input
                type="text"
                className="search-input"
                placeholder="Szukaj po IG lub dacie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {filteredAll.length === 0 ? (
              <p className="empty-state">Brak wizyt spełniających kryteria.</p>
            ) : (
              <div className="bookings-list">
                {filteredAll.map((b) => {
                  const isPast = b.booking_date < todayStr;
                  const igUsername = cleanIg(b.client_name);

                  return (
                    <div key={b.id || b.booking_date} className={`booking-row-item ${isPast ? 'past-item' : ''}`}>
                      <div className="booking-date-badge">
                        <span className="badge-time">{b.booking_time}</span>
                        {isPast ? (
                          <span className="status-badge past">Zakończona</span>
                        ) : (
                          <span className="status-badge future">Nadchodząca</span>
                        )}
                      </div>

                      <div className="booking-info">
                        <div className="booking-client">
                          <a
                            href={`https://instagram.com/${igUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ig-link"
                          >
                            @{igUsername}
                          </a>
                        </div>
                        <div className="booking-full-date">
                          {formatFriendlyDate(b.booking_date)}
                        </div>
                      </div>

                      <div className="booking-actions">
                        <button
                          type="button"
                          className="cancel-btn danger"
                          onClick={() => handleDelete(b)}
                          title="Usuń wpis"
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ZAKŁADKA 3: Dni wyłączone z puli */}
        {activeTab === 'blocked' && (
          <div>
            <div className="card-header-row">
              <h3>Dni wyłączone z puli rezerwacji</h3>
              <span className="count-tag">{blockedDays.length} dni</span>
            </div>

            {blockedDays.length === 0 ? (
              <p className="empty-state">Brak zablokowanych dni. Wszystkie standardowe dni są w puli.</p>
            ) : (
              <div className="bookings-list">
                {blockedDays.map((b) => {
                  return (
                    <div key={b.id || b.booking_date} className="booking-row-item blocked-row">
                      <div className="booking-date-badge">
                        <span className="badge-time">CAŁY DZIEŃ</span>
                      </div>

                      <div className="booking-info">
                        <div className="blocked-reason-title">
                          <strong>Termin wyłączony z puli</strong>
                        </div>
                        <div className="booking-full-date">
                          {formatFriendlyDate(b.booking_date)}
                        </div>
                      </div>

                      <div className="booking-actions">
                        <button
                          type="button"
                          className="restore-btn"
                          onClick={() => handleDelete(b)}
                          title="Przywróć ten dzień do puli rezerwacji"
                        >
                          Przywróć do puli
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
