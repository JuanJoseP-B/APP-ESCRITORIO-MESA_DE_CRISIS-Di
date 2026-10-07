import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './mapaWorker';
import './styles.css';
import { aplicarTema, temaGuardado } from './tema';

aplicarTema(temaGuardado());

const raiz = document.getElementById('root');
if (!raiz) throw new Error('No se encontró #root');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
