import { icons } from '../components/common/icons';
import PageHeader from '../components/common/PageHeader';
import { regulations, withExternalLinks } from '../data/news';

const linkClass = '[&_a]:font-medium [&_a]:break-words [&_a]:text-orange-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-orange-700';

// Regulamin ligi z dalk.pl: spis rozdziałów i rozdziały z numerowanymi punktami (podpunkty z wcięciem).
function RegulationsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Regulamin" icon={icons.rules} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        <nav className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4" aria-label="Rozdziały regulaminu">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Rozdziały</p>
          <ol className="space-y-1 text-sm">
            {regulations.map((section) => (
              <li key={section.label}>
                <a href={`#rozdzial-${section.label}`} className="flex gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50 hover:text-orange-600">
                  <span className="w-4 shrink-0 font-semibold text-orange-600">{section.label}.</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex flex-col gap-4">
          {regulations.map((section) => (
            <section key={section.label} id={`rozdzial-${section.label}`} className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">
                <span className="text-orange-600">{section.label}.</span> {section.title}
              </h2>
              <ol className="mt-3 space-y-2 text-[15px] leading-relaxed text-slate-700">
                {section.items.map((item, index) => (
                  <li key={index} className={`flex gap-2 ${item.level > 1 ? 'pl-7' : ''}`}>
                    <span className="w-6 shrink-0 text-right font-semibold text-slate-900">{item.label}.</span>
                    <span className={`min-w-0 ${linkClass}`} dangerouslySetInnerHTML={{ __html: withExternalLinks(item.html) }} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RegulationsPage;
