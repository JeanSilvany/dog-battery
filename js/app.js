import { WEAPONS, DEFAULT_WEAPON } from "./data/weapons.js";
import { solve, checkRange, correction, isPoint } from "./core/fire-solution.js";
import { parseNumber, parsePair } from "./core/parse.js";
import {
  loadState, saveState, loadHistory, addToHistory, clearHistory,
  readShareParams, buildShareUrl,
} from "./core/storage.js";
import { drawMap } from "./ui/map.js";

const $ = (id) => document.getElementById(id);

const el = {
  weapon: $("weapon"),
  gunPaste: $("gun-paste"), gunX: $("gun-x"), gunY: $("gun-y"),
  tgtPaste: $("target-paste"), tgtX: $("target-x"), tgtY: $("target-y"),
  impPaste: $("impact-paste"), impX: $("impact-x"), impY: $("impact-y"),
  dialUsed: $("dial-used"),
  outRange: $("out-range"), outAz: $("out-az"), outCard: $("out-card"),
  outMil: $("out-mil"), outDe: $("out-de"), outDn: $("out-dn"),
  status: $("status"), sight: $("sight"),
  correctionOut: $("correction-out"),
  map: $("map"),
  historyList: $("history-list"), historyEmpty: $("history-empty"),
  toast: $("toast"),
};

const fmt = (n, digits = 0) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n, digits = 0) => (n >= 0 ? "+" : "−") + fmt(Math.abs(n), digits);

/* ---------- Estado ---------- */

const readPoint = (xEl, yEl) => ({ x: parseNumber(xEl.value), y: parseNumber(yEl.value) });
const writePoint = (xEl, yEl, p) => {
  xEl.value = p ? String(p.x) : "";
  yEl.value = p ? String(p.y) : "";
};

function current() {
  const weaponId = el.weapon.value;
  return {
    weaponId,
    weapon: WEAPONS[weaponId],
    gun: readPoint(el.gunX, el.gunY),
    target: readPoint(el.tgtX, el.tgtY),
    impact: readPoint(el.impX, el.impY),
  };
}

/* ---------- Render ---------- */

function render() {
  const s = current();
  saveState({
    weapon: s.weaponId,
    gun: isPoint(s.gun) ? s.gun : null,
    target: isPoint(s.target) ? s.target : null,
  });

  const sol = solve(s.gun, s.target);
  renderSolution(sol, s);
  renderCorrection(s, sol);
  drawMap(el.map, {
    gun: s.gun,
    target: s.target,
    impact: isPoint(s.impact) ? s.impact : null,
    weapon: s.weapon,
  });
}

function setStatus(text, tone = "") {
  el.status.textContent = text;
  el.status.dataset.tone = tone;
  el.sight.dataset.tone = tone;
}

function renderSolution(sol, s) {
  if (!sol) {
    el.outRange.textContent = "—";
    el.outAz.textContent = "—";
    el.outCard.textContent = "";
    el.outMil.textContent = el.outDe.textContent = el.outDn.textContent = "—";
    setStatus(isPoint(s.gun) ? "Agora cole as coordenadas do alvo." : "Comece colando a posição da sua peça.");
    return;
  }

  el.outRange.textContent = fmt(sol.range);
  el.outAz.textContent = sol.azimuthDeg == null ? "—" : fmt(sol.azimuthDeg, 1);
  el.outCard.textContent = sol.cardinal ?? "";
  el.outMil.textContent = sol.azimuthMil == null ? "—" : fmt(sol.azimuthMil);
  el.outDe.textContent = `${signed(sol.dx)} m ${sol.dx >= 0 ? "L" : "O"}`;
  el.outDn.textContent = `${signed(sol.dy)} m ${sol.dy >= 0 ? "N" : "S"}`;

  const check = checkRange(sol.range, s.weapon);
  if (sol.range === 0) {
    setStatus("A arma e o alvo estão no mesmo ponto.", "warn");
  } else if (check.status === "far") {
    setStatus(`Fora de alcance: ${fmt(check.by)} m além do máximo do ${s.weapon.name} (${fmt(s.weapon.max)} m).`, "warn");
  } else if (check.status === "near") {
    setStatus(`Perto demais: faltam ${fmt(check.by)} m para o mínimo do ${s.weapon.name} (${fmt(s.weapon.min)} m).`, "warn");
  } else {
    setStatus(`Gire para ${fmt(sol.azimuthDeg, 0)}° e coloque ${fmt(sol.range)} m no RNG.`, "ok");
  }

  el.dialUsed.placeholder = fmt(sol.range);
}

function renderCorrection(s, sol) {
  const out = el.correctionOut;
  if (!sol || !isPoint(s.impact)) {
    out.innerHTML = `<p class="muted">Depois do primeiro disparo, marque o ponto de impacto no mapa e cole aqui.</p>`;
    return;
  }
  const dial = el.dialUsed.value.trim() === "" ? Math.round(sol.range) : parseNumber(el.dialUsed.value);
  const c = correction(s.gun, s.target, s.impact, dial);
  if (!c) {
    out.innerHTML = `<p class="muted">Confira o RNG usado no disparo.</p>`;
    return;
  }

  const rangeText =
    Math.abs(c.rangeDelta) < 1
      ? "Distância certa, mantenha o RNG."
      : c.rangeDelta > 0
        ? `Caiu curto. Aumente ${fmt(c.rangeDelta)} m.`
        : `Caiu longe. Diminua ${fmt(-c.rangeDelta)} m.`;

  const turnText =
    c.turnDeg == null || Math.abs(c.turnDeg) < 0.1
      ? "Direção certa."
      : `Gire ${fmt(Math.abs(c.turnDeg), 1)}° (${fmt(Math.abs(c.turnMil))} mils) para a ${c.turnDeg > 0 ? "direita" : "esquerda"}.`;

  out.innerHTML = `
    <div class="new-dial"><span>Novo RNG</span><strong>${fmt(c.newDial)}<small>m</small></strong></div>
    <ul>
      <li>${rangeText}</li>
      <li>${turnText}</li>
      <li class="muted">O impacto ficou a ${fmt(c.missBy)} m do alvo.</li>
    </ul>`;
}

function renderHistory(list = loadHistory()) {
  el.historyList.innerHTML = "";
  el.historyEmpty.hidden = list.length > 0;
  for (const [i, h] of list.entries()) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item";
    btn.dataset.index = String(i);
    const weaponName = WEAPONS[h.weapon]?.name ?? h.weapon;
    btn.innerHTML = `
      <span class="h-range">${fmt(h.range)} m</span>
      <span class="h-az">${h.azimuth == null ? "—" : fmt(h.azimuth, 0) + "°"}</span>
      <span class="h-meta">${weaponName}, alvo ${h.target.x} / ${h.target.y}</span>`;
    li.append(btn);
    el.historyList.append(li);
  }
}

/* ---------- Ações ---------- */

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.hidden = true), 2200);
}

async function copy(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    toast(ok ? okMsg : "Não deu para copiar. Selecione o texto manualmente.");
  }
}

function bindPaste(pasteEl, xEl, yEl) {
  pasteEl.addEventListener("input", () => {
    const p = parsePair(pasteEl.value);
    if (p) {
      writePoint(xEl, yEl, p);
      render();
    }
  });
}

function wire() {
  for (const w of Object.values(WEAPONS)) {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = w.max ? `${w.name} (${fmt(w.min)}–${fmt(w.max)} m)` : `${w.name} (${w.caliber})`;
    el.weapon.append(opt);
  }

  bindPaste(el.gunPaste, el.gunX, el.gunY);
  bindPaste(el.tgtPaste, el.tgtX, el.tgtY);
  bindPaste(el.impPaste, el.impX, el.impY);

  [el.weapon, el.gunX, el.gunY, el.tgtX, el.tgtY, el.impX, el.impY, el.dialUsed]
    .forEach((input) => input.addEventListener("input", render));

  $("swap").addEventListener("click", () => {
    const s = current();
    writePoint(el.gunX, el.gunY, isPoint(s.target) ? s.target : null);
    writePoint(el.tgtX, el.tgtY, isPoint(s.gun) ? s.gun : null);
    el.gunPaste.value = el.tgtPaste.value = "";
    render();
  });

  $("new-target").addEventListener("click", () => {
    writePoint(el.tgtX, el.tgtY, null);
    writePoint(el.impX, el.impY, null);
    el.tgtPaste.value = el.impPaste.value = el.dialUsed.value = "";
    render();
    el.tgtPaste.focus();
  });

  $("clear-impact").addEventListener("click", () => {
    writePoint(el.impX, el.impY, null);
    el.impPaste.value = el.dialUsed.value = "";
    render();
  });

  $("save-mission").addEventListener("click", () => {
    const s = current();
    const sol = solve(s.gun, s.target);
    if (!sol) return toast("Preencha a arma e o alvo antes de salvar.");
    renderHistory(addToHistory({
      weapon: s.weaponId, gun: s.gun, target: s.target,
      range: sol.range, azimuth: sol.azimuthDeg, at: Date.now(),
    }));
    toast("Missão salva no histórico.");
  });

  $("clear-history").addEventListener("click", () => renderHistory(clearHistory()));

  el.historyList.addEventListener("click", (e) => {
    const btn = e.target.closest(".history-item");
    if (!btn) return;
    const h = loadHistory()[Number(btn.dataset.index)];
    if (!h) return;
    if (WEAPONS[h.weapon]) el.weapon.value = h.weapon;
    writePoint(el.gunX, el.gunY, h.gun);
    writePoint(el.tgtX, el.tgtY, h.target);
    writePoint(el.impX, el.impY, null);
    el.gunPaste.value = el.tgtPaste.value = el.impPaste.value = el.dialUsed.value = "";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("copy-solution").addEventListener("click", () => {
    const s = current();
    const sol = solve(s.gun, s.target);
    if (!sol) return toast("Ainda não há solução para copiar.");
    const az = sol.azimuthDeg == null ? "—" : `${fmt(sol.azimuthDeg, 0)}° ${sol.cardinal}`;
    copy(`${s.weapon.name}: RNG ${fmt(sol.range)} m, AZ ${az}`, "Solução copiada.");
  });

  $("copy-link").addEventListener("click", () => {
    const s = current();
    if (!isPoint(s.gun) && !isPoint(s.target)) return toast("Preencha ao menos uma posição.");
    const url = buildShareUrl({
      gun: isPoint(s.gun) ? s.gun : null,
      target: isPoint(s.target) ? s.target : null,
      weapon: s.weaponId,
    });
    copy(url, "Link copiado. Mande para o esquadrão.");
  });
}

/* ---------- Início ---------- */

function init() {
  wire();

  const saved = loadState();
  const shared = readShareParams();
  const weaponId = [shared.weapon, saved.weapon].find((w) => w && WEAPONS[w]) ?? DEFAULT_WEAPON;
  el.weapon.value = weaponId;
  writePoint(el.gunX, el.gunY, shared.gun ?? saved.gun ?? null);
  writePoint(el.tgtX, el.tgtY, shared.target ?? saved.target ?? null);

  if (shared.gun || shared.target) {
    history.replaceState(null, "", location.pathname); // limpa a URL depois de carregar
  }

  renderHistory();
  render();
}

init();
