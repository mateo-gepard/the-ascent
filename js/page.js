/* =========================================================================
   PROJECT PAGES — reveals, plates, ambient video, progress
   ========================================================================= */
(function () {
  "use strict";
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COMPACT = window.matchMedia("(max-width: 680px), (max-height: 680px)").matches;
  const COARSE = window.matchMedia("(pointer: coarse)").matches;
  const SAVE_DATA = Boolean(navigator.connection && navigator.connection.saveData);
  const LIGHTWEIGHT = COMPACT || COARSE;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const armWillChange = (el, value) => { el.style.willChange = value; };
  const releaseWillChange = (el) => { el.style.willChange = "auto"; };

  function reveals() {
    if (REDUCED) {
      $$("[data-reveal]").forEach((el) => {
        gsap.set(el, { opacity: 1, y: 0, filter: "none" });
        releaseWillChange(el);
      });
      $$("[data-line]").forEach((line) => {
        const inner = line.firstElementChild || line;
        gsap.set(inner, { yPercent: 0 });
        releaseWillChange(inner);
      });
      return;
    }

    $$("[data-reveal]").forEach((el) => {
      // Do not promote every off-screen reveal to its own layer indefinitely.
      releaseWillChange(el);
      gsap.fromTo(el,
        {
          opacity: 0,
          y: LIGHTWEIGHT ? 12 : 24,
          filter: LIGHTWEIGHT ? "none" : "blur(6px)",
        },
        {
          opacity: 1,
          y: 0,
          filter: "none",
          duration: LIGHTWEIGHT ? 0.52 : 1,
          ease: LIGHTWEIGHT ? "power2.out" : "power3.out",
          onStart: () => armWillChange(el, LIGHTWEIGHT ? "transform, opacity" : "transform, opacity, filter"),
          onComplete: () => releaseWillChange(el),
          scrollTrigger: { trigger: el, start: "top 90%" },
        });
    });
    $$("[data-line]").forEach((line) => {
      const inner = line.firstElementChild || line;
      releaseWillChange(inner);
      const tween = {
        yPercent: 0,
        duration: LIGHTWEIGHT ? 0.62 : 1.1,
        ease: LIGHTWEIGHT ? "power3.out" : "expo.out",
        onStart: () => armWillChange(inner, "transform"),
        onComplete: () => releaseWillChange(inner),
      };
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
    if (REDUCED) {
      $$(".plate__frame, .wcard__media").forEach((frame) => {
        gsap.set(frame, { clipPath: "inset(0 0 0% 0)" });
        releaseWillChange(frame);
        const media = frame.querySelector("img, video");
        if (media) {
          gsap.set(media, { scale: 1 });
          releaseWillChange(media);
        }
      });
      return;
    }
    $$(".plate__frame, .wcard__media").forEach((frame) => {
      const media = frame.querySelector("img, video");
      const tl = gsap.timeline({ scrollTrigger: { trigger: frame, start: "top 88%" } });
      releaseWillChange(frame);
      if (media) releaseWillChange(media);
      tl.fromTo(frame, { clipPath: "inset(0 0 100% 0)" },
        {
          clipPath: "inset(0 0 0% 0)",
          duration: LIGHTWEIGHT ? 0.58 : 1,
          ease: "power3.inOut",
          onStart: () => armWillChange(frame, "clip-path"),
          onComplete: () => releaseWillChange(frame),
        }, 0);
      if (media) {
        tl.fromTo(media, { scale: LIGHTWEIGHT ? 1.05 : 1.14 }, {
          scale: 1,
          duration: LIGHTWEIGHT ? 0.8 : 1.5,
          ease: "power2.out",
          onStart: () => armWillChange(media, "transform"),
          onComplete: () => releaseWillChange(media),
        }, 0);
      }
    });
  }

  function ambient() {
    const vids = $$("video[data-ambient]");
    if (!vids.length) return;
    if (REDUCED || SAVE_DATA) {
      vids.forEach((v) => {
        v.autoplay = false;
        v.removeAttribute("autoplay");
        v.pause();
      });
      return;
    }
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
