import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { InspirationProvider } from './store/InspirationProvider.jsx';
import { TripsProvider } from './store/TripsProvider.jsx';
import './styles/base.css';
import './styles/home.css';
import './styles/trip.css';
import './styles/dialog.css';
import './styles/inspiration.css';

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
