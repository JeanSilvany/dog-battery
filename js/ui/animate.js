const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Faz o número rolar do valor atual até o novo, como um contador mecânico. */
export function tweenNumber(el, to, format, duration = 650) {
  cancelAnimationFrame(el._raf);
  const from = Number.isFinite(el._value) ? el._value : to;
  el._value = to;

  if (reduceMotion.matches || from === to) {
    el.textContent = format(to);
    return;
  }

  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (to - from) * eased);
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

export function clearNumber(el, text = "—") {
  cancelAnimationFrame(el._raf);
  el._value = NaN;
  el.textContent = text;
}
