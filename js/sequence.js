/* =========================================================================
   430-frame exploded-view sequence, scrubbed on a canvas.
   Frames live at ../assets/frames/openpulse/openpulse_0001.webp …
   ========================================================================= */
(function () {
  "use strict";
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  const stage = document.querySelector("#seqStage");
  const canvas = document.querySelector("#seqCanvas");
  if (!stage || !canvas) return;

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COUNT = 430;
  const BASE = canvas.dataset.frames || "../assets/frames/openpulse/openpulse_";
  const src = (i) => BASE + String(i + 1).padStart(4, "0") + ".webp";

  const ctx = canvas.getContext("2d");
  const imgs = new Array(COUNT);
  const loaded = new Array(COUNT).fill(false);
  let current = 0;

  function draw(index) {
    let i = index;
    if (!loaded[i]) {
      for (let d = 1; d < COUNT; d++) {
        if (loaded[i - d]) { i -= d; break; }
        if (loaded[i + d]) { i += d; break; }
      }
      if (!loaded[i]) return;
    }
    const img = imgs[i];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth * dpr, H = canvas.clientHeight * dpr;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const scale = Math.min(W / img.width, H / img.height) * 0.82;
    const w = img.width * scale, h = img.height * scale;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }

  function load(i, cb) {
    if (imgs[i]) return;
    const im = new Image();
    im.onload = () => { loaded[i] = true; if (cb) cb(i); };
    im.src = src(i);
    imgs[i] = im;
  }

  load(0, () => draw(0));
  // coarse pass, then fill in
  for (let i = 6; i < COUNT; i += 6) load(i, (k) => { if (Math.abs(k - current) < 8) draw(current); });
  setTimeout(() => { for (let i = 0; i < COUNT; i++) load(i); }, 900);

  window.addEventListener("resize", () => draw(current));
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Exploded view of the OpenPulse sensor module, driven by scroll");

  if (REDUCED) {
    current = Math.floor(COUNT / 2);
    load(current, () => draw(current));
    gsap.set('[data-sscene="a"]', { opacity: 1 });
    return;
  }

  const proxy = { f: 0 };
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: stage, start: "top top",
      end: () => "+=" + Math.round(Math.max(window.innerHeight, 600) * 3.4),
      pin: ".seqstage__pin", scrub: 1,
    },
  });

  tl.fromTo(proxy, { f: 0 }, {
    f: COUNT - 1, ease: "none", duration: 1,
    onUpdate: () => {
      const idx = Math.round(proxy.f);
      if (idx !== current) { current = idx; draw(current); }
    },
  }, 0);

  const scenes = [
    { sel: '[data-sscene="a"]', inAt: 0.02, outAt: 0.2 },
    { sel: '[data-sscene="b"]', inAt: 0.28, outAt: 0.44 },
    { sel: '[data-sscene="c"]', inAt: 0.5,  outAt: 0.66 },
    { sel: '[data-sscene="d"]', inAt: 0.8,  outAt: null },
  ];
  scenes.forEach(({ sel, inAt, outAt }, n) => {
    const fromX = n % 2 === 0 ? 60 : -60;
    tl.fromTo(sel, { opacity: 0, x: fromX, filter: "blur(12px)" },
      { opacity: 1, x: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.1 }, inAt);
    if (outAt !== null) {
      tl.to(sel, { opacity: 0, x: -fromX * 0.6, filter: "blur(10px)", ease: "power2.in", duration: 0.08 }, outAt);
    }
  });
})();
