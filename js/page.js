/* =========================================================================
   PROJECT PAGES — reveals, plates, ambient video, progress
   ========================================================================= */
(function () {
  "use strict";
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  function reveals() {
    if (REDUCED) { gsap.set("[data-reveal]", { opacity: 1, y: 0, filter: "none" }); return; }
    $$("[data-reveal]").forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 24, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 90%" } });
    });
    $$("[data-line]").forEach((line) => {
      const inner = line.firstElementChild || line;
      const tween = { yPercent: 0, duration: 1.1, ease: "expo.out" };
      // Mastheads are already in view at scroll position zero. Running their
      // reveal directly avoids ScrollTrigger leaving the clipped title below
      // its mask when the trigger starts above the viewport.
      if (line.classList.contains("phead__title")) {
        gsap.fromTo(inner, { yPercent: 110 }, tween);
      } else {
        gsap.fromTo(inner, { yPercent: 110 }, {
          ...tween,
          scrollTrigger: { trigger: line, start: "top 92%" },
        });
      }
    });
  }

  function plates() {
    if (REDUCED) return;
    $$(".plate__frame, .wcard__media").forEach((frame) => {
      const media = frame.querySelector("img, video");
      const tl = gsap.timeline({ scrollTrigger: { trigger: frame, start: "top 88%" } });
      tl.fromTo(frame, { clipPath: "inset(0 0 100% 0)" },
        { clipPath: "inset(0 0 0% 0)", duration: 1, ease: "power3.inOut" }, 0);
      if (media) tl.fromTo(media, { scale: 1.14 }, { scale: 1, duration: 1.5, ease: "power2.out" }, 0);
    });
  }

  function ambient() {
    const vids = $$("video[data-ambient]");
    if (!vids.length) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { if (v.preload === "none") v.preload = "auto"; v.play().catch(() => {}); }
      else v.pause();
    }), { threshold: 0.15 });
    vids.forEach((v) => io.observe(v));
  }

  function progress() {
    const bar = $("#progressBar");
    if (!bar) return;
    ScrollTrigger.create({
      start: 0, end: () => ScrollTrigger.maxScroll(window) - 2,
      onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
    });
  }

  function refreshGuard() {
    let t;
    const req = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 250); };
    $$('img[loading="lazy"]').forEach((im) => { if (!im.complete) im.addEventListener("load", req, { once: true }); });
    window.addEventListener("load", req);
  }

  function boot() { reveals(); plates(); ambient(); progress(); refreshGuard(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
