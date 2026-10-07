import { cx } from '../cx';
import { Badge, SEVERIDADES, type EstadoIncidenteBadge, type SeveridadBadge } from './Badge';
import { Glyph } from './Glyph';
import './IncidentCard.css';

export interface IncidentCardProps {
  title: string;
  severity: SeveridadBadge;
  status?: EstadoIncidenteBadge;
  /** Hora en 24 h, p. ej. "14:02". */
  time?: string;
  /** Identificador dictable por radio, p. ej. "INC-0412". */
  code?: string;
  location?: string;
  reports?: number;
  units?: number;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}

function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

export function IncidentCard({ title, severity, status, time, code, location, reports, units, selected, onSelect, className }: IncidentCardProps) {
  const meta = [
    code ? <b key="c">{code}</b> : null,
    location ? <span key="l">{location}</span> : null,
    reports != null ? <span key="r">{plural(reports, 'reporte', 'reportes')}</span> : null,
    units != null ? <span key="u">{plural(units, 'unidad', 'unidades')}</span> : null,
  ].filter(Boolean);
  return (
    <button type="button" className={cx('ag-card', className)} aria-pressed={selected ? 'true' : 'false'} onClick={onSelect}>
      <h3 className="ag-card__title">
        <Glyph shape={SEVERIDADES[severity].shape} className={`ag-sev--${severity}`} />
        <span className="ag-card__title-text">{title}</span>
      </h3>
      <span className="ag-card__time">{time ?? ''}</span>
      <span className="ag-card__badges">
        <Badge severity={severity} />
        {status ? <Badge status={status} /> : null}
      </span>
      {meta.length ? <span className="ag-card__meta">{meta}</span> : null}
    </button>
  );
}
