import { useEffect, useRef } from 'react';
import { cx } from '../cx';
import './ContadorRodante.css';

export interface ContadorRodanteProps {
  /** Lo que se muestra; al cambiar, el valor nuevo entra rodando desde abajo (sube) o desde arriba (baja). */
  valor: string | number;
  className?: string;
}

const primerNumero = (texto: string): number | null => {
  const m = /\d+/.exec(texto);
  return m ? Number(m[0]) : null;
};

/**
 * Contador de dígitos tabulares que ruedan al cambiar. El texto sigue siendo un solo nodo (lectores de pantalla
 * y pruebas lo ven igual); la animación es CSS y con movimiento reducido el valor aparece sin rodar.
 */
export function ContadorRodante({ valor, className }: ContadorRodanteProps) {
  const texto = String(valor);
  const previo = useRef<string | null>(null);
  let sentido: 'sube' | 'baja' | null = null;
  if (previo.current !== null && previo.current !== texto) {
    const antes = primerNumero(previo.current);
    const ahora = primerNumero(texto);
    sentido = antes !== null && ahora !== null && ahora < antes ? 'baja' : 'sube';
  }
  useEffect(() => {
    previo.current = texto;
  });
  return (
    <span className={cx('ag-rodante', className)}>
      <span key={texto} className={cx('ag-rodante__valor', sentido && `ag-rodante__valor--${sentido}`)}>
        {texto}
      </span>
    </span>
  );
}
