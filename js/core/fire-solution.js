// Cada unidade de coordenada do mapa do WARDOGS vale 100 m.
// X cresce para leste, Y cresce para norte.
export const MAP_UNIT_M = 100;

const CARDINALS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];

export const isPoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Distância e direção da arma até o alvo. */
export function solve(gun, target) {
  if (!isPoint(gun) || !isPoint(target)) return null;

  const dx = (target.x - gun.x) * MAP_UNIT_M; // metros para leste
  const dy = (target.y - gun.y) * MAP_UNIT_M; // metros para norte
  const range = Math.hypot(dx, dy);

  if (range === 0) {
    return { dx, dy, range, azimuthDeg: null, azimuthMil: null, cardinal: null };
  }

  // Azimute: 0° = norte, cresce no sentido horário.
  let azimuthDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (azimuthDeg < 0) azimuthDeg += 360;

  return {
    dx,
    dy,
    range,
    azimuthDeg,
    azimuthMil: (azimuthDeg * 6400) / 360,
    cardinal: CARDINALS[Math.round(azimuthDeg / 45) % 8],
  };
}

/** Verifica se a distância cabe no alcance da peça. */
export function checkRange(range, weapon) {
  if (!weapon || weapon.max == null) return { status: "none" };
  if (range > weapon.max) return { status: "far", by: range - weapon.max };
  if (weapon.min != null && range < weapon.min) return { status: "near", by: weapon.min - range };
  return { status: "ok" };
}

/** Converte qualquer ângulo para o intervalo (-180, 180]. */
export function normalizeTurn(deg) {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/**
 * Correção a partir de onde o projétil caiu.
 * dialUsed é o RNG que estava na mira no disparo.
 */
export function correction(gun, target, impact, dialUsed) {
  const toTarget = solve(gun, target);
  const toImpact = solve(gun, impact);
  if (!toTarget || !toImpact || !Number.isFinite(dialUsed)) return null;

  const rangeDelta = toTarget.range - toImpact.range;
  const missBy = Math.hypot(target.x - impact.x, target.y - impact.y) * MAP_UNIT_M;

  let turnDeg = null;
  if (toTarget.azimuthDeg != null && toImpact.azimuthDeg != null) {
    turnDeg = normalizeTurn(toTarget.azimuthDeg - toImpact.azimuthDeg);
  }

  return {
    newDial: dialUsed + rangeDelta,
    rangeDelta, // > 0 caiu curto, aumente o RNG
    turnDeg, // > 0 gire para a direita
    turnMil: turnDeg == null ? null : (turnDeg * 6400) / 360,
    missBy,
  };
}
