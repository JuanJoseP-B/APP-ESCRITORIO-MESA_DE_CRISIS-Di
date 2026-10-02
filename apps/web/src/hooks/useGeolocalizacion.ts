import { useCallback, useState } from 'react';
import type { Coordenadas } from '@argos/shared';

export type EstadoGeolocalizacion =
  | { readonly estado: 'inactivo' }
  | { readonly estado: 'obteniendo' }
  | { readonly estado: 'ok'; readonly coordenadas: Coordenadas }
  | { readonly estado: 'error'; readonly mensaje: string };

export function mensajeErrorGeolocalizacion(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permiso de ubicación denegado. Actívalo en tu navegador para enviar el reporte.';
    case error.POSITION_UNAVAILABLE:
      return 'No se pudo determinar tu ubicación. Revisa tu señal GPS.';
    case error.TIMEOUT:
      return 'Se agotó el tiempo para obtener tu ubicación. Inténtalo de nuevo.';
    default:
      return 'No se pudo obtener tu ubicación.';
  }
}

/** Envuelve `navigator.geolocation`; la ubicación se solicita solo al invocar `solicitar`. */
export function useGeolocalizacion() {
  const [resultado, setResultado] = useState<EstadoGeolocalizacion>({ estado: 'inactivo' });

  const solicitar = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setResultado({ estado: 'error', mensaje: 'Tu navegador no admite geolocalización.' });
      return;
    }
    setResultado({ estado: 'obteniendo' });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setResultado({
          estado: 'ok',
          coordenadas: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      (err) => setResultado({ estado: 'error', mensaje: mensajeErrorGeolocalizacion(err) }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);

  return { resultado, solicitar };
}
