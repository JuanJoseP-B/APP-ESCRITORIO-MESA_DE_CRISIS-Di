import { useEffect, useState, type FormEvent } from 'react';
import type { Coordenadas, NuevoReporte, TipoEmergencia } from '@argos/shared';
import { validarReporte } from '../domain/reporte';
import type { EstadoGeolocalizacion } from '../hooks/useGeolocalizacion';
import { ConfirmacionReporte } from './ConfirmacionReporte';
import { SelectorTipoEmergencia } from './SelectorTipoEmergencia';
import { SelectorUbicacion } from './SelectorUbicacion';

interface Props {
  readonly geolocalizacion: EstadoGeolocalizacion;
  readonly onSolicitarUbicacion: () => void;
  /** Devuelve el ID del reporte creado. */
  readonly onEnviar: (reporte: NuevoReporte, foto: File | null) => Promise<string>;
}

type Envio = 'inactivo' | 'enviando' | 'error';

export function FormularioReporte({ geolocalizacion, onSolicitarUbicacion, onEnviar }: Props) {
  const [tipo, setTipo] = useState<TipoEmergencia | null>(null);
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(
    geolocalizacion.estado === 'ok' ? geolocalizacion.coordenadas : null,
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [claveFoto, setClaveFoto] = useState(0);
  const [errores, setErrores] = useState<readonly string[]>([]);
  const [envio, setEnvio] = useState<Envio>('inactivo');
  const [idConfirmado, setIdConfirmado] = useState<string | null>(null);

  // Un fix GPS nuevo reubica el marcador; después el usuario puede arrastrarlo.
  useEffect(() => {
    if (geolocalizacion.estado === 'ok') setUbicacion(geolocalizacion.coordenadas);
  }, [geolocalizacion]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const problemas = validarReporte({ tipo: tipo ?? '', lat: ubicacion?.lat ?? null, lng: ubicacion?.lng ?? null }, foto);
    setErrores(problemas);
    if (problemas.length > 0 || !tipo || !ubicacion) return;

    setEnvio('enviando');
    try {
      const id = await onEnviar({ tipo, lat: ubicacion.lat, lng: ubicacion.lng }, foto);
      setEnvio('inactivo');
      setIdConfirmado(id);
    } catch (err) {
      setEnvio('error');
      setErrores([err instanceof Error ? err.message : 'No se pudo enviar el reporte.']);
    }
  };

  const cerrarConfirmacion = () => {
    setIdConfirmado(null);
    setTipo(null);
    setFoto(null);
    setClaveFoto((n) => n + 1);
  };

  return (
    <>
      <form onSubmit={enviar} className="flex flex-col gap-4 p-4 font-sans" noValidate>
        <h2 className="font-mono text-xs font-bold uppercase tracking-wide">Reporte rápido</h2>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold">Tipo de emergencia</span>
          <SelectorTipoEmergencia valor={tipo} onCambiar={setTipo} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Ubicación</span>
          <button
            type="button"
            onClick={onSolicitarUbicacion}
            disabled={geolocalizacion.estado === 'obteniendo'}
            className="min-h-11 border border-linea bg-superficie px-4 text-left text-sm font-bold disabled:opacity-60"
          >
            {geolocalizacion.estado === 'obteniendo' ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
          </button>
          <SelectorUbicacion ubicacion={ubicacion} onCambiar={setUbicacion} />
          <p className="font-mono text-xs">
            {ubicacion ? (
              <span className="text-ok">
                {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
              </span>
            ) : (
              'Pulsa el mapa o usa tu ubicación; arrastra el marcador para ajustarla.'
            )}
          </p>
          {geolocalizacion.estado === 'error' && (
            <p role="alert" className="text-sm text-critico">
              {geolocalizacion.mensaje}
            </p>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm font-bold">
          Foto (opcional)
          <input
            key={claveFoto}
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
      {idConfirmado && <ConfirmacionReporte idReporte={idConfirmado} onCerrar={cerrarConfirmacion} />}
    </>
  );
}
