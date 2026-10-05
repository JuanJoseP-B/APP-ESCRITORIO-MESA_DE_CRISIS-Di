import { useState, type FormEvent } from 'react';

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

  const campo = 'mt-1 w-full border border-linea bg-superficie px-2 py-1.5 font-mono text-sm text-texto';

  return (
    <main className="flex h-screen items-center justify-center bg-base text-texto">
      <form onSubmit={enviar} aria-label="Acceso de operador" className="w-80 border border-linea bg-superficie p-4">
        <h1 className="text-lg font-bold tracking-tight">ARGOS · Mesa de Crisis</h1>
        <p className="mb-3 font-mono text-xs uppercase">Acceso de operadores</p>
        <label className="block text-sm">
          Correo
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
        </label>
        <label className="mt-2 block text-sm">
          Contraseña
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={campo} />
        </label>
        {error && (
          <p role="alert" className="mt-2 border border-critico px-2 py-1 font-mono text-xs text-critico">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="mt-3 w-full border border-texto px-2 py-1.5 font-mono text-xs uppercase hover:bg-base disabled:opacity-40"
        >
          {enviando ? 'Verificando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
