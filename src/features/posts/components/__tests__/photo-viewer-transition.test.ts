import { describe, expect, it, jest } from '@jest/globals';

import type { ViewerGeometry } from '../photo-viewer-geometry';
import {
  intersectsWindow,
  measurePhotoOrigin,
  travelDestination,
  validWindowRect,
} from '../photo-viewer-transition';

const fill: ViewerGeometry = { viewportWidth: 400, viewportHeight: 800, fitWidth: 400, fitHeight: 800 };

describe('origem medida do thumbnail', () => {
  it('aceita apenas retângulos finitos e com área', () => {
    expect(validWindowRect({ x: 10, y: 20, width: 120, height: 80 })).toEqual({ x: 10, y: 20, width: 120, height: 80 });
    expect(validWindowRect({ x: 10, y: 20, width: 0, height: 80 })).toBeNull();
    expect(validWindowRect({ x: 10, y: 20, width: 120, height: 0 })).toBeNull();
    expect(validWindowRect({ x: Number.NaN, y: 20, width: 120, height: 80 })).toBeNull();
    expect(validWindowRect(null)).toBeNull();
  });

  it('rejeita medida totalmente fora da janela, mas aceita o cartão parcialmente visível', () => {
    expect(intersectsWindow({ x: 0, y: 0, width: 100, height: 100 }, 400, 800)).toBe(true);
    // Metade do cartão sob o cabeçalho: a parte tocada ainda existe na tela.
    expect(intersectsWindow({ x: 10, y: -40, width: 100, height: 100 }, 400, 800)).toBe(true);
    expect(intersectsWindow({ x: 10, y: -120, width: 100, height: 100 }, 400, 800)).toBe(false);
    expect(intersectsWindow({ x: 500, y: 10, width: 100, height: 100 }, 400, 800)).toBe(false);
  });

  it('devolve a medida do host e zera quando não há host ou a medida é inválida', () => {
    const onMeasured = jest.fn<(origin: unknown) => void>();
    measurePhotoOrigin({ measureInWindow: (callback) => callback(12, 34, 120, 180) }, 400, 800, onMeasured);
    expect(onMeasured).toHaveBeenCalledWith({ x: 12, y: 34, width: 120, height: 180 });

    measurePhotoOrigin({ measureInWindow: (callback) => callback(0, 0, 0, 0) }, 400, 800, onMeasured);
    expect(onMeasured).toHaveBeenLastCalledWith(null);

    measurePhotoOrigin(null, 400, 800, onMeasured);
    expect(onMeasured).toHaveBeenLastCalledWith(null);
  });
});

describe('destino da transição', () => {
  it('centraliza a foto na área útil e soma os insets da janela', () => {
    expect(travelDestination(fill, { top: 24, left: 0 })).toEqual({ x: 0, y: 24, width: 400, height: 800 });
  });

  it('calcula as bordas de uma foto que não preenche a viewport', () => {
    const letterbox: ViewerGeometry = { viewportWidth: 400, viewportHeight: 800, fitWidth: 300, fitHeight: 600 };
    expect(travelDestination(letterbox, { top: 10, left: 20 })).toEqual({ x: 70, y: 110, width: 300, height: 600 });
  });

  it('não inventa destino antes de a viewport medir', () => {
    expect(travelDestination({ viewportWidth: 0, viewportHeight: 0, fitWidth: 0, fitHeight: 0 }, { top: 0, left: 0 })).toBeNull();
  });
});
