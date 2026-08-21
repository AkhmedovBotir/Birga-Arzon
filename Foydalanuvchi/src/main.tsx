import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocaleProvider } from '@/src/i18n';
import App from './App.tsx';
import { SnackbarHost } from './components/ui/Snackbar.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <App />
        <SnackbarHost />
      </AuthProvider>
    </LocaleProvider>
  </StrictMode>,
);
