/* =========================================================================
   MATEO MAMALADZE — full-screen scrubbed video + fly-in scenes
   ========================================================================= */
(function () {
  "use strict";

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COMPACT = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const SAVE_DATA = Boolean(navigator.connection && navigator.connection.saveData);
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const heroVideo = $("#heroVideo");
  const heroMedia = $(".hero__media");
  if (heroVideo && REDUCED) {
    heroVideo.poster = "assets/hero-final.jpg";
    if (heroMedia) heroMedia.style.backgroundImage = 'url("assets/hero-final.jpg")';
  } else if (heroVideo && !SAVE_DATA) {
    heroVideo.preload = "auto";
  }

  // Mobile Safari can replace a valid poster with a black video surface after
  // metadata loads but before it has actually painted a frame. Keep the
  // independent background image visible until the browser reports a rendered
  // frame; if decoding is delayed or blocked, the fallback simply stays put.
  function revealHeroVideoWhenPainted(video) {
    if (!video || REDUCED || SAVE_DATA) return;
    let queued = false;
    const reveal = () => {
      queued = false;
      video.classList.add("is-frame-ready");
    };
    const queueReveal = () => {
      if (queued || video.classList.contains("is-frame-ready") || video.readyState < 2) return;
      queued = true;
      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(reveal);
      } else {
        requestAnimationFrame(() => requestAnimationFrame(reveal));
      }
    };
    video.addEventListener("loadeddata", queueReveal);
    video.addEventListener("canplay", queueReveal);
    video.addEventListener("seeked", queueReveal);
    queueReveal();
  }
  revealHeroVideoWhenPainted(heroVideo);

  // The loader visually covers the site, so keep its links out of the tab order
  // until the page is actually available.
  [$(".topbar"), $("main")].forEach((el) => { if (el) el.inert = true; });

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

    if (document.hidden || REDUCED || SAVE_DATA) {
      return Promise.race([ready, wait(COMPACT ? 250 : 800)]).then(finishInstant);
    }

    const crawl = gsap.to(state, {
      p: COMPACT ? 88 : 92,
      duration: COMPACT ? 0.65 : 2.6,
      ease: "power1.out",
      onUpdate: paint,
    });

    return Promise.race([ready, wait(COMPACT ? 850 : 4000)]).then(() => {
      crawl.kill();
      if (document.hidden) return finishInstant(); // tab was backgrounded mid-load
      return new Promise((resolve) => {
        const tl = gsap.timeline({ onComplete: resolve })
          .to(state, { p: 100, duration: COMPACT ? 0.16 : 0.45, ease: "power2.out", onUpdate: paint })
          .to("#loader", { autoAlpha: 0, duration: COMPACT ? 0.24 : 0.7, ease: "power2.inOut" }, COMPACT ? "+=0.03" : "+=0.12")
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

    if (REDUCED || SAVE_DATA) {
      // Static mode: reduced motion gets the final portrait; Save Data keeps
      // the lightweight opening poster and skips the video download entirely.
      gsap.set(".scene", { opacity: 0 });
      gsap.set(REDUCED ? '[data-scene="c"]' : '[data-scene="a"]', { opacity: 1 });
      video.pause();
      return;
    }

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

      const compactHero = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          // function-based px distance: constant across refreshes.
          // (%-based ends re-measure against the inflated pin spacer and compound)
          end: () => "+=" + Math.round(Math.max(window.innerHeight, 600) * (compactHero ? 2.7 : 3.8)),
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
        { yPercent: compactHero ? 78 : 120, opacity: 0, filter: `blur(${compactHero ? 9 : 16}px)` },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", ease: "power3.out", duration: 0.09, stagger: 0.015 }, 0.035)
        .to('[data-scene="a"] .ln',
        { yPercent: compactHero ? -34 : -60, opacity: 0, filter: `blur(${compactHero ? 8 : 14}px)`, ease: "power2.in", duration: 0.08, stagger: 0.012 }, 0.24)
        .set('[data-scene="a"]', { opacity: 0 }, 0.335);

      // ---- Scene B · centered role (just before he appears) ----
      tl.fromTo('[data-scene="b"]',
        { opacity: 0, y: compactHero ? 26 : 44, filter: `blur(${compactHero ? 8 : 14}px)` },
        { opacity: 1, y: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.09 }, 0.30)
        .to('[data-scene="b"]',
        { opacity: 0, y: compactHero ? -22 : -36, filter: `blur(${compactHero ? 7 : 12}px)`, ease: "power2.in", duration: 0.08 }, 0.51);

      // ---- Scene C · flies in from the LEFT when he enters, stays clear of him ----
      tl.set('[data-scene="c"]', { opacity: 1 }, 0.58)
        .fromTo('[data-scene="c"] .scene__eyebrow',
          { x: compactHero ? -34 : -60, opacity: 0, filter: `blur(${compactHero ? 6 : 10}px)` },
          { x: 0, opacity: 1, filter: "blur(0px)", ease: "power3.out", duration: 0.1 }, 0.59)
        .fromTo('[data-scene="c"] .scene__statement .ln',
          { x: compactHero ? -42 : -80, opacity: 0, filter: `blur(${compactHero ? 8 : 14}px)` },
          { x: 0, opacity: 1, filter: "blur(0px)", ease: "power3.out", duration: 0.14, stagger: 0.035 }, 0.61);

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
          trigger: stage, start: "top top",
          end: () => "+=" + Math.round(Math.max(window.innerHeight, 600) * 2.6),
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
    const compactReveal = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
    // explicit fromTo so start values never depend on CSS-transform parsing
    $$("[data-reveal]").forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: compactReveal ? 12 : 26, filter: compactReveal ? "none" : "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          filter: "none",
          duration: compactReveal ? 0.68 : 1.1,
          ease: "power3.out",
          clearProps: "willChange",
          scrollTrigger: { trigger: el, start: compactReveal ? "top 94%" : "top 88%" },
        });
    });
    $$("[data-line]").forEach((line) => {
      const inner = line.firstElementChild || line;
      gsap.fromTo(inner,
        { yPercent: 110 },
        { yPercent: 0, duration: 1.15, ease: "expo.out",
          scrollTrigger: { trigger: line, start: "top 90%" } });
    });
  }

  /* ---------------- plate reveals: clip-wipe + settle-scale ---------------- */
  function initPlates() {
    if (REDUCED) return;
    $$(".plate__frame").forEach((frame) => {
      // the pinned wheel plate is choreographed by its own stage
      if (frame.closest(".wheelstage")) return;
      const media = frame.querySelector("img, video");
      const tl = gsap.timeline({
        scrollTrigger: { trigger: frame, start: "top 86%" },
      });
      tl.fromTo(frame,
        { clipPath: "inset(0 0 100% 0)" },
        { clipPath: "inset(0 0 0% 0)", duration: 1.05, ease: "power3.inOut" }, 0);
      if (media) {
        tl.fromTo(media,
          { scale: 1.16 },
          { scale: 1, duration: 1.6, ease: "power2.out" }, 0);
      }
    });
  }

  /* ---------------- stale-trigger guard: lazy media changes heights ---------------- */
  function initRefreshGuards() {
    let t;
    const req = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 250); };
    $$('img[loading="lazy"]').forEach((im) => {
      if (!im.complete) im.addEventListener("load", req, { once: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) req();
    });
  }

  /* ---------------- the thread: progress line + chapter label ---------------- */
  function initThread() {
    const bar = $("#progressBar");
    const label = $("#topLabel");
    if (bar) {
      ScrollTrigger.create({
        start: 0,
        end: () => ScrollTrigger.maxScroll(window) - 2,
        onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
      });
    }
    if (!label) return;
    const map = [
      ["#hero", "Munich"],
      ["#intro", "Munich"],
      ["#work", "Selected work"],
      ["#common", "What these have in common"],
      ["#contact", "Contact"],
    ];
    let current = label.textContent;
    const setLabel = (t) => {
      if (t === current) return;
      current = t;
      gsap.to(label, {
        opacity: 0, duration: 0.18, ease: "power1.in",
        onComplete: () => {
          label.textContent = t;
          gsap.to(label, { opacity: 1, duration: 0.25, ease: "power1.out" });
        },
      });
    };
    map.forEach(([sel, text]) => {
      const el = $(sel);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el, start: "top 50%", end: "bottom 50%",
        onToggle: (self) => { if (self.isActive) setLabel(text); },
      });
    });
  }

  /* ---------------- ambient videos: play only while on screen ---------------- */
  function initAmbient() {
    const vids = $$("video[data-ambient]");
    if (!vids.length) return;
    if (REDUCED || SAVE_DATA) {
      vids.forEach((video) => video.pause());
      return;
    }
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
        else t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
      });
    });
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    const video = $("#heroVideo");

    // never let font loading block the intro
    await Promise.race([fontsReady(), wait(COMPACT ? 450 : 1200)]);

    // preloader stays until the video can be scrubbed (capped inside runPreloader)
    await runPreloader((REDUCED || SAVE_DATA) ? Promise.resolve() : videoReady(video));

    document.body.classList.remove("is-loading");
    [$(".topbar"), $("main")].forEach((el) => { if (el) el.inert = false; });
    gsap.to([".topbar", "main"], { opacity: 1, duration: 0.8, ease: "power2.out" });

    initHero();
    initWheel();
    initSequence();
    initReveals();
    initPlates();
    initAmbient();
    initCounters();
    initAnchors();
    initThread();
    initRefreshGuards();

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
