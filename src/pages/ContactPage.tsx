import type { ReactNode } from 'react';
import { icons } from '../components/common/icons';
import PageHeader from '../components/common/PageHeader';
import contactData from '@client/content/contact.json';

// Kontakt z dalk.pl: trzy karty (organizator, zarząd, propozycje i reklama) i władze ligi. Treść w konfiguracji
// klienta (clients/<klient>/content/contact.json).

interface ContactCard {
  icon: string;
  title: string;
  lines: string[];
  person?: string;
  phone?: string;
  email?: string;
  featured?: boolean;
}

interface ContactPerson {
  role: string;
  note?: string;
  names: string[];
  href?: string;
}

interface Contact {
  cards: ContactCard[];
  authorities: {
    title: string;
    organizer: { label: string; name: string; document?: { label: string; href: string } };
    people: ContactPerson[];
  };
}

const contact: Contact = contactData;

const cardIcons: Record<string, ReactNode> = {
  place: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  person: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
  edit: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </svg>
  ),
};

const linkClass = 'font-medium text-orange-600 underline-offset-2 hover:text-orange-700 hover:underline';

function Card({ card }: { card: ContactCard }) {
  return (
    <section
      className={`flex flex-col items-center rounded-2xl bg-white px-5 py-7 text-center shadow-sm ring-1 ring-slate-200 ${
        card.featured ? 'border-b-4 border-orange-500 shadow-md' : ''
      }`}
    >
      <span className="text-slate-400">{cardIcons[card.icon]}</span>
      <h2 className="mt-4 text-sm font-black uppercase tracking-wider text-slate-900">{card.title}</h2>
      <div className="mt-4 flex flex-col gap-0.5 text-sm leading-relaxed text-slate-600">
        {card.lines.map((line, index) => (line ? <p key={index}>{line}</p> : <span key={index} className="h-3" aria-hidden="true" />))}
        {card.person && <p className="font-bold text-slate-900">{card.person}</p>}
        {card.phone && (
          <a href={`tel:${card.phone.replace(/\s/g, '')}`} className={`mt-3 ${linkClass}`}>
            {card.phone}
          </a>
        )}
        {card.email && (
          <a href={`mailto:${card.email}`} className={`${card.phone ? '' : 'mt-1'} ${linkClass}`}>
            {card.email}
          </a>
        )}
      </div>
    </section>
  );
}

function ContactPage() {
  const { cards, authorities } = contact;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Kontakt" icon={icons.contact} />
      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} card={card} />
        ))}
      </div>
      <section className="mt-8 rounded-2xl bg-white px-5 py-8 shadow-sm ring-1 ring-slate-200 sm:px-8">
        <h2 className="text-center text-2xl font-black uppercase tracking-tight text-orange-600">{authorities.title}</h2>
        <div className="mt-6 text-center">
          <p className="text-xs font-black uppercase tracking-wider text-slate-900">{authorities.organizer.label}</p>
          <p className="mt-1 text-sm text-slate-600">{authorities.organizer.name}</p>
          {authorities.organizer.document && (
            <a
              href={authorities.organizer.document.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-600 ring-1 ring-orange-200 transition hover:bg-orange-50"
            >
              <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icons.rules}</span>
              {authorities.organizer.document.label}
            </a>
          )}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {authorities.people.map((person) => (
            <div key={person.role} className="flex flex-col items-center rounded-xl bg-white px-4 py-6 text-center shadow-sm ring-1 ring-slate-200 shadow-orange-500/20">
              <p className="text-sm font-bold text-slate-900">{person.role}</p>
              {person.note && <p className="mt-1 text-xs text-slate-500">{person.note}</p>}
              <div className="mt-4 flex flex-col gap-1 text-sm text-slate-600">
                {person.names.map((name) =>
                  person.href ? (
                    <a key={name} href={person.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {name}
                    </a>
                  ) : (
                    <p key={name}>{name}</p>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ContactPage;
