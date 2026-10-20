import { parsePair, pairToParam } from "./parse.js";

const STATE_KEY = "dog-battery:estado";
const HISTORY_KEY = "dog-battery:historico";
const HISTORY_MAX = 12;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado ou armazenamento cheio: segue sem salvar */
  }
}

export const loadState = () => read(STATE_KEY, {});
export const saveState = (state) => write(STATE_KEY, state);

export const loadHistory = () => {
  const list = read(HISTORY_KEY, []);
  return Array.isArray(list) ? list : [];
};

export function addToHistory(entry) {
  const list = loadHistory().filter(
    (e) => !(e.target?.x === entry.target.x && e.target?.y === entry.target.y && e.weapon === entry.weapon),
  );
  list.unshift(entry);
  const trimmed = list.slice(0, HISTORY_MAX);
  write(HISTORY_KEY, trimmed);
  return trimmed;
}

export function clearHistory() {
  write(HISTORY_KEY, []);
  return [];
}

/** Lê ?g=x,y&t=x,y&w=l81 da URL. */
export function readShareParams(search = location.search) {
  const params = new URLSearchParams(search);
  return {
    gun: params.has("g") ? parsePair(params.get("g")) : null,
    target: params.has("t") ? parsePair(params.get("t")) : null,
    weapon: params.get("w"),
  };
}

export function buildShareUrl({ gun, target, weapon }) {
  const url = new URL(location.href);
  url.search = "";
  if (gun) url.searchParams.set("g", pairToParam(gun));
  if (target) url.searchParams.set("t", pairToParam(target));
  if (weapon) url.searchParams.set("w", weapon);
  return url.toString();
}
