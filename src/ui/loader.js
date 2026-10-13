// ---------------------------------------------------------------------------
// NAČÍTAVANIE 0 – 100 %
// Číslo sleduje skutočné sťahovanie modelov, ale nikdy nebeží rýchlejšie než
// `minMs`, aby sa animácia stihla prehrať aj pri rýchlom pripojení.
// ---------------------------------------------------------------------------
export function createLoader(minMs) {
  const root = document.getElementById('loader');
  const num = document.getElementById('loader-num');
  const bar = document.getElementById('loader-bar');
  const start = performance.now();
  let target = 0;
  let shown = 0;
  let finish;
  const done = new Promise((resolve) => (finish = resolve));

  function frame(now) {
    const cap = Math.min(1, (now - start) / minMs);
    const goal = Math.min(target, cap);
    shown += (goal - shown) * 0.14;
    if (goal - shown < 0.004 || document.hidden) shown = goal;
    num.textContent = Math.round(shown * 100);
    bar.style.transform = `scaleX(${shown})`;
    if (shown >= 1) return void setTimeout(finish, 260);
    next();
  }
  // V karte na pozadí prehliadač animácie pozastaví; časovač zabezpečí, že sa
  // načítanie dokončí aj tam a návštevníka po návrate čaká hotový úvod.
  const next = () => (document.hidden ? setTimeout(() => frame(performance.now()), 60) : requestAnimationFrame(frame));
  next();

  return {
    set: (p) => (target = Math.max(target, Math.min(1, p))),
    done,
    hide: () => root.classList.add('is-done'),
  };
}
