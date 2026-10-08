import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PreferenciasProvider } from './hooks/usePreferencias';
import { IdiomaProvider } from './i18n/IdiomaProvider';
import { aplicarPreferencias, leerPreferencias } from './domain/preferencias';
import './mapaWorker';
import './styles.css';
import { sistemaPrefiereOscuro } from './tema';

// Antes del primer pintado, para no mostrar un tema equivocado un instante.
aplicarPreferencias(leerPreferencias(), sistemaPrefiereOscuro());

const raiz = document.getElementById('root');
if (!raiz) throw new Error('No se encontró #root');

createRoot(raiz).render(
  <StrictMode>
    <IdiomaProvider>
      <PreferenciasProvider>
        <App />
      </PreferenciasProvider>
    </IdiomaProvider>
  </StrictMode>,
);
