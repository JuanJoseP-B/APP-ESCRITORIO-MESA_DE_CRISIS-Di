import { TIPOS_REPORTE, type NuevoReporte } from '@argos/shared';

export const TAMANO_MAX_FOTO = 5 * 1024 * 1024;

export interface FotoInfo {
  readonly type: string;
  readonly size: number;
}

/** Valida un reporte antes de enviarlo; devuelve mensajes de error (vacío si es válido). */
export function validarReporte(
  datos: { readonly tipo: string; readonly lat: number | null; readonly lng: number | null },
  foto?: FotoInfo | null,
): readonly string[] {
  const errores: string[] = [];
  if (!(TIPOS_REPORTE as readonly string[]).includes(datos.tipo)) {
    errores.push('Selecciona el tipo de reporte.');
  }
  if (
    datos.lat === null ||
    datos.lng === null ||
    !Number.isFinite(datos.lat) ||
    !Number.isFinite(datos.lng) ||
    datos.lat < -90 ||
    datos.lat > 90 ||
    datos.lng < -180 ||
    datos.lng > 180
  ) {
    errores.push('Indica tu ubicación para poder enviar el reporte.');
  }
  if (foto) {
    if (!foto.type.startsWith('image/')) errores.push('El archivo debe ser una imagen.');
    if (foto.size > TAMANO_MAX_FOTO) errores.push('La foto no puede superar 5 MB.');
  }
  return errores;
}

export type { NuevoReporte };
