import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { captureSharedLink } from './lib/shareIntake.js';
import { InspirationProvider } from './store/InspirationProvider.jsx';
import { TripsProvider } from './store/TripsProvider.jsx';
import './styles/base.css';
import './styles/home.css';
import './styles/trip.css';
import './styles/dialog.css';
import './styles/inspiration.css';

// Opened from Instagram's share menu (or a shortcut) with a link? Remember it and go to Inspiration.
captureSharedLink();

// A tiny service worker makes the site installable, which is what lets Android list it in the Share menu.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* not available (e.g. private mode): the site works the same */ });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <TripsProvider>
        <InspirationProvider>
          <App />
        </InspirationProvider>
      </TripsProvider>
    </ToastProvider>
  </StrictMode>,
);
