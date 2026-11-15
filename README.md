# System Rezerwacji Wizyt (Booking Page)

Aplikacja do rezerwacji wizyt z kalendarzem na kolejny miesiąc oraz panelem administratora.

## 🔐 Hasło administratora
Hasło do panelu administratora jest przechowywane (zahashowane SHA-256) w bazie Supabase w tabeli `admin_settings` i weryfikowane po stronie bazy funkcją `verify_admin_password`.
Aby je ustawić lub zmienić, uruchom w Supabase **SQL Editor** zakomentowane zapytanie `insert into public.admin_settings ...` z końca pliku [supabase_schema.sql](./supabase_schema.sql).

## 🚀 Jak uruchomić bazę danych na Vercel (Supabase)

Strona jest aplikacją frontendową React (Vite). Aby rezerwacje zapisywały się w centralnej bazie i były widoczne dla wszystkich (klientów i Ciebie), należy połączyć ją z darmową bazą **Supabase**.

### Krok 1: Utworzenie bazy w Supabase (darmowe)
1. Zaloguj się lub załóż darmowe konto na [supabase.com](https://supabase.com).
2. Kliknij **New project**, wpisz nazwę (np. `booking-page`) i ustaw hasło do bazy.
3. Po utworzeniu projektu przejdź w lewym menu do **SQL Editor** (`</>`).
4. Kliknij **New query**, skopiuj całą zawartość pliku [supabase_schema.sql](./supabase_schema.sql) i wklej ją.
5. Kliknij zielony przycisk **Run**. Tabela `bookings` wraz z uprawnieniami, triggerem oraz funkcją automatycznego usuwania wizyt 3 dni po terminie zostanie utworzona!

### Krok 2: Pobranie kluczy API
1. W Supabase przejdź do: **Project Settings** (ikona zębatki na dole po lewej) → **API**.
2. Skopiuj dwie wartości:
   - **Project URL** (np. `https://xyzcompany.supabase.co`)
   - **Project API Keys** → `anon` `public` (długi klucz token)

### Krok 3: Dodanie zmiennych w Vercel
1. Zaloguj się na [vercel.com](https://vercel.com) i przejdź do swojego projektu.
2. Wejdź w: **Settings** → **Environment Variables**.
3. Dodaj dwie zmienne:
   - Key: `VITE_SUPABASE_URL` | Value: *(Twój Project URL)*
   - Key: `VITE_SUPABASE_ANON_KEY` | Value: *(Twój anon public key)*
4. Zaznacz dla nich wszystkie środowiska (*Production*, *Preview*, *Development*) i zapisz (**Save**).

### ⚠️ Krok 4: Ponowne wdrożenie (Redeploy) — BARDZO WAŻNE!
Vite wstrzykuje zmienne `VITE_*` podczas budowania projektu. Po dodaniu zmiennych w Vercel musisz przebudować stronę:
1. W panelu Vercel wejdź w zakładkę **Deployments**.
2. Kliknij trzy kropki `...` obok najnowszego wdrożenia i wybierz **Redeploy**.
3. Po zakończeniu wdrożenia strona natychmiast zacznie korzystać z Supabase, a żółty pasek "Tryb demo" zniknie!

---

## 💻 Uruchomienie lokalne

```bash
npm install
npm run dev
```
Aby lokalnie korzystać z Supabase, utwórz plik `.env` wzorując się na `.env.example`.
