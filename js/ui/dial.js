import { normalizeTurn } from "../core/fire-solution.js";

const C = 160; // centro
const R = 112; // raio que representa o alcance máximo

const LABELS = { 0: "N", 90: "L", 180: "S", 270: "O" };

const polar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};
const f = (n) => n.toFixed(2);

function ticks() {
  let out = "";
  for (let d = 0; d < 360; d += 5) {
    const len = d % 30 === 0 ? 10 : d % 10 === 0 ? 6 : 3;
    const [x1, y1] = polar(d, 140);
    const [x2, y2] = polar(d, 140 - len);
    out += `<line class="${d % 30 === 0 ? "tick-major" : "tick"}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    if (d % 30 === 0) {
      const [lx, ly] = polar(d, 123);
      out += `<text class="${LABELS[d] ? "cardinal" : "deg"}" x="${f(lx)}" y="${f(ly)}">${LABELS[d] ?? d}</text>`;
    }
  }
  return out;
}

/** Monta o mostrador e devolve funções para atualizá-lo e animar o disparo. */
export function createDial(svg) {
  svg.innerHTML = `
    <defs>
      <radialGradient id="glass" cx="50%" cy="42%" r="62%">
        <stop offset="0" stop-color="#2C3622"/>
        <stop offset="1" stop-color="#141910"/>
      </radialGradient>
    </defs>
    <circle class="bezel" cx="${C}" cy="${C}" r="155"/>
    <circle class="face" cx="${C}" cy="${C}" r="145" fill="url(#glass)"/>
    <g class="ticks">${ticks()}</g>
    <circle class="deadzone" cx="${C}" cy="${C}" r="0"/>
    <circle class="ring ring-mid" cx="${C}" cy="${C}" r="${R / 2}"/>
    <circle class="ring ring-max" cx="${C}" cy="${C}" r="${R}"/>
    <text class="ring-label" x="${C + 6}" y="${C - R / 2 + 9}"></text>
    <text class="ring-label" x="${C + 6}" y="${C - R + 9}"></text>
    <path class="tracer" pathLength="1" d="M${C} ${C}"/>
    <g class="impact" visibility="hidden"><path d="M-6 -6L6 6M6 -6L-6 6"/></g>
    <g class="aim">
      <line class="los" x1="${C}" y1="${C}" x2="${C}" y2="${C - R}"/>
      <g class="blip">
        <circle class="ping" cx="${C}" cy="${C}" r="8"/>
        <circle class="blip-ring" cx="${C}" cy="${C}" r="9"/>
        <circle class="blip-dot" cx="${C}" cy="${C}" r="3.5"/>
      </g>
      <rect class="barrel" x="${C - 3.5}" y="${C - 32}" width="7" height="32" rx="2"/>
    </g>
    <circle class="hub" cx="${C}" cy="${C}" r="11"/>
    <circle class="splash" cx="${C}" cy="${C}" r="5"/>
  `;

  const el = {
    aim: svg.querySelector(".aim"),
    los: svg.querySelector(".los"),
    blip: svg.querySelector(".blip"),
    deadzone: svg.querySelector(".deadzone"),
    labels: svg.querySelectorAll(".ring-label"),
    tracer: svg.querySelector(".tracer"),
    splash: svg.querySelector(".splash"),
    impact: svg.querySelector(".impact"),
  };

  let angle = 0; // acumulado, para girar sempre pelo caminho mais curto
  let lastTarget = null;

  function update({ solution, weapon, impact }) {
    const scaleMax = weapon?.max ?? autoScale(solution?.range, impact?.range);
    el.labels[0].textContent = fmtRange(scaleMax / 2);
    el.labels[1].textContent = fmtRange(scaleMax);
    el.deadzone.setAttribute("r", weapon?.min ? f((weapon.min / scaleMax) * R) : "0");

    const ok = !!solution && solution.azimuthDeg != null;
    svg.classList.toggle("has-target", ok);
    if (!ok) {
      lastTarget = null;
      el.impact.setAttribute("visibility", "hidden");
      return;
    }

    angle += normalizeTurn(solution.azimuthDeg - angle);
    const ratio = solution.range / scaleMax;
    const r = Math.min(ratio, 1.08) * R;

    el.aim.style.transform = `rotate(${angle}deg)`;
    el.los.style.transform = `scaleY(${r / R})`;
    el.blip.style.transform = `translateY(${-r}px)`;
    svg.classList.toggle("out-of-range", ratio > 1);
    svg.classList.toggle("too-close", !!weapon?.min && solution.range < weapon.min);

    lastTarget = polar(solution.azimuthDeg, r);

    if (impact && impact.azimuthDeg != null) {
      const [ix, iy] = polar(impact.azimuthDeg, Math.min(impact.range / scaleMax, 1.08) * R);
      el.impact.setAttribute("transform", `translate(${f(ix)} ${f(iy)})`);
      el.impact.setAttribute("visibility", "visible");
    } else {
      el.impact.setAttribute("visibility", "hidden");
    }
  }

  /** Anima o projétil saindo da peça e caindo no alvo. */
  function fire() {
    if (!lastTarget) return;
    const [tx, ty] = lastTarget;
    const mx = (C + tx) / 2, my = (C + ty) / 2;
    const bend = 0.22; // curva leve, só para sugerir a trajetória
    const qx = mx - (ty - C) * bend, qy = my + (tx - C) * bend;
    el.tracer.setAttribute("d", `M${C} ${C} Q${f(qx)} ${f(qy)} ${f(tx)} ${f(ty)}`);
    el.splash.setAttribute("cx", f(tx));
    el.splash.setAttribute("cy", f(ty));
    restart(el.tracer);
    restart(el.splash);
  }

  return { update, fire };
}

function restart(node) {
  node.classList.remove("go");
  node.getBoundingClientRect(); // força o navegador a reiniciar a animação
  node.classList.add("go");
}

function autoScale(...ranges) {
  const max = Math.max(500, ...ranges.filter(Number.isFinite).map((r) => r * 1.25));
  const step = max > 2000 ? 500 : 100;
  return Math.ceil(max / step) * step;
}

function fmtRange(m) {
  return m >= 1000
    ? `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`
    : `${Math.round(m)} m`;
}
