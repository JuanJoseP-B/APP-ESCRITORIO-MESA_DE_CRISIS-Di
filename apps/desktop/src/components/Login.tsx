import { useState, type FormEvent } from 'react';
import { Button, TextField } from '@argos/ui';
import { useTexto } from '../i18n/IdiomaProvider';

interface Props {
  readonly onIniciarSesion: (email: string, password: string) => Promise<void>;
  readonly error: string | null;
}

export function Login({ onIniciarSesion, error }: Props) {
  const { t } = useTexto();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    onIniciarSesion(email, password).finally(() => setEnviando(false));
  };

  return (
    <div className="grid h-screen grid-cols-[440px_1fr] bg-surface-canvas text-text-primary">
      <aside className="flex flex-col justify-between bg-surface-inverse p-10 text-text-inverse">
        <p className="font-mono text-overline uppercase">
          <span className="text-text-inverse-accent" aria-hidden="true">■</span> {t('login.sistema')}
        </p>
        <div>
          <p className="font-display text-display-xl">ARGOS</p>
          <p className="mt-2 font-display text-title-lg">{t('login.producto')}</p>
          <div className="mt-6 h-2 w-24 bg-action-primary" />
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-border-control pt-4">
          <div>
            <dt className="font-mono text-micro uppercase text-text-inverse">{t('login.canal')}</dt>
            <dd className="mt-1 font-mono text-data-sm tabular">TLS 1.3</dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase text-text-inverse">{t('login.rol')}</dt>
            <dd className="mt-1 font-mono text-data-sm tabular">{t('login.rol.operador')}</dd>
          </div>
        </dl>
      </aside>
      <main className="flex items-center justify-center p-8">
        <form
          onSubmit={enviar}
          aria-label={t('login.aria')}
          className="flex w-100 flex-col gap-5 rounded-sm border-2 border-border-strong bg-surface-raised p-8 shadow-overlay"
        >
          <p className="font-mono text-overline uppercase text-text-accent">{t('login.seccion')}</p>
          <h1 className="-mt-3 font-display text-display-lg text-text-primary">{t('login.titulo')}</h1>
          <p className="-mt-2 font-ui text-body-md text-text-secondary">
            {t('login.ayuda')}
          </p>
          <TextField
            label={t('login.correo')}
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={t('login.contrasena')}
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
          <Button variant="primary" size="lg" block type="submit" disabled={enviando}>
            {enviando ? t('login.verificando') : t('login.ingresar')}
          </Button>
        </form>
      </main>
    </div>
  );
}
