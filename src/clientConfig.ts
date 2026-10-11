// Konfiguracja klienta (ligi), dla której budujemy stronę. Produkt (src/) jest wspólny, a wszystko, co dotyczy
// jednej ligi — identyfikatory Genius, nazwa i logo, linki, partnerzy, treści — leży w clients/<klient>/.
// Klienta wybiera zmienna CLIENT przy budowaniu (vite.config.ts, alias @client; domyślnie "dalk"), a serwer
// (api/) — plik api/_client.js.
import type { JuniorCategory } from './components/genius/geniusConfig';
import type { LeagueId } from './data/league';

// Edycja ligi w Genius i numery rozgrywek jej lig seniorów (np. edycja jesienna 2025/26 i wiosenna 2026).
export interface GeniusEdition {
  id: string;
  name: string;
  competitions: Partial<Record<LeagueId, number>>;
}

export interface Partner {
  // Podpis nad logo w stopce (np. "Partner danych").
  label: string;
  name: string;
  href: string;
  // Plik z clients/<klient>/public (adres od "/").
  logo: string;
  width: number;
  height: number;
  // Logo z dużym przezroczystym marginesem przycinamy ramką: klasy ramki (link) i obrazka.
  frameClassName?: string;
  imgClassName?: string;
}

// Dane strony potrzebne już przy budowaniu (vite.config.ts: tytuł, ikona, adres deweloperski) — w site.json klienta.
export interface ClientSite {
  title: string;
  favicon: string;
  devHost: string;
}

export interface ClientConfig {
  site: ClientSite;
  brand: {
    // Krótka nazwa ligi (komunikaty, opis logo).
    shortName: string;
    // Nazwa obok logo w nagłówku, w dwóch liniach.
    nameLines: [string, string];
    copyrightName: string;
    logo: string;
  };
  genius: {
    // Kod organizacji w Genius Sports (adresy treści: /embednf/<kod>/…).
    organization: string;
    // Domeny zarejestrowane w Genius dla organizacji — tylko na nich dane są na żywo (poza nimi dane testowe).
    allowedDomains: string[];
    // Edycje od najnowszej.
    editions: GeniusEdition[];
    // Rozgrywki juniorów: edycja → kategoria → numer rozgrywek.
    juniorCompetitions: Record<string, Partial<Record<JuniorCategory, number>>>;
    // Widget paska meczów z panelu Genius.
    resultsWidgets: Partial<Record<LeagueId | 'all', string>>;
    // Pierwsza grupa tabel z grupami (numer rozgrywek → nazwa), patrz geniusGroups.ts.
    firstGroups: Record<string, string>;
  };
  links: {
    youtube: string;
    // Formularz zgłoszenia drużyny (przycisk w nagłówku); bez niego przycisku nie ma.
    registrationForm?: string;
  };
  partners: Partner[];
  news: {
    // Strona, z której przeniesiono aktualności i regulamin (opisy w panelu administratora).
    sourceSite: string;
    // Adresy obrazków z tamtej strony podmieniane na lokalne kopie (clients/<klient>/public).
    imageRewrites: Record<string, string>;
  };
  // Wersja demonstracyjna (migawka danych): transmisja przypięta do "trwającego" meczu.
  demo: { streamUrl: string };
  // Przedrostek kluczy w przeglądarce (np. licznik wizyt).
  storagePrefix: string;
}
