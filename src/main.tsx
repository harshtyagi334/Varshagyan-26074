import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Remove a development service worker left over from earlier runs. Production
// builds keep the PWA service worker; this only applies on the Vite dev server.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  const appScope = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  void navigator.serviceWorker.getRegistrations().then((registrations) =>
    Promise.all(
      registrations
        .filter((registration) => registration.scope === appScope)
        .map((registration) => registration.unregister()),
    ),
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
