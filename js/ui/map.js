import { isPoint } from "../core/fire-solution.js";

const W = 400;
const H = 300;
const PAD = 30;

/** Desenha o esquema da missão. Pontos em unidades do mapa (1 = 100 m). */
export function drawMap(svg, { gun, target, impact, weapon }) {
  if (!isPoint(gun)) {
    svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" class="map-empty" text-anchor="middle">Marque sua posição para ver o esquema</text>`;
    return;
  }

  const maxR = weapon?.max ? weapon.max / 100 : 0;
  const minR = weapon?.min ? weapon.min / 100 : 0;

  const xs = [gun.x];
  const ys = [gun.y];
  for (const p of [target, impact]) {
    if (isPoint(p)) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  // Sem alvo, mostra o alcance inteiro; com alvo, enquadra os pontos
  // para dar detalhe (o anel pode sair da tela).
  if (maxR && !isPoint(target)) {
    xs.push(gun.x - maxR, gun.x + maxR);
    ys.push(gun.y - maxR, gun.y + maxR);
  }

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max((maxX - minX) * 1.25, (maxY - minY) * 1.25, 3);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = Math.min((W - PAD * 2) / span, (H - PAD * 2) / span);
  const sx = (x) => +(W / 2 + (x - cx) * scale).toFixed(2);
  const sy = (y) => +(H / 2 - (y - cy) * scale).toFixed(2); // norte para cima

  let out = "";

  // Grade: 100 m quando a área é pequena, 1 km quando é grande
  const step = span > 40 ? 10 : 1;
  const x0 = cx - W / 2 / scale, x1 = cx + W / 2 / scale;
  const y0 = cy - H / 2 / scale, y1 = cy + H / 2 / scale;
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
    const km = Math.round(x) % 10 === 0;
    out += `<line class="${km ? "grid-km" : "grid"}" x1="${sx(x)}" y1="0" x2="${sx(x)}" y2="${H}"/>`;
  }
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
    const km = Math.round(y) % 10 === 0;
    out += `<line class="${km ? "grid-km" : "grid"}" x1="0" y1="${sy(y)}" x2="${W}" y2="${sy(y)}"/>`;
  }

  // Anéis de alcance
  if (maxR) out += `<circle class="ring-max" cx="${sx(gun.x)}" cy="${sy(gun.y)}" r="${(maxR * scale).toFixed(2)}"/>`;
  if (minR) out += `<circle class="ring-min" cx="${sx(gun.x)}" cy="${sy(gun.y)}" r="${(minR * scale).toFixed(2)}"/>`;

  if (isPoint(target)) {
    out += `<line class="line-of-fire" x1="${sx(gun.x)}" y1="${sy(gun.y)}" x2="${sx(target.x)}" y2="${sy(target.y)}"/>`;
  }

  if (isPoint(impact)) {
    const ix = sx(impact.x), iy = sy(impact.y), s = 6;
    out += `<path class="impact" d="M${ix - s} ${iy - s}L${ix + s} ${iy + s}M${ix + s} ${iy - s}L${ix - s} ${iy + s}"/>`;
  }

  if (isPoint(target)) {
    const tx = sx(target.x), ty = sy(target.y);
    out += `<circle class="target-ring" cx="${tx}" cy="${ty}" r="9"/>`;
    out += `<circle class="target-dot" cx="${tx}" cy="${ty}" r="3"/>`;
  }

  out += `<rect class="gun" x="${sx(gun.x) - 6}" y="${sy(gun.y) - 6}" width="12" height="12" rx="2"/>`;

  // Seta do norte
  out += `<g transform="translate(${W - 20} 24)"><path class="north" d="M0 -13 L7 6 L0 2 L-7 6 Z"/><text class="north-label" y="20" text-anchor="middle">N</text></g>`;

  out += `<text class="map-legend" x="10" y="${H - 10}">Grade de ${step === 1 ? "100 m" : "1 km"}${maxR ? ", tracejado: alcance da peça" : ""}</text>`;

  svg.innerHTML = out;
}
