import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { haciaDeg, rumbo, type Viento } from '../domain/viento';
import { useTexto } from '../i18n/IdiomaProvider';
import './WindCard.css';

export interface WindCardProps {
  readonly viento: Viento;
  /** Mientras se traza una zona la tarjeta se pliega para no estorbar a la herramienta. */
  readonly plegarForzado?: boolean;
}

/**
 * Tarjeta de viento sobre el mapa (overlay HTML, no una capa del mapa): brújula con la aguja hacia donde sopla,
 * velocidad, rumbo y una recomendación derivada de la dirección. La aguja oscila ±6° para que se lea «en vivo».
 * Se pliega a un botón circular con la flecha. Mejora futura: dibujar la pluma de gas en el mapa.
 */
export function WindCard({ viento, plegarForzado = false }: WindCardProps) {
  const { t } = useTexto();
  const [plegada, setPlegada] = useState(false);
  useEffect(() => {
    if (plegarForzado) setPlegada(true);
  }, [plegarForzado]);

  const hacia = haciaDeg(viento);
  const desde = t(`rumbo.${rumbo(viento.fromDeg)}`);
  const destino = t(`rumbo.${rumbo(hacia)}`);
  const estilo = { ['--ag-rumbo' as string]: `${hacia}deg` };

  if (plegada) {
    return (
      <button
        type="button"
        className="ag-viento-boton"
        style={estilo}
        aria-label={t('viento.desplegar', { velocidad: viento.speedKmh, desde, hacia: destino })}
        title={t('viento.desplegar', { velocidad: viento.speedKmh, desde, hacia: destino })}
        aria-expanded={false}
        onClick={() => setPlegada(false)}
      >
        <ArrowUp aria-hidden="true" size={20} className="ag-viento-boton__flecha" />
      </button>
    );
  }

  return (
    <section className="ag-isla ag-viento" aria-label={t('viento.aria')} style={estilo}>
      <button type="button" className="ag-viento__brujula" aria-label={t('viento.plegar')} title={t('viento.plegar')} aria-expanded onClick={() => setPlegada(true)}>
        <svg width="76" height="76" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" className="ag-viento__esfera" strokeWidth="1.5" />
          <g fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" textAnchor="middle" className="ag-viento__letras">
            <text x="50" y="18">{t('rumbo.0')}</text>
            <text x="86" y="54">{t('rumbo.2')}</text>
            <text x="50" y="90">{t('rumbo.4')}</text>
            <text x="14" y="54">{t('rumbo.6')}</text>
          </g>
          <g className="ag-viento__aguja">
            <path d="M50 18 L57 52 L50 46 L43 52 Z" className="ag-viento__punta" strokeWidth="1" />
            <path d="M50 82 L57 52 L50 58 L43 52 Z" className="ag-viento__cola" />
          </g>
          <circle cx="50" cy="50" r="3.5" className="ag-viento__eje" />
        </svg>
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-[var(--isla-texto-2)]">{t('viento.titulo')}</span>
        <span className="font-mono text-[22px] font-bold leading-none tabular">
          {viento.speedKmh} <span className="text-[12px]">km/h</span>
        </span>
        <span className="font-mono text-[12px] font-bold tabular">
          {desde} → {destino} · {hacia}°
        </span>
        <span className="text-[11px] leading-[1.35] text-[var(--texto-recomendacion)]">{t('viento.recomendacion', { rumbo: destino })}</span>
      </div>
    </section>
  );
}
