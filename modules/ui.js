// DOM controls and result panels.
import { vec } from './math.js';
import { MUSCLE_TYPES, TEETH, TOOTH_CENTERS, SCENARIOS, describeBite, toMM, fromMM, getArch } from './model.js';
import { renderSweepChart, renderTriangleChart } from './charts.js';

const $ = (id) => document.getElementById(id);
const fmt = (x, d = 0) => {
    const r = Number(x.toFixed(d));
    return (r === 0 ? 0 : r).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let S = null; // app state
let A = null; // actions
const linked = Object.fromEntries(MUSCLE_TYPES.map((t) => [t.key, true]));

export function initUI(state, actions) {
    S = state;
    A = actions;
    buildScenarios();
    buildMuscles();
    buildStepIndex();
    bindBite();
    bindGeometry();
    bindTabs();
    bindGlossary();
    bindSteps();

    $('btn-reset').addEventListener('click', () => A.reset());
    $('btn-theme').addEventListener('click', () => A.toggleTheme());
    $('btn-play').addEventListener('click', () => A.togglePlay());
    document.querySelectorAll('.seg [data-view]').forEach((b) => b.addEventListener('click', () => {
        document.querySelectorAll('.seg [data-view]').forEach((x) => x.classList.toggle('active', x === b));
        A.setView(b.dataset.view);
    }));
    document.querySelectorAll('.toggle[data-opt]').forEach((b) => b.addEventListener('click', () => {
        const on = !b.classList.contains('on');
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
        A.setViewOption(b.dataset.opt, on);
    }));
    $('vec-scale').addEventListener('input', (e) => A.setViewOption('scale', parseFloat(e.target.value)));
}

// ---------------- builders ----------------
function buildScenarios() {
    const nav = $('scenarios');
    nav.innerHTML = SCENARIOS.map((s) => `<button class="chip" data-sc="${s.id}" title="${esc(s.hint)}">${esc(s.label)}</button>`).join('');
    nav.addEventListener('click', (e) => {
        const b = e.target.closest('[data-sc]');
        if (!b) return;
        nav.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b));
        A.applyScenario(b.dataset.sc);
    });
}

export function clearScenario() {
    document.querySelectorAll('#scenarios .chip').forEach((c) => c.classList.remove('active'));
}

function buildMuscles() {
    const list = $('muscle-list');
    list.innerHTML = MUSCLE_TYPES.map((t) => `
        <div class="muscle-card" data-type="${t.key}" style="--mc:${t.color}">
            <div class="mc-head">
                <span class="mc-dot"></span>
                <strong>${t.name}</strong>
                <button class="icon-btn mc-link on" data-link="${t.key}" title="Enlazar lados izquierdo y derecho (simetría)" aria-pressed="true"><i class="fa-solid fa-link"></i></button>
            </div>
            <p class="mc-desc">${t.desc}</p>
            ${['L', 'R'].map((side) => `
            <div class="mc-side" data-id="${t.key}-${side}">
                <label class="switch" title="Activar/desactivar"><input type="checkbox" data-act><span></span></label>
                <span class="mc-side-name">${side === 'L' ? 'Izq.' : 'Der.'}</span>
                <input type="range" min="0" max="400" step="5" data-force aria-label="Fuerza ${t.name} ${side === 'L' ? 'izquierdo' : 'derecho'}">
                <output class="mc-val" data-out></output>
            </div>`).join('')}
            <details class="mc-coords">
                <summary>Inserción y origen (mm)</summary>
                <table class="coord-table">
                    <thead><tr><th></th><th>x</th><th>y</th><th>z</th></tr></thead>
                    <tbody>
                    ${['L', 'R'].map((side) => ['ins', 'ori'].map((kind) => `
                        <tr data-id="${t.key}-${side}" data-kind="${kind}">
                            <th>${kind === 'ins' ? 'Inserción' : 'Origen'} ${side === 'L' ? 'I' : 'D'}</th>
                            ${[0, 1, 2].map((i) => `<td><input type="number" step="1" data-axis="${i}"></td>`).join('')}
                        </tr>`).join('')).join('')}
                    </tbody>
                </table>
                <p class="hint">Coordenadas con la boca cerrada. La inserción se mueve con la mandíbula; el origen está fijo en el cráneo.</p>
            </details>
        </div>`).join('');

    list.addEventListener('input', (e) => {
        const row = e.target.closest('.mc-side');
        if (!row) return;
        const m = S.muscles.find((x) => x.id === row.dataset.id);
        if (e.target.matches('[data-force]')) setMuscle(m, { force: parseFloat(e.target.value) });
    });
    list.addEventListener('change', (e) => {
        const row = e.target.closest('.mc-side');
        if (row && e.target.matches('[data-act]')) {
            const m = S.muscles.find((x) => x.id === row.dataset.id);
            setMuscle(m, { active: e.target.checked });
            return;
        }
        const tr = e.target.closest('tr[data-kind]');
        if (tr && e.target.matches('input[type=number]')) {
            const m = S.muscles.find((x) => x.id === tr.dataset.id);
            const key = tr.dataset.kind === 'ins' ? 'insRef' : 'oriRef';
            const mm = toMM(m[key], S.geom);
            const v = parseFloat(e.target.value);
            if (!Number.isFinite(v)) return;
            mm[+e.target.dataset.axis] = v;
            const ref = fromMM(mm, S.geom);
            m[key] = ref;
            if (linked[m.type]) {
                const other = twin(m);
                other[key] = [-ref[0], ref[1], ref[2]];
            }
            A.changed();
        }
    });
    list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-link]');
        if (b) {
            const on = !linked[b.dataset.link];
            linked[b.dataset.link] = on;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', on);
            b.innerHTML = `<i class="fa-solid fa-${on ? 'link' : 'link-slash'}"></i>`;
            return;
        }
        const side = e.target.closest('.mc-side');
        if (side && !e.target.matches('input')) A.selectMuscle(side.dataset.id);
    });
}

const twin = (m) => S.muscles.find((x) => x.type === m.type && x.side !== m.side);

function setMuscle(m, patch) {
    Object.assign(m, patch);
    if (linked[m.type]) Object.assign(twin(m), patch);
    clearScenario();
    A.changed();
}

function buildStepIndex() {
    const idx = $('step-index');
    idx.innerHTML = [...document.querySelectorAll('.step')].map((s, i) =>
        `<button data-step="${s.id}"><b>${i}</b> ${s.dataset.title}</button>`).join('');
    idx.addEventListener('click', (e) => {
        const b = e.target.closest('[data-step]');
        if (b) $(b.dataset.step).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('muscle-chips').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mid]');
        if (b) A.selectMuscle(b.dataset.mid);
    });
}

function bindBite() {
    $('bite-t').addEventListener('input', (e) => {
        S.bite.t = parseFloat(e.target.value);
        S.bite.custom = false;
        clearScenario();
        A.changed();
    });
    $('bite-dir').addEventListener('change', (e) => {
        S.bite.dirMode = e.target.value;
        A.changed();
    });
    ['alpha', 'beta'].forEach((k) => $(`bite-${k}`).addEventListener('input', (e) => {
        S.bite[k] = parseFloat(e.target.value);
        A.changed();
    }));
    $('bite-custom').addEventListener('change', (e) => {
        S.bite.custom = e.target.checked;
        if (S.bite.custom) S.bite.point = getArch(S.geom).point(S.bite.t).map((v) => Math.round(v));
        A.changed();
    });
    ['x', 'y', 'z'].forEach((k, i) => $(`bite-${k}`).addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isFinite(v)) return;
        S.bite.point[i] = v;
        S.bite.custom = true;
        A.changed();
    }));
    $('theta').addEventListener('input', (e) => {
        S.theta = parseFloat(e.target.value);
        A.changed();
    });
    $('arch-picker').addEventListener('click', (e) => {
        const tooth = e.target.closest('[data-t]');
        if (tooth) {
            A.setBite(parseFloat(tooth.dataset.t));
            return;
        }
        const svg = e.target.closest('svg');
        if (!svg || !archView) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i <= 200; i++) {
            const t = -1 + i / 100;
            const q = archView.arch.point(t);
            const d = Math.hypot(q[0] - p.x, -q[1] - p.y);
            if (d < bestD) { bestD = d; best = t; }
        }
        if (bestD < 12) A.setBite(best);
    });
}

function bindGeometry() {
    $('geom-w').addEventListener('input', (e) => {
        S.geom.w = parseFloat(e.target.value) / 2;
        A.changed();
    });
    $('geom-L').addEventListener('input', (e) => {
        S.geom.L = parseFloat(e.target.value);
        A.changed();
    });
}

function bindTabs() {
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
}

export function showTab(name) {
    document.querySelectorAll('.tab').forEach((b) => {
        const on = b.dataset.tab === name;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
    A.tabChanged(name);
}

function bindGlossary() {
    document.addEventListener('click', (e) => {
        const a = e.target.closest('.gl[data-term]');
        if (!a) return;
        showTab('concepts');
        const el = $(a.dataset.term);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
    });
}

function bindSteps() {
    document.querySelectorAll('.step').forEach((s) => {
        s.addEventListener('mouseenter', () => A.focusStep(s.dataset.focus));
        s.addEventListener('mouseleave', () => A.focusStep(null));
    });
}

// ---------------- sync state -> controls ----------------
export function syncControls() {
    const g = S.geom;
    $('bite-t').value = S.bite.t;
    $('bite-t-out').textContent = S.bite.custom ? 'Personalizado' : describeBite(S.bite.t);
    $('bite-dir').value = S.bite.dirMode;
    $('bite-free').hidden = S.bite.dirMode !== 'free';
    ['alpha', 'beta'].forEach((k) => {
        $(`bite-${k}`).value = S.bite[k];
        $(`bite-${k}-out`).textContent = `${S.bite[k]}°`;
    });
    $('bite-custom').checked = S.bite.custom;
    const bp = S.bite.custom ? S.bite.point : getArch(g).point(S.bite.t);
    ['x', 'y', 'z'].forEach((k, i) => {
        const el = $(`bite-${k}`);
        if (document.activeElement !== el) el.value = Math.round(bp[i]);
    });
    $('theta').value = S.theta;
    $('theta-out').textContent = `${fmt(S.theta, 1)}°`;
    $('geom-w').value = g.w * 2;
    $('geom-w-out').textContent = `${fmt(g.w * 2)} mm`;
    $('geom-L').value = g.L;
    $('geom-L-out').textContent = `${fmt(g.L)} mm`;

    S.muscles.forEach((m) => {
        const row = document.querySelector(`.mc-side[data-id="${m.id}"]`);
        row.querySelector('[data-act]').checked = m.active;
        row.querySelector('[data-force]').value = m.force;
        row.querySelector('[data-force]').disabled = !m.active;
        row.querySelector('[data-out]').textContent = `${fmt(m.force)} N`;
        row.classList.toggle('off', !m.active);
        row.classList.toggle('selected', m.id === S.selectedMuscle);
        ['ins', 'ori'].forEach((kind) => {
            const mm = toMM(kind === 'ins' ? m.insRef : m.oriRef, g);
            document.querySelectorAll(`tr[data-id="${m.id}"][data-kind="${kind}"] input`).forEach((inp, i) => {
                if (document.activeElement !== inp) inp.value = Math.round(mm[i]);
            });
        });
    });

    $('muscle-chips').innerHTML = S.muscles.filter((m) => m.active && m.force > 0).map((m) =>
        `<button class="m-chip ${m.id === S.selectedMuscle ? 'active' : ''}" data-mid="${m.id}" style="--c:${m.color}">${m.tag}</button>`).join('');
}

// ---------------- arch picker (top view of the lower teeth) ----------------
let archView = null;
export function renderArchPicker(posed) {
    const el = $('arch-picker');
    const key = `${S.geom.w}|${S.geom.L}`;
    if (!archView || archView.key !== key) {
        const arch = posed.arch;
        const a = arch.a;
        const s = arch.s;
        const teeth = [];
        [-1, 1].forEach((sx) => TEETH.forEach((tooth, i) => {
            const t = sx * TOOTH_CENTERS[i];
            const p = arch.point(t);
            const tan = arch.tangent(t);
            const ang = (Math.atan2(-tan[1], tan[0]) * 180) / Math.PI;
            const md = tooth.md * arch.toothScale * 0.9;
            const bl = tooth.bl * s;
            teeth.push(`<rect class="tooth" data-t="${t.toFixed(4)}" x="${-md / 2}" y="${-bl / 2}" width="${md}" height="${bl}" rx="${Math.min(md, bl) * 0.35}"
                transform="translate(${p[0].toFixed(2)} ${(-p[1]).toFixed(2)}) rotate(${ang.toFixed(1)})"><title>${tooth.name} ${sx < 0 ? 'izquierdo' : 'derecho'}</title></rect>`);
        }));
        const path = [];
        for (let i = 0; i <= 80; i++) {
            const p = arch.point(-1 + i / 40);
            path.push(`${i ? 'L' : 'M'}${p[0].toFixed(1)},${(-p[1]).toFixed(1)}`);
        }
        const x0 = -a - 10;
        const y0 = -S.geom.L - 9;
        const vw = 2 * a + 20;
        const vh = S.geom.L - arch.ym + 18;
        el.innerHTML = `<svg viewBox="${x0} ${y0} ${vw} ${vh}" role="img" aria-label="Arcada inferior">
            <path class="arch-path" d="${path.join('')}"/>
            ${teeth.join('')}
            <circle class="arch-marker" r="3.2"/>
            <text class="arch-side" x="${x0 + 2}" y="${y0 + vh - 3}">izq.</text>
            <text class="arch-side" x="${x0 + vw - 2}" y="${y0 + vh - 3}" text-anchor="end">der.</text>
        </svg>`;
        archView = { key, arch };
    }
    const bp = S.bite.custom ? S.bite.point : posed.arch.point(S.bite.t);
    const mk = el.querySelector('.arch-marker');
    mk.setAttribute('cx', bp[0]);
    mk.setAttribute('cy', -bp[1]);
    let best = null;
    let bestD = 0.08;
    el.querySelectorAll('.tooth').forEach((r) => {
        const d = Math.abs(parseFloat(r.dataset.t) - S.bite.t);
        if (!S.bite.custom && d < bestD) { bestD = d; best = r; }
    });
    el.querySelectorAll('.tooth').forEach((r) => r.classList.toggle('active', r === best));
}

// ---------------- results ----------------
export function renderResults(posed, res, sweep, heavy) {
    const jl = vec.norm(res.FJL);
    const jr = vec.norm(res.FJR);
    $('kpi-fb').innerHTML = res.singular ? '—' : `${fmt(res.FB)}<small> N</small>`;
    $('kpi-fb-sub').textContent = S.bite.custom ? 'Punto personalizado' : describeBite(S.bite.t);
    $('kpi-ma').textContent = fmt(res.MA, 2);
    $('kpi-ma-sub').textContent = `ΣF músculos = ${fmt(res.sumForces)} N`;
    const joint = (el, sub, F, mag) => {
        $(el).innerHTML = `${fmt(mag)}<small> N</small>`;
        const bad = F[2] > 1e-6;
        $(sub).innerHTML = `<span class="badge ${bad ? 'bad' : 'ok'}">${bad ? 'distracción' : 'compresión'}</span> <span class="mono">[${F.map((v) => fmt(v)).join(', ')}]</span>`;
    };
    joint('kpi-jl', 'kpi-jl-sub', res.FJL, jl);
    joint('kpi-jr', 'kpi-jr-sub', res.FJR, jr);
    document.querySelector('.kpi-jl').classList.toggle('is-bad', res.distractionL);
    document.querySelector('.kpi-jr').classList.toggle('is-bad', res.distractionR);
    document.querySelector('.kpi-bite').classList.toggle('is-bad', res.noBite || res.singular);

    $('hud').innerHTML = `
        <div><span>F<sub>B</sub></span><b>${res.singular ? '—' : fmt(res.FB)} N</b></div>
        <div><span>VM</span><b>${fmt(res.MA, 2)}</b></div>
        <div class="${res.distractionL ? 'bad' : ''}"><span>ATM I</span><b>${fmt(jl)} N</b></div>
        <div class="${res.distractionR ? 'bad' : ''}"><span>ATM D</span><b>${fmt(jr)} N</b></div>
        <div><span>θ</span><b>${fmt(S.theta, 1)}°</b></div>`;

    renderAlerts(res);
    if (!heavy) return;

    renderSweepChart($('sweep-chart'), sweep, S.bite.custom ? null : S.bite.t, (t) => A.setBite(t));
    renderContrib(res);
    renderTriangleChart($('tri-chart-results'), res, posed);
}

function renderAlerts(res) {
    const out = [];
    if (res.muscles.length === 0) {
        out.push(['info', 'fa-circle-info', 'No hay músculos activos, así que no hay fuerzas que equilibrar.']);
    } else if (res.singular) {
        out.push(['bad', 'fa-ban', 'La línea de acción de la mordida corta el eje de bisagra: no produce momento en X y no puede equilibrar a los músculos. Cambia la dirección o el punto de mordida.']);
    } else if (res.noBite) {
        out.push(['bad', 'fa-triangle-exclamation', `<b>F<sub>B</sub> &lt; 0:</b> los músculos activos tienden a <i>abrir</i> la boca, así que el alimento tendría que tirar del diente. No hay mordida posible con esta activación.`]);
    }
    const sides = [res.distractionL && 'izquierda', res.distractionR && 'derecha'].filter(Boolean);
    if (sides.length && res.muscles.length && !res.singular) {
        out.push(['warn', 'fa-arrows-up-to-line', `<b>Distracción en la ATM ${sides.join(' y ')}:</b> la articulación tendría que tirar en lugar de empujar. La resultante muscular cae fuera del triángulo de soporte (paso 9). Prueba a reducir los músculos del lado contrario al diente.`]);
    }
    $('alerts').innerHTML = out.map(([k, icon, html]) => `<div class="alert ${k}"><i class="fa-solid ${icon}"></i><span>${html}</span></div>`).join('');
}

function renderContrib(res) {
    const el = $('contrib');
    if (!res.muscles.length) {
        el.innerHTML = '<p class="caption">Sin músculos activos.</p>';
        return;
    }
    const total = res.Tm[0];
    const maxAbs = Math.max(...res.muscles.map((m) => Math.abs(m.tau[0])), 1);
    const rows = [...res.muscles].sort((a, b) => b.tau[0] - a.tau[0]).map((m) => {
        const pct = total !== 0 ? (m.tau[0] / total) * 100 : 0;
        const wPct = (Math.abs(m.tau[0]) / maxAbs) * 100;
        return `<div class="contrib-row ${m.id === S.selectedMuscle ? 'selected' : ''}" data-mid="${m.id}" style="--c:${m.color}">
            <span class="contrib-name">${esc(m.name)}</span>
            <span class="contrib-bar"><i class="${m.tau[0] < 0 ? 'neg' : ''}" style="width:${wPct.toFixed(1)}%"></i></span>
            <span class="contrib-val mono">${fmt(m.force)} N × ${fmt(m.lever, 1)} mm</span>
            <span class="contrib-pct mono">${fmt(pct)} %</span>
        </div>`;
    }).join('');
    el.innerHTML = `${rows}<div class="contrib-total mono">T<sub>m,x</sub> = Σ F<sub>i</sub>·b<sub>i</sub> = ${fmt(total / 1000, 2)} N·m</div>`;
    el.onclick = (e) => {
        const r = e.target.closest('[data-mid]');
        if (r) A.selectMuscle(r.dataset.mid);
    };
}

export function flashMuscleCard(id) {
    const row = document.querySelector(`.mc-side[data-id="${id}"]`);
    if (!row) return;
    row.closest('.muscle-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
}

export function setPlayButton(playing) {
    $('btn-play').innerHTML = playing
        ? '<i class="fa-solid fa-pause"></i><span>Pausar</span>'
        : '<i class="fa-solid fa-play"></i><span>Animar apertura</span>';
    $('btn-play').classList.toggle('playing', playing);
}
