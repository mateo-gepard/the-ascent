/* =========================================================================
   MATEO MAMALADZE — full-screen scrubbed video + fly-in scenes
   ========================================================================= */
(function () {
  "use strict";

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------------- smooth scroll ----------------
     Deliberately NOT using a smooth-scroll library. Native scroll + ScrollTrigger's
     `scrub` easing gives a rock-solid pin and buttery scrubbing without the
     scroll-container conflicts that break pinning. */
  const lenis = null;

  /* ---------------- small helpers ---------------- */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fontsReady = () =>
    (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  function videoReady(v) {
    return new Promise((res) => {
      if (v.readyState >= 2) return res();
      const done = () => { cleanup(); res(); };
      const cleanup = () => {
        v.removeEventListener("loadeddata", done);
        v.removeEventListener("canplay", done);
        v.removeEventListener("error", done);
      };
      v.addEventListener("loadeddata", done);
      v.addEventListener("canplay", done);
      v.addEventListener("error", done);
      // NB: never call v.load() here — the element is already loading (preload=auto);
      // calling load() resets the pipeline and can stall it at readyState 0.
    });
  }

  /* ---------------- preloader (never blocks longer than the caps) ----------------
     Hidden-tab safe: GSAP runs on rAF, which browsers suspend in background tabs.
     If the page isn't visible we skip the animation and finish instantly, so a
     visitor who opens the site in a background tab never finds it stuck. */
  function runPreloader(ready) {
    const fill = $("#loaderFill");
    const count = $("#loaderCount");
    const state = { p: 0 };
    const paint = () => {
      const v = Math.round(state.p);
      fill.style.width = v + "%";
      count.textContent = v;
    };
    const finishInstant = () => {
      state.p = 100; paint();
      gsap.set("#loader", { autoAlpha: 0, display: "none" });
    };

    if (document.hidden) {
      return Promise.race([ready, wait(2500)]).then(finishInstant);
    }

    const crawl = gsap.to(state, { p: 92, duration: 2.6, ease: "power1.out", onUpdate: paint });

    return Promise.race([ready, wait(4000)]).then(() => {
      crawl.kill();
      if (document.hidden) return finishInstant(); // tab was backgrounded mid-load
      return new Promise((resolve) => {
        const tl = gsap.timeline({ onComplete: resolve })
          .to(state, { p: 100, duration: 0.45, ease: "power2.out", onUpdate: paint })
          .to("#loader", { autoAlpha: 0, duration: 0.7, ease: "power2.inOut" }, "+=0.12")
          .set("#loader", { display: "none" });
        // if rAF suspends before the outro finishes, hard-finish on visibility change
        document.addEventListener("visibilitychange", () => {
          if (document.hidden && tl.progress() < 1) { tl.progress(1); }
        }, { once: true });
      });
    });
  }

  /* ---------------- hero: scrub video + scenes ---------------- */
  function initHero() {
    const video = $("#heroVideo");
    const proxy = { t: 0 };
    let dur = 8;

    // --- coalesced seeking: never queue a new seek while one is in flight ---
    let targetT = 0;
    let seekBusy = false;
    const applySeek = () => {
      if (video.readyState < 1 || seekBusy) return;
      if (Math.abs(video.currentTime - targetT) < 0.012) return;
      seekBusy = true;
      try {
        if (video.fastSeek) video.fastSeek(targetT); // exact on all-keyframe encode
        else video.currentTime = targetT;
      } catch (e) { seekBusy = false; }
    };
    video.addEventListener("seeked", () => { seekBusy = false; applySeek(); });
    const setTime = () => { targetT = proxy.t; applySeek(); };

    function build() {
      dur = video.duration || 8;

      if (REDUCED) {
        // static: show last scene, play video as ambient loop
        gsap.set('[data-scene="c"]', { opacity: 1 });
        video.loop = true; video.play().catch(() => {});
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "+=380%",
          pin: true,          // pin the hero section itself — video stays full-screen
          pinSpacing: true,
          scrub: 1,
        },
      });

      // ---- video scrubs across the whole pin (holds final gaze at the end) ----
      tl.fromTo(proxy, { t: 0 },
        { t: () => dur * 0.999, ease: "none", duration: 0.9, onUpdate: setTime }, 0);

      // if we built before metadata arrived (slow network / hidden tab), pick up
      // the real duration once known and re-evaluate the function-based target
      if (!video.duration) {
        video.addEventListener("loadedmetadata", () => {
          dur = video.duration || dur;
          tl.invalidate();
        }, { once: true });
      }

      // ---- scroll cue fades quickly ----
      tl.to("#heroCue", { autoAlpha: 0, duration: 0.05 }, 0.02);

      // ---- Scene A · centered name (over the empty vista) ----
      tl.set('[data-scene="a"]', { opacity: 1 }, 0.02)
        .fromTo('[data-scene="a"] .ln',
        { yPercent: 120, opacity: 0, filter: "blur(16px)" },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", ease: "power3.out", duration: 0.1, stagger: 0.02 }, 0.03)
        .to('[data-scene="a"] .ln',
        { yPercent: -60, opacity: 0, filter: "blur(14px)", ease: "power2.in", duration: 0.09, stagger: 0.015 }, 0.17)
        .set('[data-scene="a"]', { opacity: 0 }, 0.27);

      // ---- Scene B · centered role (just before he appears) ----
      tl.fromTo('[data-scene="b"]',
        { opacity: 0, y: 44, filter: "blur(14px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.09 }, 0.21)
        .to('[data-scene="b"]',
        { opacity: 0, y: -36, filter: "blur(12px)", ease: "power2.in", duration: 0.08 }, 0.30);

      // ---- Scene C · flies in from the LEFT when he enters, stays clear of him ----
      tl.set('[data-scene="c"]', { opacity: 1 }, 0.34)
        .fromTo('[data-scene="c"] .scene__eyebrow',
          { x: -60, opacity: 0, filter: "blur(10px)" },
          { x: 0, opacity: 1, filter: "blur(0px)", ease: "power3.out", duration: 0.1 }, 0.35)
        .fromTo('[data-scene="c"] .scene__statement .ln',
          { x: -80, opacity: 0, filter: "blur(14px)" },
          { x: 0, opacity: 1, filter: "blur(0px)", ease: "power3.out", duration: 0.14, stagger: 0.035 }, 0.37);

      ScrollTrigger.refresh();
    }

    // Build the pin/scrub/fly-ins as soon as we know the duration — but ALWAYS build
    // within 1.5s even if the video is slow, so the scroll experience never depends on it.
    // Video frames simply catch up (best-effort seeks) once the data arrives.
    let built = false;
    const doBuild = () => { if (built) return; built = true; build(); };

    video.pause();
    // keep the frame in sync once the video can finally decode/seek
    video.addEventListener("canplay", () => { seekBusy = false; applySeek(); });

    if (video.readyState >= 1 && video.duration) doBuild();
    else {
      video.addEventListener("loadedmetadata", doBuild, { once: true });
      setTimeout(doBuild, 1500);
    }
  }

  /* ---------------- generic coalesced video scrubber ---------------- */
  function makeVideoScrubber(video) {
    let targetT = 0;
    let seekBusy = false;
    const applySeek = () => {
      if (video.readyState < 1 || seekBusy) return;
      if (Math.abs(video.currentTime - targetT) < 0.012) return;
      seekBusy = true;
      try {
        if (video.fastSeek) video.fastSeek(targetT);
        else video.currentTime = targetT;
      } catch (e) { seekBusy = false; }
    };
    video.addEventListener("seeked", () => { seekBusy = false; applySeek(); });
    video.addEventListener("canplay", () => { seekBusy = false; applySeek(); });
    return (t) => { targetT = t; applySeek(); };
  }

  /* ---------------- Chapter 01: wheel stage ---------------- */
  function initWheel() {
    const stage = $("#wheelStage");
    const video = $("#wheelVideo");
    if (!stage || !video) return;

    if (REDUCED) {
      gsap.set('[data-wscene="a"]', { opacity: 1 });
      video.loop = true; video.play().catch(() => {});
      return;
    }

    video.pause();
    const seek = makeVideoScrubber(video);
    const proxy = { t: 0 };
    let dur = 12;

    const build = () => {
      dur = video.duration || dur;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: stage, start: "top top", end: "+=260%",
          pin: ".wheelstage__pin", scrub: 1,
        },
      });

      tl.fromTo(proxy, { t: 0 },
        { t: () => dur * 0.999, ease: "none", duration: 0.92,
          onUpdate: () => seek(proxy.t) }, 0);

      tl.fromTo('[data-wscene="a"]',
          { opacity: 0, x: 70, filter: "blur(12px)" },
          { opacity: 1, x: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.14 }, 0.06)
        .to('[data-wscene="a"]',
          { opacity: 0, x: -50, filter: "blur(10px)", ease: "power2.in", duration: 0.1 }, 0.42)
        .fromTo('[data-wscene="b"]',
          { opacity: 0, x: 70, filter: "blur(12px)" },
          { opacity: 1, x: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.14 }, 0.56);
    };

    if (video.readyState >= 1 && video.duration) build();
    else {
      let built = false;
      const doBuild = () => { if (built) return; built = true; build(); };
      video.addEventListener("loadedmetadata", doBuild, { once: true });
      setTimeout(doBuild, 1500);
    }
  }

  /* ---------------- Chapter 02: 430-frame canvas sequence ---------------- */
  function initSequence() {
    const stage = $("#seqStage");
    const canvas = $("#seqCanvas");
    if (!stage || !canvas) return;

    const COUNT = 430;
    const src = (i) =>
      "assets/frames/openpulse/openpulse_" + String(i + 1).padStart(4, "0") + ".webp";

    const ctx = canvas.getContext("2d");
    const imgs = new Array(COUNT);
    const loaded = new Array(COUNT).fill(false);
    let current = 0;

    const draw = (index) => {
      // nearest loaded frame to the requested one
      let i = index;
      if (!loaded[i]) {
        for (let d = 1; d < COUNT; d++) {
          if (loaded[i - d]) { i = i - d; break; }
          if (loaded[i + d]) { i = i + d; break; }
        }
        if (!loaded[i]) return;
      }
      const img = imgs[i];
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = canvas.clientWidth * dpr, H = canvas.clientHeight * dpr;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      // contain-fit, centered, slightly smaller than viewport
      const scale = Math.min(W / img.width, H / img.height) * 0.82;
      const w = img.width * scale, h = img.height * scale;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    };

    const load = (i, cb) => {
      if (imgs[i]) return;
      const im = new Image();
      im.onload = () => { loaded[i] = true; if (cb) cb(i); };
      im.src = src(i);
      imgs[i] = im;
    };

    // first frame immediately; the rest only once the Body chapter approaches
    // (saves ~11 MB on visits that never reach it — matters on mobile)
    load(0, () => draw(current));
    let loadingStarted = false;
    const startLoading = () => {
      if (loadingStarted) return;
      loadingStarted = true;
      for (let i = 6; i < COUNT; i += 6) load(i, (k) => { if (Math.abs(k - current) < 8) draw(current); });
      setTimeout(() => { for (let i = 0; i < COUNT; i++) load(i); }, 900);
    };
    ScrollTrigger.create({
      trigger: "#body", start: "top 250%", once: true, onEnter: startLoading,
    });
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Exploded view of the OpenPulse sensor puck, driven by scroll");

    window.addEventListener("resize", () => draw(current));

    if (REDUCED) {
      current = Math.floor(COUNT / 2);
      load(current, () => draw(current));
      gsap.set('[data-sscene="a"]', { opacity: 1 });
      return;
    }

    const proxy = { f: 0 };
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage, start: "top top", end: "+=340%",
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
      { sel: '[data-sscene="a"]', inAt: 0.02, outAt: 0.2 },   // assembled
      { sel: '[data-sscene="b"]', inAt: 0.28, outAt: 0.44 },  // exploding
      { sel: '[data-sscene="c"]', inAt: 0.5,  outAt: 0.66 },  // fully exploded
      { sel: '[data-sscene="d"]', inAt: 0.8,  outAt: null },  // reassembled
    ];
    scenes.forEach(({ sel, inAt, outAt }, n) => {
      const fromX = n % 2 === 0 ? 60 : -60; // matches alternating right/left layout
      tl.fromTo(sel,
        { opacity: 0, x: fromX, filter: "blur(12px)" },
        { opacity: 1, x: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.1 }, inAt);
      if (outAt !== null) {
        tl.to(sel,
          { opacity: 0, x: -fromX * 0.6, filter: "blur(10px)", ease: "power2.in", duration: 0.08 }, outAt);
      }
    });
  }

  /* ---------------- reveals ---------------- */
  function initReveals() {
    if (REDUCED) return;
    // explicit fromTo so start values never depend on CSS-transform parsing
    $$("[data-reveal]").forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 26, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" } });
    });
    $$("[data-line]").forEach((line) => {
      const inner = line.firstElementChild || line;
      gsap.fromTo(inner,
        { yPercent: 110 },
        { yPercent: 0, duration: 1.15, ease: "expo.out",
          scrollTrigger: { trigger: line, start: "top 90%" } });
    });
  }

  /* ---------------- ambient videos: play only while on screen ---------------- */
  function initAmbient() {
    const vids = $$("video[data-ambient]");
    if (!vids.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const v = en.target;
        if (en.isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    }, { threshold: 0.2 });
    vids.forEach((v) => io.observe(v));
  }

  /* ---------------- counters ---------------- */
  function initCounters() {
    $$("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const comma = el.dataset.comma === "1";
      const suffix = el.dataset.suffix || "";
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: "top 92%", once: true,
        onEnter: () => gsap.to(o, {
          v: target, duration: 1.8, ease: "power2.out",
          onUpdate: () => {
            const n = Math.round(o.v);
            el.textContent = (comma ? n.toLocaleString("en-US") : n) + suffix;
          },
        }),
      });
    });
  }

  /* ---------------- anchor smooth-scroll ---------------- */
  function initAnchors() {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const t = $(a.getAttribute("href"));
        if (!t) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(t, { duration: 1.4 });
        else t.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    const video = $("#heroVideo");

    // never let font loading block the intro
    await Promise.race([fontsReady(), wait(1200)]);

    // preloader stays until the video can be scrubbed (capped inside runPreloader)
    await runPreloader(videoReady(video));

    document.body.classList.remove("is-loading");
    gsap.to([".topbar", "main"], { opacity: 1, duration: 0.8, ease: "power2.out" });

    initHero();
    initWheel();
    initSequence();
    initReveals();
    initAmbient();
    initCounters();
    initAnchors();

    ScrollTrigger.refresh();
    window.addEventListener("load", () => ScrollTrigger.refresh());
  }

  // kick things off even if `load` already fired
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
