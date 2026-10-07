import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')!

// Ostatnia deska ratunku: błąd, którego nie złapie ErrorBoundary (np. w trakcie podmiany strony), usuwa całą
// aplikację i zostaje biała strona. Wtedy wstawiamy zwykły HTML (bez Reacta) z treścią błędu i przyciskiem
// odświeżenia — treść pomaga zdiagnozować problem na urządzeniu, na którym występuje.
function showFatalError(error: unknown) {
  if (document.getElementById('fatal-error')) return
  // Stos wywołań (pierwsze linie) pozwala odnaleźć miejsce błędu w zminifikowanym kodzie.
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(0, 8).join('\n')}` : String(error)
  const box = document.createElement('div')
  box.id = 'fatal-error'
  box.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#fff;color:#0f172a;font:14px/1.5 system-ui,sans-serif;padding:24px;overflow:auto')
  const title = document.createElement('h1')
  title.textContent = 'Nie udało się wyświetlić strony'
  title.setAttribute('style', 'font-size:20px;font-weight:800;margin:0 0 8px')
  const details = document.createElement('pre')
  details.textContent = `${message}\n${location.href}\n${navigator.userAgent}`
  details.setAttribute('style', 'white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px;font-size:12px')
  const button = document.createElement('button')
  button.textContent = 'Odśwież'
  button.setAttribute('style', 'margin-top:12px;background:#f97316;border:0;border-radius:999px;padding:8px 20px;font-weight:600')
  button.onclick = () => location.reload()
  box.append(title, details, button)
  document.body.appendChild(box)
}

// Błędy spoza Reacta pokazujemy tylko wtedy, gdy aplikacja zniknęła (skrypty Genius potrafią zgłaszać własne, nieszkodliwe błędy).
const showIfBlank = (error: unknown) => {
  window.setTimeout(() => {
    if (rootElement.childElementCount === 0) showFatalError(error)
  }, 0)
}
window.addEventListener('error', (event) => showIfBlank(event.error ?? event.message))
window.addEventListener('unhandledrejection', (event) => showIfBlank(event.reason))

createRoot(rootElement, { onUncaughtError: (error) => showFatalError(error) }).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
