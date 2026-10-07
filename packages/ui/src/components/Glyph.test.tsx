// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Glyph } from './Glyph';

afterEach(cleanup);

describe('Glyph', () => {
  it('es decorativo y usa la forma pedida', () => {
    const { container } = render(<Glyph shape="triangle" />);
    const el = container.firstElementChild;
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(el?.classList.contains('ag-glyph--triangle')).toBe(true);
  });

  it('usa cuadrado por defecto', () => {
    const { container } = render(<Glyph />);
    expect(container.firstElementChild?.classList.contains('ag-glyph--square')).toBe(true);
  });
});
