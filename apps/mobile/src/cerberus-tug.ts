export type Point = { x: number; y: number };
export const HOLD_DELAY = 350;
export const HOLD_SLOP = 10;

export function spriteOrigin(
  width: number,
  height: number,
  size: number,
  travel: number,
  position: number,
  padding: number,
): Point {
  return {
    x: (width - size) / 2 + (position - 0.5) * travel,
    y: height - 12 - size + (size * padding) / 512,
  };
}

export function hitsSprite(
  point: Point,
  origin: Point,
  size: number,
  facingRight: boolean,
  mask: string,
): boolean {
  let x = (point.x - origin.x) / size;
  const y = (point.y - origin.y) / size;
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return false;
  if (facingRight) x = 1 - x;
  const bit = Math.floor(y * 32) * 32 + Math.min(31, Math.floor(x * 32));
  return (
    (parseInt(mask[Math.floor(bit / 4)] ?? '0', 16) & (1 << (bit % 4))) !== 0
  );
}

export function withinArea(point: Point, width: number, height: number) {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= width &&
    point.y >= 0 &&
    point.y <= height
  );
}

export function ropePath(mouth: Point, finger: Point): string {
  // A short, shallow bend keeps the rope taut while retaining a little give.
  const sag = Math.min(
    8,
    Math.hypot(finger.x - mouth.x, finger.y - mouth.y) * 0.04,
  );
  return `M ${mouth.x} ${mouth.y} Q ${(mouth.x + finger.x) / 2} ${(mouth.y + finger.y) / 2 + sag} ${finger.x} ${finger.y}`;
}
