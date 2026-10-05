import { useState, type FormEvent } from 'react';
import { ETIQUETAS_TIPO_EMERGENCIA, TIPOS_REPORTE, type NuevoReporte, type TipoReporte } from '@argos/shared';
import { validarReporte } from '../domain/reporte';
import type { EstadoGeolocalizacion } from '../hooks/useGeolocalizacion';

interface Props {
  readonly geolocalizacion: EstadoGeolocalizacion;
  readonly onSolicitarUbicacion: () => void;
  readonly onEnviar: (reporte: NuevoReporte, foto: File | null) => Promise<void>;
}

type Envio = 'inactivo' | 'enviando' | 'enviado' | 'error';

export function FormularioReporte({ geolocalizacion, onSolicitarUbicacion, onEnviar }: Props) {
  const [tipo, setTipo] = useState<TipoReporte>('INCENDIO');
  const [foto, setFoto] = useState<File | null>(null);
  const [errores, setErrores] = useState<readonly string[]>([]);
  const [envio, setEnvio] = useState<Envio>('inactivo');

  const coordenadas = geolocalizacion.estado === 'ok' ? geolocalizacion.coordenadas : null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const problemas = validarReporte({ tipo, lat: coordenadas?.lat ?? null, lng: coordenadas?.lng ?? null }, foto);
    setErrores(problemas);
    if (problemas.length > 0 || !coordenadas) return;

    setEnvio('enviando');
    try {
      await onEnviar({ tipo, lat: coordenadas.lat, lng: coordenadas.lng }, foto);
      setEnvio('enviado');
      setFoto(null);
    } catch (err) {
      setEnvio('error');
      setErrores([err instanceof Error ? err.message : 'No se pudo enviar el reporte.']);
    }
  };

  if (envio === 'enviado') {
    return (
      <div role="status" className="p-4 font-sans">
        <p className="border-l-4 border-ok bg-superficie p-3 text-sm font-bold">
          Reporte enviado. Un operador lo revisará y validará.
        </p>
        <button
          type="button"
          onClick={() => setEnvio('inactivo')}
          className="mt-3 min-h-11 border border-linea bg-superficie px-4 text-sm font-bold"
        >
          Enviar otro reporte
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 p-4 font-sans" noValidate>
      <h2 className="font-mono text-xs font-bold uppercase tracking-wide">Reporte rápido</h2>

      <label className="flex flex-col gap-1 text-sm font-bold">
        Tipo de emergencia
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoReporte)}
          className="min-h-11 border border-linea bg-superficie px-2 font-normal"
        >
          {TIPOS_REPORTE.map((t) => (
            <option key={t} value={t}>
              {ETIQUETAS_TIPO_EMERGENCIA[t]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold">Ubicación</span>
        <button
          type="button"
          onClick={onSolicitarUbicacion}
          disabled={geolocalizacion.estado === 'obteniendo'}
          className="min-h-11 border border-linea bg-superficie px-4 text-left text-sm font-bold disabled:opacity-60"
        >
          {geolocalizacion.estado === 'obteniendo' ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
        </button>
        {coordenadas && (
          <p className="font-mono text-xs text-ok">
            {coordenadas.lat.toFixed(5)}, {coordenadas.lng.toFixed(5)}
          </p>
        )}
        {geolocalizacion.estado === 'error' && (
          <p role="alert" className="text-sm text-critico">
            {geolocalizacion.mensaje}
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold">
        Foto (opcional)
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          className="min-h-11 border border-linea bg-superficie p-2 font-normal"
        />
      </label>

      {errores.length > 0 && (
        <ul role="alert" className="border-l-4 border-critico bg-superficie p-3 text-sm">
          {errores.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={envio === 'enviando'}
        className="min-h-12 bg-critico px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60"
      >
        {envio === 'enviando' ? 'Enviando…' : 'Enviar reporte'}
      </button>
    </form>
  );
}
