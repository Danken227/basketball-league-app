interface Option<T> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  dark?: boolean;
}

function SegmentedControl<T extends string | number>({ options, value, onChange, label, dark }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={`inline-flex rounded-full p-1 ${dark ? 'bg-white/10' : 'bg-slate-100'}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
              active
                ? 'bg-orange-500 text-slate-950 shadow-sm'
                : dark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
