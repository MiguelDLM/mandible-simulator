// Lightweight SVG charts (no dependencies). Colours come from CSS classes so both themes work.
import { TOOTH_CENTERS } from './model.js';
import { rotateOpen } from './math.js';
import { t } from './i18n.js';

/**
 * Bite force and joint loads as the bite point travels along the dental arch.
 * @param {HTMLElement} el
 * @param {{t:number, FB:number, JL:number, JR:number, bad:boolean}[]} data
 * @param {number|null} current - current bite position t (null when a custom point is used)
 * @param {(t:number)=>void} onPick
 */
export function renderSweepChart(el, data, current, onPick) {
    const W = 360;
    const H = 200;
    const m = { l: 40, r: 10, t: 12, b: 34 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const maxV = Math.max(50, ...data.map((d) => Math.max(d.FB, d.JL, d.JR)));
    const step = niceStep(maxV / 4);
    const yMax = Math.ceil((maxV * 1.05) / step) * step;
    const X = (t) => m.l + ((t + 1) / 2) * iw;
    const Y = (v) => m.t + ih - (Math.max(0, v) / yMax) * ih;

    const line = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${X(d.t).toFixed(1)},${Y(d[key]).toFixed(1)}`).join('');

    // Shaded ranges where the configuration is not physically admissible
    let bands = '';
    let start = null;
    data.forEach((d, i) => {
        if (d.bad && start === null) start = d.t;
        if ((!d.bad || i === data.length - 1) && start !== null) {
            const end = d.bad ? d.t : data[i - 1].t;
            bands += `<rect class="c-band" x="${X(start)}" y="${m.t}" width="${Math.max(2, X(end) - X(start))}" height="${ih}"/>`;
            start = null;
        }
    });

    let grid = '';
    for (let v = 0; v <= yMax + 1e-9; v += step) {
        grid += `<line class="c-grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`;
        grid += `<text class="c-tick" x="${m.l - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}</text>`;
    }
    const ticks = [
        [-TOOTH_CENTERS[5], `M1 ${t('chart.tick.L')}`], [-TOOTH_CENTERS[2], `${t('chart.tick.C')} ${t('chart.tick.L')}`], [0, t('chart.tick.inc')],
        [TOOTH_CENTERS[2], `${t('chart.tick.C')} ${t('chart.tick.R')}`], [TOOTH_CENTERS[5], `M1 ${t('chart.tick.R')}`]
    ];
    let xt = '';
    ticks.forEach(([t, label]) => {
        xt += `<line class="c-grid c-grid-v" x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ih}"/>`;
        xt += `<text class="c-tick" x="${X(t)}" y="${H - m.b + 14}" text-anchor="middle">${label}</text>`;
    });

    let cur = '';
    if (current !== null && current !== undefined) {
        const d = data.reduce((a, b) => (Math.abs(b.t - current) < Math.abs(a.t - current) ? b : a));
        cur = `<line class="c-cursor" x1="${X(current)}" x2="${X(current)}" y1="${m.t}" y2="${m.t + ih}"/>
            <circle class="c-dot c-bite" cx="${X(current)}" cy="${Y(d.FB)}" r="4"/>
            <circle class="c-dot c-jl" cx="${X(current)}" cy="${Y(d.JL)}" r="3.5"/>
            <circle class="c-dot c-jr" cx="${X(current)}" cy="${Y(d.JR)}" r="3.5"/>`;
    }

    el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${t('chart.sweep.aria')}">
      ${bands}${grid}${xt}
      <text class="c-axis" x="${m.l - 30}" y="${m.t - 2}">N</text>
      <text class="c-axis" x="${W - m.r}" y="${H - 4}" text-anchor="end">${t('chart.sweep.axis')}</text>
      <path class="c-line c-jl" d="${line('JL')}"/>
      <path class="c-line c-jr" d="${line('JR')}"/>
      <path class="c-line c-bite" d="${line('FB')}"/>
      ${cur}
      <rect class="c-hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/>
    </svg>`;

    const hit = el.querySelector('.c-hit');
    hit.addEventListener('click', (e) => {
        const r = hit.getBoundingClientRect();
        const t = ((e.clientX - r.left) / r.width) * 2 - 1;
        onPick(Math.max(-1, Math.min(1, t)));
    });
}

/**
 * Top (occlusal) view of Greaves' support triangle.
 * @param {HTMLElement} el
 * @param {object} res - solver output
 * @param {object} posed - posed model (arch, rB)
 */
export function renderTriangleChart(el, res, posed) {
    const w = res.w;
    const L = posed.L;
    const pad = 16;
    const xMin = -w - pad;
    const xMax = w + pad;
    const yMin = -pad - 6;
    const yMax = L + pad;
    const W = 360;
    const H = Math.round((W * (yMax - yMin)) / (xMax - xMin));
    const X = (x) => ((x - xMin) / (xMax - xMin)) * W;
    const Y = (y) => H - ((y - yMin) / (yMax - yMin)) * H;

    const archPts = [];
    for (let i = 0; i <= 60; i++) {
        const p = rotateOpen(posed.arch.point(-1 + i / 30), posed.theta);
        archPts.push(`${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`);
    }
    const B = [res.rB[0], res.rB[1]];
    const inside = !res.distractionL && !res.distractionR && !res.noBite;
    const tri = `${X(-w)},${Y(0)} ${X(w)},${Y(0)} ${X(B[0])},${Y(B[1])}`;
    let mEl = '';
    let lambdas = '';
    if (res.M && res.bary) {
        const [lL, lR, lB] = res.bary;
        const lbl = (v) => `<tspan class="${v < 0 ? 'neg' : ''}">${v.toFixed(2)}</tspan>`;
        mEl = `<circle class="t-m" cx="${X(res.M[0])}" cy="${Y(res.M[1])}" r="5"/>
            <text class="t-label t-mlabel" x="${X(res.M[0]) + 8}" y="${Y(res.M[1]) + 4}">M</text>`;
        lambdas = `<text class="t-lambda" x="${X(-w)}" y="${Y(0) + 26}" text-anchor="middle">λ<tspan dy="3" font-size="8">${t('sub.L')}</tspan><tspan dy="-3"> = </tspan>${lbl(lL)}</text>
            <text class="t-lambda" x="${X(w)}" y="${Y(0) + 26}" text-anchor="middle">λ<tspan dy="3" font-size="8">${t('sub.R')}</tspan><tspan dy="-3"> = </tspan>${lbl(lR)}</text>
            <text class="t-lambda" x="${X(B[0])}" y="${Y(B[1]) - 12}" text-anchor="middle">λ<tspan dy="3" font-size="8">B</tspan><tspan dy="-3"> = </tspan>${lbl(lB)}</text>`;
    }
    el.innerHTML = `
    <svg viewBox="0 -4 ${W} ${H + 36}" class="chart chart-tri" role="img" aria-label="${t('chart.tri.aria')}">
      <polyline class="t-arch" points="${archPts.join(' ')}"/>
      <line class="t-hinge" x1="${X(-w - 10)}" x2="${X(w + 10)}" y1="${Y(0)}" y2="${Y(0)}"/>
      <polygon class="t-tri ${inside ? 'ok' : 'bad'}" points="${tri}"/>
      <circle class="t-jl" cx="${X(-w)}" cy="${Y(0)}" r="6"/>
      <circle class="t-jr" cx="${X(w)}" cy="${Y(0)}" r="6"/>
      <circle class="t-bite" cx="${X(B[0])}" cy="${Y(B[1])}" r="5.5"/>
      ${mEl}
      ${lambdas}
      <text class="t-label" x="${X(-w)}" y="${Y(0) + 13}" text-anchor="middle">${t('jointShort.L')}</text>
      <text class="t-label" x="${X(w)}" y="${Y(0) + 13}" text-anchor="middle">${t('jointShort.R')}</text>
      <text class="t-dir" x="${W / 2}" y="6" text-anchor="middle">${t('chart.anterior')}</text>
      <text class="t-dir" x="4" y="${H + 30}">${t('chart.left')}</text>
      <text class="t-dir" x="${W - 4}" y="${H + 30}" text-anchor="end">${t('chart.right')}</text>
    </svg>`;
}

function niceStep(x) {
    const p = 10 ** Math.floor(Math.log10(x));
    const n = x / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
