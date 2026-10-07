import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  // Zmiana klucza (np. adresu strony) czyści błąd — przejście na inną stronę próbuje ją wyświetlić od nowa.
  resetKey: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error?: Error;
  resetKey: string;
}

// Błąd w trakcie wyświetlania strony bez tego komponentu zostawia białą stronę (React usuwa całe drzewo).
// Zamiast niej pokazujemy komunikat z treścią błędu (pomaga go zgłosić) i przycisk odświeżenia.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey !== state.resetKey ? { error: undefined, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Błąd strony:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-xl font-black text-slate-900">Nie udało się wyświetlić strony</h1>
        <p className="mt-2 text-sm text-slate-600">Spróbuj odświeżyć stronę. Jeśli błąd się powtarza, prześlij nam poniższą treść.</p>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-700">
          {`${error.name}: ${error.message}\n${navigator.userAgent}`}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400"
        >
          Odśwież
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
