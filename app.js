// Application entry point: state, render loop and wiring between model, viewer and UI.
/* global renderMathInElement */
import { vec } from './modules/math.js';
import { createMuscles, localizeMuscles, solveState, sweepArch, SCENARIOS, describeBite, toothName } from './modules/model.js';
import { t, setLang, applyStatic } from './modules/i18n.js';
import { JawViewer } from './modules/viewer.js';
import { renderSteps } from './modules/steps.js';
import { renderTriangleChart } from './modules/charts.js';
import {
    initUI, localizeUI, syncControls, renderResults, renderArchPicker, showTab, flashMuscleCard, setPlayButton, clearScenario
} from './modules/ui.js';

const defaultState = () => ({
    geom: { w: 50, L: 95 },          // w = half intercondylar width, L = hinge-to-incisor distance (mm)
    theta: 0,                         // mouth opening (degrees)
    bite: { t: 0, custom: false, point: [0, 95, -30], dirMode: 'vertical', alpha: 0, beta: 0 },
    muscles: createMuscles(),
    selectedMuscle: 'masseter-L'
});

const state = defaultState();
const ui = { tab: 'results', focus: null, playing: false, animT: 0 };
let viewer = null;
let dirty = true;
let lastHeavy = 0;

function isDark() {
    const theme = document.documentElement.dataset.theme;
    if (theme) return theme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const actions = {
    changed() { dirty = true; },
    reset() {
        Object.assign(state, defaultState());
        ui.playing = false;
        setPlayButton(false);
        clearScenario();
        dirty = true;
    },
    applyScenario(id) {
        const sc = SCENARIOS.find((s) => s.id === id);
        const keepGeom = { ...state.geom };
        Object.assign(state, defaultState(), { geom: keepGeom });
        sc.apply(state);
        ui.playing = false;
        setPlayButton(false);
        dirty = true;
        announce(t(`sc.${sc.id}.hint`));
    },
    setBite(pos) {
        state.bite.t = pos;
        state.bite.custom = false;
        clearScenario();
        dirty = true;
    },
    selectMuscle(id) {
        const m = state.muscles.find((x) => x.id === id);
        if (!m) return;
        state.selectedMuscle = id;
        dirty = true;
    },
    setLang(l) {
        setLang(l);
        applyStatic();
        renderStaticMath();
        localizeMuscles(state.muscles);
        localizeUI();
        viewer.relabel();
        dirty = true;
    },
    toggleTheme() {
        const next = isDark() ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('jaw-theme', next); } catch (e) { /* ignore */ }
        viewer.setTheme(next === 'dark');
    },
    togglePlay() {
        ui.playing = !ui.playing;
        if (ui.playing) ui.animT = Math.acos(Math.max(-1, Math.min(1, 1 - state.theta / 12.5)));
        setPlayButton(ui.playing);
    },
    setView(v) { viewer.setView(v, state.geom); },
    setViewOption(k, v) {
        viewer.opts[k] = v;
        dirty = true;
    },
    tabChanged(name) {
        ui.tab = name;
        dirty = true;
    },
    focusStep(spec) {
        ui.focus = spec;
        applyFocus();
    }
};

function applyFocus() {
    if (!viewer) return;
    const spec = ui.focus;
    if (!spec) {
        viewer.setFocus(null);
        viewer.showLever(null);
        return;
    }
    const tags = spec.split(',').flatMap((t) => {
        if (t === 'muscle') return [`muscle:${state.selectedMuscle}`];
        if (t === 'lever') return [`muscle:${state.selectedMuscle}`, 'hinge'];
        return [t];
    });
    viewer.setFocus(tags);
    viewer.showLever(spec.includes('lever') ? state.selectedMuscle : null);
}

function onPick(info) {
    if (info.kind === 'tooth') {
        actions.setBite(info.t);
    } else if (info.kind === 'muscle') {
        actions.selectMuscle(info.id);
        flashMuscleCard(info.id);
    } else if (info.kind === 'joint' || info.kind === 'condyle') {
        showTab('steps');
        document.getElementById('step-7').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (info.kind === 'bite') {
        showTab('steps');
        document.getElementById('step-4').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (info.kind === 'triangle') {
        showTab('steps');
        document.getElementById('step-9').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Tooltip content for 3D hover
function describe(d) {
    const { res } = solveState(state);
    const n = (x) => x.toFixed(0);
    const hint = (key) => `<span class="muted">${t(key)}</span>`;
    if (d.kind === 'muscle') {
        const m = res.muscles.find((x) => x.id === d.id);
        const base = state.muscles.find((x) => x.id === d.id);
        if (!m) return `<b>${base.name}</b><br>${hint('tip.inactive')}`;
        return `<b>${m.name}</b><br>${t('tip.muscle', { F: n(m.force), b: m.lever.toFixed(1) })}<br>τ<sub>x</sub> = ${(m.tau[0] / 1000).toFixed(2)} N·m<br>${hint('tip.select')}`;
    }
    if (d.kind === 'tooth') return `<b>${toothName(d.i, d.side)}</b><br>${hint('tip.tooth')}`;
    if (d.kind === 'bite') {
        return `<b>${t('tip.bite')}</b> (${state.bite.custom ? t('tip.custom') : describeBite(state.bite.t)})<br>F<sub>B</sub> = ${n(res.FB)} N`;
    }
    if (d.kind === 'joint' || d.kind === 'condyle') {
        const F = d.side === 'L' ? res.FJL : res.FJR;
        const bad = F[2] > 1e-6;
        return `<b>${t(`joint.${d.side}`)}</b><br>‖F‖ = ${n(vec.norm(F))} N · [${F.map(n).join(', ')}]<br>${bad ? `<span class="bad">${t('distraction')}</span>` : t('compression')}`;
    }
    if (d.kind === 'triangle') return `<b>${t('tip.triangle')}</b><br>${t('tip.triangleSub')}`;
    return '';
}

function frame() {
    if (ui.playing) {
        ui.animT += 0.018;
        state.theta = Math.round(12.5 * (1 - Math.cos(ui.animT)) * 10) / 10;
        dirty = true;
    }
    if (!dirty) return;
    dirty = false;

    const { posed, res } = solveState(state);
    if (res.muscles.length && !res.muscles.some((m) => m.id === state.selectedMuscle)) {
        state.selectedMuscle = res.muscles[0].id;
    }
    const now = performance.now();
    // Charts and KaTeX are the expensive part: throttle them while animating
    const heavy = !ui.playing || now - lastHeavy > 250;
    if (heavy) lastHeavy = now;

    syncControls();
    renderArchPicker(posed);
    const sweep = heavy && ui.tab === 'results' ? sweepArch(state) : null;
    renderResults(posed, res, sweep, heavy && ui.tab === 'results');
    if (heavy && ui.tab === 'steps') {
        renderSteps(state, posed, res, state.selectedMuscle);
        renderTriangleChart(document.getElementById('tri-chart-steps'), res, posed);
    }
    viewer.update(state, posed, res);
    applyFocus();
}

// Renders the \( \) and $$ $$ formulas of the static (translated) text
function renderStaticMath() {
    if (typeof renderMathInElement === 'undefined') return;
    renderMathInElement(document.body, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\(', right: '\\)', display: false }
        ],
        ignoredClasses: ['math'],
        throwOnError: false
    });
}

let announceTimer = null;
function announce(text) {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.className = 'toast';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

function init() {
    viewer = new JawViewer(document.getElementById('viewer'), { onPick });
    viewer.describe = describe;
    viewer.setTheme(isDark());
    viewer.onFrame = frame;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!document.documentElement.dataset.theme) viewer.setTheme(isDark());
    });

    applyStatic();
    initUI(state, actions);
    viewer.relabel();
    renderStaticMath();
    viewer.setView('iso', state.geom);
}

init();
