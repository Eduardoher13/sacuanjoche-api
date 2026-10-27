export const A5_PAGE_SIZE_MM = {
  width: 148,
  height: 210,
};

export const MM_TO_PT = 72 / 25.4;

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

export function a5PageSize() {
  return {
    width: mmToPt(A5_PAGE_SIZE_MM.width),
    height: mmToPt(A5_PAGE_SIZE_MM.height),
  };
}

export function positionA5(xMm: number, yMm: number) {
  return {
    x: mmToPt(xMm),
    y: mmToPt(yMm),
  };
}

export function a5MarginsMm(margins: {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}) {
  return [
    mmToPt(margins.left ?? 0),
    mmToPt(margins.top ?? 0),
    mmToPt(margins.right ?? 0),
    mmToPt(margins.bottom ?? 0),
  ] as [number, number, number, number];
}
