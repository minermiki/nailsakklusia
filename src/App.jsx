import { useState, useEffect, useCallback } from 'react';
import Calendar from './components/Calendar';
import BookingModal from './components/BookingModal';
import AdminPanel from './components/AdminPanel';
import { fetchBookingsForMonth, isSupabaseConfigured } from './lib/supabase';
import './App.css';

function getIsAdminRoute() {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.startsWith('/admin') ||
    window.location.pathname.startsWith('/admin/') ||
    window.location.hash === '#admin'
  );
}

const CURRENT_YEAR = new Date().getFullYear();

function App() {
  const [isAdminView, setIsAdminView] = useState(getIsAdminRoute);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [toast, setToast] = useState(null);

  /* ── obsługa routingu /admin ── */
  useEffect(() => {
    const handleRouteChange = () => {
      setIsAdminView(getIsAdminRoute());
    };
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  const navigateToAdmin = (e) => {
    if (e) e.preventDefault();
    window.history.pushState(null, '', '/admin');
    setIsAdminView(true);
  };

  const navigateToHome = () => {
    window.history.pushState(null, '', '/');
    setIsAdminView(false);
    loadBookings();
  };

  /* ── pobierz rezerwacje na kolejny miesiąc ── */
  const loadBookings = useCallback(async () => {
    try {
      const today = new Date();
      const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const data = await fetchBookingsForMonth(nextDate.getFullYear(), nextDate.getMonth());
      setBookings(data || []);
    } catch (err) {
      console.error('Nie udało się pobrać rezerwacji:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAdminView) {
      loadBookings();
    }
  }, [isAdminView, loadBookings]);

  /* ── obsługa kliknięcia na dzień ── */
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  /* ── po udanej rezerwacji ── */
  const handleBookingComplete = () => {
    loadBookings();
    showToast('Wizyta zarezerwowana!');
  };

  /* ── toast ── */
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="app">
      {/* ── banner demo ── */}
      {!isSupabaseConfigured && (
        <div className="demo-banner">
          Tryb demo — dane zapisywane lokalnie. Podłącz Supabase w pliku <code>.env</code>
        </div>
      )}

      {/* ── Panel admina LUB Kalendarz główny ── */}
      {isAdminView ? (
        <AdminPanel onNavigateHome={navigateToHome} />
      ) : (
        <>
          <Calendar
            onDateSelect={handleDateSelect}
            bookings={bookings}
          />

          {showModal && selectedDate && (
            <BookingModal
              date={selectedDate}
              bookings={bookings}
              onClose={() => setShowModal(false)}
              onBookingComplete={handleBookingComplete}
              onRefresh={loadBookings}
            />
          )}

          <footer className="app-footer">
            <a href="/admin" onClick={navigateToAdmin} className="admin-footer-link">
              Panel administratora
            </a>
            <span className="footer-copyright">
              © {CURRENT_YEAR}. Wszelkie prawa zastrzeżone.
            </span>
          </footer>
        </>
      )}

      {/* ── toast notification ── */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}

export default App;
