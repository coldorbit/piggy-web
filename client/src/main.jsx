import { createRoot } from 'react-dom/client';
import AppProviders from './app/AppProviders.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <AppProviders>
    <App />
  </AppProviders>,
);
