import { Link } from 'react-router-dom';

const Placeholder = ({ title }: { title: string }) => {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">Ta sekcja jest w przygotowaniu.</p>
      <Link to="/" className="mt-6 inline-block text-sm font-medium text-orange-600 hover:text-orange-700">
        ← Wróć na stronę główną
      </Link>
    </div>
  );
};

export default Placeholder;
