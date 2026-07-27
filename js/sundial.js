/* =========================================================================
   Sundial correction — apparent solar time → clock time.

     clock = dial + 4·(zoneMeridian − longitude) − EoT(date) + DST

   EoT uses the standard approximation:
     B   = 360/365 · (N − 81)          degrees
     EoT = 9.87·sin 2B − 7.53·cos B − 1.5·sin B     minutes
   which peaks near −14 min in mid-February and +16 min in early November.
   ========================================================================= */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const dDate = $("#dDate");
  if (!dDate) return;

  const dPlace = $("#dPlace"), dLon = $("#dLon"), dCustomWrap = $("#dCustomWrap");
  const oTotal = $("#dTotal"), oPhrase = $("#dPhrase");
  const oLon = $("#dLonOut"), oEot = $("#dEotOut"), oDst = $("#dDstOut");

  const dayOfYear = (d) =>
    Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

  function eot(date) {
    const B = ((2 * Math.PI) / 365) * (dayOfYear(date) - 81);
    return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  }

  // last Sunday of a month, UTC
  const lastSunday = (y, m) => {
    const d = new Date(Date.UTC(y, m + 1, 0));
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d;
  };

  function dstMinutes(date, rule) {
    const y = date.getFullYear();
    const t = Date.UTC(y, date.getMonth(), date.getDate());
    if (rule === "eu" || rule === "uk") {
      return t >= lastSunday(y, 2).getTime() && t < lastSunday(y, 9).getTime() ? 60 : 0;
    }
    if (rule === "us") {
      // second Sunday in March → first Sunday in November
      const mar = new Date(Date.UTC(y, 2, 1));
      mar.setUTCDate(1 + ((7 - mar.getUTCDay()) % 7) + 7);
      const nov = new Date(Date.UTC(y, 10, 1));
      nov.setUTCDate(1 + ((7 - nov.getUTCDay()) % 7));
      return t >= mar.getTime() && t < nov.getTime() ? 60 : 0;
    }
    return 0;
  }

  const fmt = (m) => (m >= 0 ? "+" : "−") + Math.abs(m).toFixed(1) + " min";

  function currentPlace() {
    if (dPlace.value === "custom") {
      return { lon: parseFloat(dLon.value) || 0, meridian: Math.round((parseFloat(dLon.value) || 0) / 15) * 15, rule: "eu" };
    }
    const [lon, meridian, rule] = dPlace.value.split("|");
    return { lon: parseFloat(lon), meridian: parseFloat(meridian), rule };
  }

  function update() {
    const date = dDate.valueAsDate || new Date();
    const { lon, meridian, rule } = currentPlace();

    const lonCorr = 4 * (meridian - lon);
    const e = eot(date);
    const dst = dstMinutes(date, rule);
    const total = lonCorr - e + dst;

    oLon.textContent = fmt(lonCorr);
    oEot.textContent = fmt(-e);
    oDst.textContent = dst ? "+60.0 min" : "none";

    const mins = Math.abs(total);
    const h = Math.floor(mins / 60), m = mins % 60;
    oTotal.innerHTML =
      (total >= 0 ? "+" : "−") +
      (h ? h + "<small>h</small> " + Math.round(m) + "<small>min</small>"
         : m.toFixed(0) + "<small>min</small>");
    oPhrase.textContent =
      total >= 0
        ? "Add this to the dial to get clock time"
        : "The dial runs ahead — subtract this";

    drawMarker(date);
  }

  /* ---------- equation-of-time chart ---------- */
  const svg = $("#eotChart");
  const W = 900, H = 260, PADL = 46, PADR = 16, PADT = 22, PADB = 34;
  const x = (n) => PADL + (n / 365) * (W - PADL - PADR);
  const y = (v) => PADT + ((18 - v) / 36) * (H - PADT - PADB);
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };

  function drawChart() {
    if (!svg) return;
    svg.textContent = "";
    // zero line + gridlines
    [-15, 0, 15].forEach((v) => {
      svg.appendChild(el("line", { class: "ax", x1: PADL, x2: W - PADR, y1: y(v), y2: y(v),
        "stroke-dasharray": v === 0 ? "" : "2 4" }));
      const t = el("text", { x: 6, y: y(v) + 3 });
      t.textContent = (v > 0 ? "+" : "") + v + "m";
      svg.appendChild(t);
    });
    // months
    const months = ["J","F","M","A","M","J","J","A","S","O","N","D"];
    months.forEach((mn, i) => {
      const n = new Date(2026, i, 1);
      const d = dayOfYear(n);
      const t = el("text", { x: x(d), y: H - 10, "text-anchor": "middle" });
      t.textContent = mn;
      svg.appendChild(t);
    });
    // curve
    let d = "";
    for (let n = 1; n <= 365; n++) {
      const B = ((2 * Math.PI) / 365) * (n - 81);
      const v = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
      d += (n === 1 ? "M" : "L") + x(n).toFixed(1) + " " + y(v).toFixed(1);
    }
    svg.appendChild(el("path", { class: "curve", d }));
    svg.appendChild(el("circle", { class: "mark", id: "eotMark", r: 4, cx: -10, cy: -10 }));
    const lbl = el("text", { id: "eotLbl", x: -100, y: 0, "text-anchor": "middle" });
    lbl.setAttribute("fill", "#f4f5f7");
    svg.appendChild(lbl);
  }

  function drawMarker(date) {
    const mark = document.querySelector("#eotMark"), lbl = document.querySelector("#eotLbl");
    if (!mark) return;
    const n = dayOfYear(date), v = eot(date);
    mark.setAttribute("cx", x(n)); mark.setAttribute("cy", y(v));
    lbl.setAttribute("x", Math.min(Math.max(x(n), PADL + 26), W - PADR - 26));
    lbl.setAttribute("y", y(v) - 12);
    lbl.textContent = (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + " min";
  }

  dPlace.addEventListener("change", () => {
    dCustomWrap.hidden = dPlace.value !== "custom";
    update();
  });
  dLon.addEventListener("input", update);
  dDate.addEventListener("input", update);

  dDate.valueAsDate = new Date();
  drawChart();
  update();
})();
