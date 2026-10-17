import { cx } from '../cx';
import './Glyph.css';

export const FORMAS_GLIFO = ['square', 'triangle', 'circle', 'diamond', 'ring', 'arrow'] as const;
export type FormaGlifo = (typeof FORMAS_GLIFO)[number];

/** Glifo de estado: la forma codifica el significado aunque se pierda el color. */
export function Glyph({ shape = 'square', className }: { shape?: FormaGlifo; className?: string }) {
  return <span aria-hidden="true" className={cx('ag-glyph', `ag-glyph--${shape}`, className)} />;
}
