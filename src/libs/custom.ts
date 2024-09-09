export function generateRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomUpperString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  return Array.from({ length }).reduce((prev: string) => prev + characters.charAt(Math.floor(Math.random() * characters.length)), '');
}

export function generateRandomNumber(length: number): string {
  const characters = '0123456789';

  return Array.from({ length }).reduce((prev: string) => prev + characters.charAt(Math.floor(Math.random() * characters.length)), '');
}