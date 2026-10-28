import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTexto } from '../i18n/IdiomaProvider';
import { etiquetaZonaHoraria, formatearHoraConSegundos } from '../domain/reloj';
import { MapaIntro } from './login/MapaIntro';

interface Props {
  readonly onIniciarSesion: (email: string, password: string) => Promise<void>;
  readonly error: string | null;
}

const CAMPO =
  'h-[44px] w-full rounded-[8px] border bg-[#FFFDFA] px-[14px] font-ui text-[14px] text-[#1A1A1A] placeholder:text-[#8A8178] focus:border-[#4B5D7A] focus:outline-2 focus:outline-offset-2 focus:outline-[#4B5D7A]';

/** Hora local "HH:mm"; se refresca cada 15 s para el pie de la tarjeta. */
function useHoraLocal(): number {
  const [ahora, setAhora] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return ahora;
}

export function Login({ onIniciarSesion, error }: Props) {
  const { t, idioma } = useTexto();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verContrasena, setVerContrasena] = useState(false);
  // Omitir salta al cuadro final: los estilos base de cada pieza ya son su estado terminado.
  const [introOmitida, setIntroOmitida] = useState(false);
  const correoRef = useRef<HTMLInputElement>(null);
  const ahora = useHoraLocal();

  const omitirIntro = useCallback(() => {
    setIntroOmitida(true);
    correoRef.current?.focus();
  }, []);

  useEffect(() => {
    if (introOmitida) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') omitirIntro();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [introOmitida, omitirIntro]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    onIniciarSesion(email, password).finally(() => setEnviando(false));
  };

  const hora = new Date(ahora).getHours();
  const turno = hora >= 6 && hora < 18 ? t('barra.turno.dia') : t('barra.turno.noche');
  const idError = 'login-error';

  return (
    <div
      className="ag-login relative h-dvh overflow-hidden bg-[#E8D8C9] font-ui text-[#1A1A1A]"
      data-intro={introOmitida ? 'omitida' : undefined}
    >
      <MapaIntro />

      {!introOmitida && (
        <div className="ag-login-anim ag-login-intro absolute inset-x-10 bottom-9 flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-[260px] flex-col gap-[10px]">
            <p className="font-mono text-[12px] font-bold uppercase tracking-[.12em]">
              <span className="text-[#F37021]" aria-hidden="true">■</span> {t('login.intro.trazando')}
            </p>
            <div className="h-1 w-[320px] max-w-full overflow-hidden rounded-[4px] bg-[rgba(26,26,26,.12)]">
              <div className="ag-login-anim ag-login-progreso h-full w-full rounded-[4px] bg-[#F37021]" />
            </div>
          </div>
          <button
            type="button"
            onClick={omitirIntro}
            className="h-9 cursor-pointer rounded-[8px] border border-[rgba(26,26,26,.35)] bg-[rgba(248,243,238,.85)] px-4 font-ui text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F8F3EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4B5D7A]"
          >
            {t('login.intro.omitir')}
          </button>
        </div>
      )}

      <aside className="ag-login-anim ag-login-panel absolute inset-y-0 left-0 hidden w-[440px] max-w-full flex-col justify-between bg-[#1A1A1A] px-10 pb-10 pt-12 text-[#F8F3EE] shadow-[12px_0_40px_rgba(26,26,26,.18)] min-[900px]:flex">
        <p className="ag-login-anim ag-login-tarde font-mono text-[12px] font-bold uppercase tracking-[.12em]">
          <span className="text-[#F37021]" aria-hidden="true">■</span> {t('login.sistema')}
        </p>
        <div className="flex flex-col gap-3">
          <p className="ag-login-anim ag-login-marca font-display text-[56px] font-bold leading-none tracking-[-.02em]">ARGOS</p>
          <p className="ag-login-anim ag-login-tarde font-display text-[24px] font-medium">{t('login.producto')}</p>
          <div className="ag-login-anim ag-login-filete mt-5 h-[6px] w-24 rounded-[3px] bg-[#F37021]" />
        </div>
        <dl className="ag-login-anim ag-login-tarde grid grid-flow-col grid-rows-[auto_auto] justify-start gap-x-7 gap-y-[6px] border-t border-[rgba(248,243,238,.2)] pt-5 font-mono text-[12px]">
          <dt className="font-bold uppercase tracking-[.08em]">{t('login.canal')}</dt>
          <dd className="text-[#D9CCBF]">TLS 1.3</dd>
          <dt className="font-bold uppercase tracking-[.08em]">{t('login.rol')}</dt>
          <dd className="text-[#D9CCBF]">{t('login.rol.operador')}</dd>
          <dt className="font-bold uppercase tracking-[.08em]">{t('login.unidades')}</dt>
          <dd className="flex items-center gap-[6px] text-[#D9CCBF]">
            <span className="ag-login-latido size-2 rounded-full bg-[#3FA39A]" aria-hidden="true" />
            {t('login.unidades.enLinea', { n: '06' })}
          </dd>
        </dl>
      </aside>

      <main className="absolute inset-y-0 left-0 right-0 flex items-center justify-center overflow-y-auto p-6 min-[900px]:left-[440px]">
        <form
          onSubmit={enviar}
          aria-label={t('login.aria')}
          className="ag-login-anim ag-login-tarjeta flex w-[400px] max-w-full flex-col gap-[18px] rounded-[14px] border border-[rgba(26,26,26,.14)] bg-[#F8F3EE] p-8 shadow-[0_1px_2px_rgba(26,26,26,.06),0_18px_48px_rgba(26,26,26,.14)]"
        >
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[12px] font-medium uppercase tracking-[.12em] text-[#A84A0F]">{t('login.seccion')}</p>
            <h1 className="m-0 font-display text-[30px] font-bold tracking-[-.01em]">{t('login.titulo')}</h1>
            <p className="m-0 text-[14px] leading-[1.5] text-[#4A443E]">{t('login.ayuda')}</p>
          </div>

          <label className="flex flex-col gap-[6px] text-[14px] font-medium">
            {t('login.correo')}
            <input
              ref={correoRef}
              type="email"
              required
              autoComplete="username"
              placeholder={t('login.correo.ejemplo')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${CAMPO} border-[rgba(26,26,26,.3)]`}
            />
          </label>

          <div className="flex flex-col gap-[6px]">
            <label htmlFor="login-contrasena" className="text-[14px] font-medium">
              {t('login.contrasena')}
            </label>
            <span className="relative block">
              <input
                id="login-contrasena"
                type={verContrasena ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? idError : undefined}
                className={`${CAMPO} pr-12 ${error ? 'border-[#A3221B]' : 'border-[rgba(26,26,26,.3)]'}`}
              />
              <button
                type="button"
                onClick={() => setVerContrasena((v) => !v)}
                aria-label={verContrasena ? t('login.contrasena.ocultar') : t('login.contrasena.mostrar')}
                aria-pressed={verContrasena}
                className="absolute right-1 top-1 flex size-9 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent text-[#4A443E] hover:bg-[rgba(26,26,26,.06)] focus-visible:outline-2 focus-visible:outline-[#4B5D7A]"
              >
                {verContrasena ? (
                  <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Eye size={18} strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            </span>
            {error && (
              <p id={idError} className="m-0 flex gap-[6px] text-[13px] text-[#A3221B]">
                <span aria-hidden="true">■</span>
                <span role="alert">{error}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="ag-login-cta h-12 cursor-pointer rounded-[8px] border border-[#1A1A1A] bg-[#F37021] font-mono text-[14px] font-bold uppercase tracking-[.12em] text-[#1A1A1A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4B5D7A] disabled:cursor-wait disabled:opacity-70"
          >
            {enviando ? t('login.verificando') : t('login.ingresar')}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[rgba(26,26,26,.1)] pt-[14px] font-mono text-[11px] uppercase text-[#5C554E]">
            <span className="whitespace-nowrap">
              {t('login.pie.turno', {
                turno,
                hora: formatearHoraConSegundos(ahora, undefined, idioma).slice(0, 5),
                zona: etiquetaZonaHoraria(ahora),
              })}
            </span>
            <span className="whitespace-nowrap">
              {t('login.pie.mapa')} <span className="text-[#1F5C5C]" aria-hidden="true">●</span> {t('login.pie.sincronizado')}
            </span>
          </div>
        </form>
      </main>

      <div className="ag-login-anim ag-login-velo pointer-events-none absolute inset-0 bg-[#E8D8C9]" aria-hidden="true" />
    </div>
  );
}
