// Checks the ISBN-10 or ISBN-13 checksum. Hyphens and spaces are ignored.
export function isValidIsbn(raw: string | null): boolean {
  if (!raw) return false;
  const s = raw.replace(/[-\s]/g, "");
  if (/^\d{9}[\dXx]$/.test(s)) {
    const sum = [...s].reduce((t, c, i) => t + (10 - i) * (c.toUpperCase() === "X" ? 10 : Number(c)), 0);
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(s)) {
    const sum = [...s].reduce((t, c, i) => t + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0;
  }
  return false;
}
