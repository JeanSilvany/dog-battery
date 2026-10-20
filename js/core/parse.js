const NUMBER = /-?\d+(?:[.,]\d+)?/g;

/** Lê um número aceitando vírgula ou ponto como decimal. */
export function parseNumber(value) {
  if (typeof value !== "string") return Number.isFinite(value) ? value : NaN;
  const s = value.trim().replace(",", ".");
  return s === "" ? NaN : Number(s);
}

/**
 * Extrai um par X/Y de um texto colado.
 * Aceita "x98.43, y110.38", "98.43 110.38", "98,43; 110,38" etc.
 */
export function parsePair(text) {
  if (typeof text !== "string") return null;
  const found = text.match(NUMBER);
  if (!found || found.length < 2) return null;
  const x = parseNumber(found[0]);
  const y = parseNumber(found[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** "98.43,110.38" para links de compartilhamento. */
export const pairToParam = (p) => `${p.x},${p.y}`;
