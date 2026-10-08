import { useState, type FormEvent } from 'react';
import { Button, TextField } from '@argos/ui';

interface Props {
  readonly onIniciarSesion: (email: string, password: string) => Promise<void>;
  readonly error: string | null;
}

export function Login({ onIniciarSesion, error }: Props) {
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
          <span className="text-text-inverse-accent" aria-hidden="true">■</span> Sistema de respuesta a emergencias
        </p>
        <div>
          <p className="font-display text-display-xl">ARGOS</p>
          <p className="mt-2 font-display text-title-lg">Mesa de Crisis</p>
          <div className="mt-6 h-2 w-24 bg-action-primary" />
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-border-control pt-4">
          <div>
            <dt className="font-mono text-micro uppercase text-text-inverse">Canal</dt>
            <dd className="mt-1 font-mono text-data-sm tabular">TLS 1.3</dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase text-text-inverse">Rol</dt>
            <dd className="mt-1 font-mono text-data-sm tabular">Operador</dd>
          </div>
        </dl>
      </aside>
      <main className="flex items-center justify-center p-8">
        <form
          onSubmit={enviar}
          aria-label="Acceso de operador"
          className="flex w-100 flex-col gap-5 rounded-sm border-2 border-border-strong bg-surface-raised p-8 shadow-overlay"
        >
          <p className="font-mono text-overline uppercase text-text-accent">01 · Acceso de operadores</p>
          <h1 className="-mt-3 font-display text-display-lg text-text-primary">Ingresar a la mesa</h1>
          <p className="-mt-2 font-ui text-body-md text-text-secondary">
            Identifíquese con su cuenta institucional. Toda acción queda registrada en la bitácora del turno.
          </p>
          <TextField
            label="Correo"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Contraseña"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
          <Button variant="primary" size="lg" block type="submit" disabled={enviando}>
            {enviando ? 'Verificando…' : 'Ingresar'}
          </Button>
        </form>
      </main>
    </div>
  );
}
