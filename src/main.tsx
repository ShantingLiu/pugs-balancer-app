import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Reveal slim scrollbars while a scrollable container or document is actively scrolling
const scrollTimers = new WeakMap<HTMLElement, number>();
window.addEventListener(
  'scroll',
  (event) => {
    const target =
      event.target === document
        ? document.documentElement
        : event.target instanceof HTMLElement
          ? event.target
          : null;
    if (!target) return;
    target.dataset.scrolling = 'true';
    const existing = scrollTimers.get(target);
    if (existing !== undefined) window.clearTimeout(existing);
    scrollTimers.set(
      target,
      window.setTimeout(() => {
        delete target.dataset.scrolling;
        scrollTimers.delete(target);
      }, 900)
    );
  },
  { passive: true, capture: true }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
