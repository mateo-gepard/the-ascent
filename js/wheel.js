/* =========================================================================
   MAGMA wheel — pinned, scroll-scrubbed video with two text scenes
   ========================================================================= */
(function () {
  "use strict";
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  const stage = document.querySelector("#wheelStage");
  const video = document.querySelector("#wheelVideo");
  if (!stage || !video) return;

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOBILE = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const COMPACT = window.matchMedia("(max-width: 600px), (max-height: 700px)").matches;
  const SAVE_DATA = Boolean(navigator.connection && navigator.connection.saveData);
  if (!SAVE_DATA && !REDUCED) video.preload = "auto";
  if (REDUCED || SAVE_DATA) {
    video.autoplay = false;
    video.loop = false;
    video.preload = "none";
    video.removeAttribute("autoplay");
    video.pause();
    gsap.set("[data-wscene]", { opacity: 0, x: 0, filter: "none" });
    gsap.set('[data-wscene="a"]', { opacity: 1 });
    return;
  }

  // coalesced seeking — never queue a seek while one is in flight
  let targetT = 0, seekBusy = false;
  const seekThreshold = MOBILE ? 0.035 : 0.012;
  const applySeek = () => {
    if (video.readyState < 1 || seekBusy) return;
    if (Math.abs(video.currentTime - targetT) < seekThreshold) return;
    seekBusy = true;
    try { video.fastSeek ? video.fastSeek(targetT) : (video.currentTime = targetT); }
    catch (e) { seekBusy = false; }
  };
  video.addEventListener("seeked", () => { seekBusy = false; applySeek(); });
  video.addEventListener("canplay", () => { seekBusy = false; applySeek(); });

  video.pause();
  const proxy = { t: 0 };
  let dur = 12, built = false;

  function build() {
    if (built) return;
    built = true;
    dur = video.duration || dur;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage, start: "top top",
        end: () => {
          const compact = COMPACT || window.innerWidth <= 600;
          return "+=" + Math.round(Math.max(window.innerHeight, compact ? 520 : 600) * (compact ? 1.75 : 2.6));
        },
        pin: ".wheelstage__pin", scrub: 1,
      },
    });

    tl.fromTo(proxy, { t: 0 },
      { t: () => dur * 0.999, ease: "none", duration: 0.92,
        onUpdate: () => { targetT = proxy.t; applySeek(); } }, 0);

    const enterX = MOBILE ? 28 : 70;
    const exitX = MOBILE ? -20 : -50;
    const enterBlur = MOBILE ? "none" : "blur(12px)";
    const exitBlur = MOBILE ? "none" : "blur(10px)";
    tl.fromTo('[data-wscene="a"]',
        { opacity: 0, x: enterX, filter: enterBlur },
        { opacity: 1, x: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.14 }, 0.06)
      .to('[data-wscene="a"]',
        { opacity: 0, x: exitX, filter: exitBlur, ease: "power2.in", duration: 0.1 }, 0.42)
      .fromTo('[data-wscene="b"]',
        { opacity: 0, x: enterX, filter: enterBlur },
        { opacity: 1, x: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.14 }, 0.56);

    if (!video.duration) {
      video.addEventListener("loadedmetadata", () => { dur = video.duration || dur; tl.invalidate(); }, { once: true });
    }
    ScrollTrigger.refresh();
  }

  if (video.readyState >= 1 && video.duration) build();
  else { video.addEventListener("loadedmetadata", build, { once: true }); setTimeout(build, 1500); }
})();
