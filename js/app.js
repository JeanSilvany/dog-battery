import { WEAPONS, DEFAULT_WEAPON } from "./data/weapons.js";
import { solve, checkRange, correction, isPoint, normalizeTurn } from "./core/fire-solution.js";
import { parseNumber, parsePair } from "./core/parse.js";
import {
  loadState, saveState, loadHistory, addToHistory, clearHistory,
  readShareParams, buildShareUrl,
} from "./core/storage.js";
import { createDial } from "./ui/dial.js";
import { tweenNumber, clearNumber } from "./ui/animate.js";

const $ = (id) => document.getElementById(id);

const el = {
  weapons: $("weapons"),
  gun: $("gun"), gunParsed: $("gun-parsed"),
  target: $("target"), targetParsed: $("target-parsed"),
  impact: $("impact"), impactParsed: $("impact-parsed"),
  dialUsed: $("dial-used"),
  outRange: $("out-range"), outAz: $("out-az"), status: $("status"),
  correctionOut: $("correction-out"),
  historyList: $("history-list"), historyEmpty: $("history-empty"), historyCount: $("history-count"),
  toast: $("toast"),
};

const dial = createDial($("dial"));

const fmt = (n, digits = 0) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const wrap360 = (d) => ((d % 360) + 360) % 360;
const pointText = (p) => (p ? `${p.x}, ${p.y}` : "");

let weaponId = DEFAULT_WEAPON;
let azShown = 0; // acumulado, para o número girar pelo caminho mais curto
let lastKey = "";
let fireTimer;

/* ---------- Leitura ---------- */

function readField(input, out) {
  const raw = input.value.trim();
  const p = parsePair(raw);
  const bad = raw !== "" && !p;
  input.classList.toggle("invalid", bad);
  out.classList.toggle("error", bad);
  out.textContent = p ? `X ${fmt(p.x, 2)}  ·  Y ${fmt(p.y, 2)}` : bad ? "Cole dois números: X e Y" : "";
  return p;
}

/* ---------- Render ---------- */

function render() {
  const weapon = WEAPONS[weaponId];
  const gun = readField(el.gun, el.gunParsed);
  const target = readField(el.target, el.targetParsed);
  const impact = readField(el.impact, el.impactParsed);

  saveState({ weapon: weaponId, gun, target });

  const sol = solve(gun, target);
  dial.update({ solution: sol, weapon, impact: solve(gun, impact) });

  renderReadout(sol, weapon, gun);
  renderCorrection(gun, target, impact, sol);

  // Anima o disparo só quando a solução muda e a pessoa para de digitar
  const key = sol ? `${weaponId}|${gun.x},${gun.y}|${target.x},${target.y}` : "";
  if (key && key !== lastKey) {
    clearTimeout(fireTimer);
    fireTimer = setTimeout(() => dial.fire(), 280);
  }
  lastKey = key;
}

function renderReadout(sol, weapon, gun) {
  const status = el.status;
  if (!sol) {
    clearNumber(el.outRange);
    el.outAz.textContent = "Aguardando coordenadas";
    status.textContent = gun ? "Agora cole as coordenadas do alvo." : "Cole a sua posição e a do alvo.";
    status.dataset.tone = "";
    return;
  }

  tweenNumber(el.outRange, sol.range, (v) => fmt(v));

  if (sol.azimuthDeg == null) {
    el.outAz.textContent = "Mesmo ponto";
  } else {
    azShown += normalizeTurn(sol.azimuthDeg - wrap360(azShown));
    const mils = fmt(sol.azimuthMil);
    tweenNumber(el.outAz, azShown, (v) => `${fmt(wrap360(v), 1)}° ${sol.cardinal}  ·  ${mils} mils`);
  }

  const check = checkRange(sol.range, weapon);
  if (sol.range === 0) {
    status.textContent = "A peça e o alvo estão no mesmo ponto.";
    status.dataset.tone = "warn";
  } else if (check.status === "far") {
    status.textContent = `Fora de alcance: ${fmt(check.by)} m além do máximo do ${weapon.name}.`;
    status.dataset.tone = "warn";
  } else if (check.status === "near") {
    status.textContent = `Perto demais: o ${weapon.name} precisa de pelo menos ${fmt(weapon.min)} m.`;
    status.dataset.tone = "warn";
  } else {
    status.textContent = "No alcance. Gire a peça e coloque a distância no RNG.";
    status.dataset.tone = "ok";
  }
  el.dialUsed.placeholder = fmt(Math.round(sol.range));
}

function renderCorrection(gun, target, impact, sol) {
  const out = el.correctionOut;
  if (!sol || !impact) {
    out.innerHTML = `<p class="muted">Depois do primeiro disparo, marque no mapa onde o projétil caiu e cole aqui.</p>`;
    return;
  }
  const used = el.dialUsed.value.trim() === "" ? Math.round(sol.range) : parseNumber(el.dialUsed.value);
  const c = correction(gun, target, impact, used);
  if (!c) {
    out.innerHTML = `<p class="muted">Confira o RNG usado no disparo.</p>`;
    return;
  }

  const rangeText = Math.abs(c.rangeDelta) < 1
    ? "Distância certa."
    : c.rangeDelta > 0 ? `Caiu curto, aumente ${fmt(c.rangeDelta)} m.` : `Caiu longe, diminua ${fmt(-c.rangeDelta)} m.`;
  const turnText = c.turnDeg == null || Math.abs(c.turnDeg) < 0.1
    ? "Direção certa."
    : `Gire ${fmt(Math.abs(c.turnDeg), 1)}° para a ${c.turnDeg > 0 ? "direita" : "esquerda"}.`;

  out.innerHTML = `
    <p class="new-dial"><span>Novo RNG</span><strong>${fmt(c.newDial)} m</strong></p>
    <p>${rangeText} ${turnText}</p>
    <p class="muted">O impacto ficou a ${fmt(c.missBy)} m do alvo.</p>`;
}

function renderHistory(list = loadHistory()) {
  el.historyList.innerHTML = "";
  el.historyEmpty.hidden = list.length > 0;
  el.historyCount.textContent = list.length ? String(list.length) : "";
  list.forEach((h, i) => {
    const li = document.createElement("li");
    const name = WEAPONS[h.weapon]?.name ?? h.weapon;
    const az = h.azimuth == null ? "—" : `${fmt(h.azimuth, 0)}°`;
    li.innerHTML = `
      <button type="button" class="history-item" data-index="${i}">
        <strong>${fmt(h.range)} m</strong>
        <span>${az}</span>
        <small>${name}, alvo ${h.target.x} / ${h.target.y}</small>
      </button>`;
    el.historyList.append(li);
  });
}

/* ---------- Seletor de peça ---------- */

function buildWeapons() {
  const marker = document.createElement("span");
  marker.className = "weapons-marker";
  marker.setAttribute("aria-hidden", "true");
  el.weapons.append(marker);

  for (const w of Object.values(WEAPONS)) {
    const label = document.createElement("label");
    label.className = "weapon";
    label.innerHTML = `
      <input type="radio" name="weapon" value="${w.id}">
      <span class="weapon-name">${w.name}</span>
      <span class="weapon-range">${w.max ? `${fmt(w.min)}–${fmt(w.max)} m` : w.caliber}</span>`;
    el.weapons.append(label);
  }

  el.weapons.addEventListener("change", (e) => {
    weaponId = e.target.value;
    moveMarker();
    render();
  });
  window.addEventListener("resize", moveMarker);
}

function selectWeapon(id) {
  weaponId = WEAPONS[id] ? id : DEFAULT_WEAPON;
  const input = el.weapons.querySelector(`input[value="${weaponId}"]`);
  if (input) input.checked = true;
  moveMarker();
}

function moveMarker() {
  const label = el.weapons.querySelector("input:checked")?.parentElement;
  const marker = el.weapons.querySelector(".weapons-marker");
  if (!label || !marker) return;
  marker.style.width = `${label.offsetWidth}px`;
  marker.style.transform = `translateX(${label.offsetLeft}px)`;
}

/* ---------- Ações ---------- */

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

async function copy(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    toast(ok ? okMsg : "Não deu para copiar. Selecione o texto manualmente.");
  }
}

const current = () => ({ gun: parsePair(el.gun.value), target: parsePair(el.target.value) });

function wire() {
  [el.gun, el.target, el.impact, el.dialUsed].forEach((input) =>
    input.addEventListener("input", render),
  );

  $("swap").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    [el.gun.value, el.target.value] = [el.target.value, el.gun.value];
    btn.classList.remove("spin");
    btn.getBoundingClientRect();
    btn.classList.add("spin");
    render();
  });

  $("new-target").addEventListener("click", () => {
    el.target.value = el.impact.value = el.dialUsed.value = "";
    render();
    el.target.focus();
  });

  $("save-mission").addEventListener("click", () => {
    const { gun, target } = current();
    const sol = solve(gun, target);
    if (!sol) return toast("Preencha a peça e o alvo antes de salvar.");
    renderHistory(addToHistory({
      weapon: weaponId, gun, target, range: sol.range, azimuth: sol.azimuthDeg, at: Date.now(),
    }));
    toast("Missão salva no histórico.");
  });

  $("clear-history").addEventListener("click", () => renderHistory(clearHistory()));

  el.historyList.addEventListener("click", (e) => {
    const btn = e.target.closest(".history-item");
    if (!btn) return;
    const h = loadHistory()[Number(btn.dataset.index)];
    if (!h) return;
    selectWeapon(h.weapon);
    el.gun.value = pointText(h.gun);
    el.target.value = pointText(h.target);
    el.impact.value = el.dialUsed.value = "";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("copy-solution").addEventListener("click", () => {
    const { gun, target } = current();
    const sol = solve(gun, target);
    if (!sol) return toast("Ainda não há solução para copiar.");
    const az = sol.azimuthDeg == null ? "—" : `${fmt(sol.azimuthDeg, 0)}° ${sol.cardinal}`;
    copy(`${WEAPONS[weaponId].name}: RNG ${fmt(sol.range)} m, AZ ${az}`, "Solução copiada.");
  });

  $("copy-link").addEventListener("click", () => {
    const { gun, target } = current();
    if (!gun && !target) return toast("Preencha ao menos uma posição.");
    copy(buildShareUrl({ gun, target, weapon: weaponId }), "Link copiado. Manda pro esquadrão.");
  });
}

/* ---------- Início ---------- */

function init() {
  buildWeapons();
  wire();

  const saved = loadState();
  const shared = readShareParams();
  selectWeapon([shared.weapon, saved.weapon].find((w) => w && WEAPONS[w]) ?? DEFAULT_WEAPON);
  el.gun.value = pointText(shared.gun ?? (isPoint(saved.gun) ? saved.gun : null));
  el.target.value = pointText(shared.target ?? (isPoint(saved.target) ? saved.target : null));

  if (shared.gun || shared.target) history.replaceState(null, "", location.pathname);

  renderHistory();
  render();
  document.fonts?.ready.then(moveMarker);
}

init();
