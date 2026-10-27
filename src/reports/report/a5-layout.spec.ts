import {
  A5_PAGE_SIZE_MM,
  a5PageSize,
  mmToPt,
  positionA5,
} from './a5-layout';

describe('a5-layout', () => {
  it('convierte milímetros a puntos con escala A5', () => {
    expect(mmToPt(0)).toBe(0);
    expect(mmToPt(25.4)).toBeCloseTo(72, 5);
    expect(mmToPt(10)).toBeCloseTo(28.3464567, 5);
  });

  it('define el tamaño de página A5 correctamente', () => {
    expect(a5PageSize()).toEqual({
      width: mmToPt(A5_PAGE_SIZE_MM.width),
      height: mmToPt(A5_PAGE_SIZE_MM.height),
    });
  });

  it('genera posiciones absolutas en mm para A5', () => {
    expect(positionA5(10, 20)).toEqual({
      x: mmToPt(10),
      y: mmToPt(20),
    });
  });
});
