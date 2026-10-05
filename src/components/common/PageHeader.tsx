import type { ReactNode } from 'react';

function PageHeader({ title, icon, aside }: { title: string; icon: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-slate-950 text-orange-400" aria-hidden="true">
          {icon}
        </span>
        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      </div>
      {aside}
    </div>
  );
}

export default PageHeader;
