// Anatomical model: reference geometry, muscles, dental arch and posing.
import { vec, rotateOpen, solveStatics } from './math.js';

// Reference geometry the default coordinates are expressed in (mm).
// X scales with w, Y and Z scale with L.
export const REF = { w: 50, L: 95 };

export const MUSCLE_TYPES = [
    {
        key: 'masseter', name: 'Masetero', abbr: 'MS', color: '#10b981', force: 150, active: true,
        ins: [-47, 12, -46], ori: [-52, 34, -2],
        desc: 'Del arco cigomático al ángulo mandibular. Es el elevador principal: tira hacia arriba y adelante.'
    },
    {
        key: 'temporalis', name: 'Temporal', abbr: 'TE', color: '#6366f1', force: 120, active: true,
        ins: [-41, 27, -6], ori: [-52, 14, 52],
        desc: 'De la fosa temporal a la apófisis coronoides. Eleva casi en vertical; sus fibras posteriores retruyen.'
    },
    {
        key: 'pterygoidMed', name: 'Pterigoideo medial', abbr: 'PM', color: '#f59e0b', force: 100, active: true,
        ins: [-40, 8, -44], ori: [-14, 24, -8],
        desc: 'De la fosa pterigoidea a la cara interna del ángulo. Eleva y lleva la mandíbula hacia la línea media.'
    },
    {
        key: 'pterygoidLat', name: 'Pterigoideo lateral', abbr: 'PL', color: '#ec4899', force: 40, active: false,
        ins: [-44, 3, -4], ori: [-18, 26, -14],
        desc: 'De la lámina pterigoidea lateral al cuello del cóndilo. Protruye y participa en la apertura; casi no eleva.'
    }
];

export const SIDE_NAME = { L: 'izquierdo', R: 'derecho' };
export const SIDE_TEX = { L: 'I', R: 'D' };

export function createMuscles() {
    return MUSCLE_TYPES.flatMap((t) => ['L', 'R'].map((side) => {
        const sx = side === 'L' ? 1 : -1; // reference coordinates are given for the left side (x < 0)
        return {
            id: `${t.key}-${side}`,
            type: t.key,
            side,
            name: `${t.name} ${SIDE_NAME[side]}`,
            tex: `\\mathrm{${t.abbr}}_{${SIDE_TEX[side]}}`,
            tag: `${t.abbr}-${SIDE_TEX[side]}`,
            color: t.color,
            active: t.active,
            force: t.force,
            insRef: [t.ins[0] * sx, t.ins[1], t.ins[2]],
            oriRef: [t.ori[0] * sx, t.ori[1], t.ori[2]]
        };
    }));
}

export const toMM = (p, g) => [p[0] * g.w / REF.w, p[1] * g.L / REF.L, p[2] * g.L / REF.L];
export const fromMM = (p, g) => [p[0] * REF.w / g.w, p[1] * REF.L / g.L, p[2] * REF.L / g.L];

// Mandibular teeth per side, from the midline backwards (mesiodistal/buccolingual widths in mm)
export const TEETH = [
    { name: 'Incisivo central', short: 'IC', md: 5.5, bl: 6.0, h: 9.5 },
    { name: 'Incisivo lateral', short: 'IL', md: 6.0, bl: 6.2, h: 9.5 },
    { name: 'Canino', short: 'C', md: 7.0, bl: 7.5, h: 11 },
    { name: '1.er premolar', short: 'PM1', md: 7.0, bl: 7.8, h: 8.5 },
    { name: '2.º premolar', short: 'PM2', md: 7.2, bl: 8.2, h: 8 },
    { name: '1.er molar', short: 'M1', md: 11.0, bl: 10.5, h: 7.5 },
    { name: '2.º molar', short: 'M2', md: 10.5, bl: 10.0, h: 7 }
];
const TOOTH_SUM = TEETH.reduce((a, t) => a + t.md, 0);
// Arc-length fraction (0 = midline, 1 = distal end) of each tooth centre
export const TOOTH_CENTERS = (() => {
    let acc = 0;
    return TEETH.map((t) => {
        const c = (acc + t.md / 2) / TOOTH_SUM;
        acc += t.md;
        return c;
    });
})();

/**
 * Parabolic dental arch on the occlusal plane, parametrised by signed arc-length
 * fraction t in [-1, 1]: -1 = distal end on the left, 0 = midline, 1 = right.
 */
export function makeArch(g) {
    const s = g.L / REF.L;
    const a = 0.48 * g.w;
    const ym = 0.40 * g.L;
    const zOcc = -30 * s;
    const k = (g.L - ym) / (a * a);
    const N = 400;
    const xs = new Float64Array(N + 1);
    const cum = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
        xs[i] = -a + (2 * a * i) / N;
        if (i > 0) {
            const dx = xs[i] - xs[i - 1];
            const dy = k * (xs[i - 1] ** 2 - xs[i] ** 2);
            cum[i] = cum[i - 1] + Math.hypot(dx, dy);
        }
    }
    const total = cum[N];
    const xAt = (t) => {
        const target = ((Math.max(-1, Math.min(1, t)) + 1) / 2) * total;
        let lo = 0;
        let hi = N;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] < target) lo = mid; else hi = mid;
        }
        const f = (target - cum[lo]) / (cum[hi] - cum[lo] || 1);
        return xs[lo] + f * (xs[hi] - xs[lo]);
    };
    const point = (t) => {
        const x = xAt(t);
        return [x, g.L - k * x * x, zOcc];
    };
    const tangent = (t) => vec.normalize([1, -2 * k * xAt(t), 0]);
    return { a, ym, zOcc, k, total, s, point, tangent, toothScale: total / 2 / TOOTH_SUM };
}

/** Readable description of a bite position t. */
export function describeBite(t) {
    const at = Math.abs(t);
    if (at < 0.03) return 'Incisivos centrales (línea media)';
    let best = 0;
    TOOTH_CENTERS.forEach((c, i) => {
        if (Math.abs(at - c) < Math.abs(at - TOOTH_CENTERS[best])) best = i;
    });
    return `${TEETH[best].name} ${t < 0 ? 'izquierdo' : 'derecho'}`;
}

export function biteDirection(bite, theta) {
    switch (bite.dirMode) {
        case 'occlusal':
            return rotateOpen([0, 0, -1], theta);
        case 'free': {
            const a = (bite.alpha * Math.PI) / 180;
            const b = (bite.beta * Math.PI) / 180;
            return vec.normalize([Math.tan(b), Math.tan(a), -1]);
        }
        default:
            return [0, 0, -1];
    }
}

let archCache = { key: '', arch: null };
export function getArch(g) {
    const key = `${g.w}|${g.L}`;
    if (archCache.key !== key) archCache = { key, arch: makeArch(g) };
    return archCache.arch;
}

/** Positions every element for the current pose and returns the solver input. */
export function poseModel(state, overrideT) {
    const g = state.geom;
    const theta = (state.theta * Math.PI) / 180;
    const arch = getArch(g);
    const t = overrideT ?? state.bite.t;
    const rB0 = state.bite.custom && overrideT === undefined ? state.bite.point : arch.point(t);
    const rB = rotateOpen(rB0, theta);
    const uB = biteDirection(state.bite, theta);
    const muscles = state.muscles.map((m) => ({
        ...m,
        r: rotateOpen(toMM(m.insRef, g), theta),
        o: toMM(m.oriRef, g)
    }));
    return { w: g.w, L: g.L, theta, arch, rB0, rB, uB, muscles };
}

export const activeMuscles = (posed) => posed.muscles.filter((m) => m.active && m.force > 0);

export function solveState(state) {
    const posed = poseModel(state);
    const res = solveStatics({ w: posed.w, rB: posed.rB, uB: posed.uB, muscles: activeMuscles(posed) });
    return { posed, res };
}

/** Sweeps the bite point along the whole arch (used by the force-vs-position chart). */
export function sweepArch(state, n = 121) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const t = -1 + (2 * i) / (n - 1);
        const posed = poseModel(state, t);
        const r = solveStatics({ w: posed.w, rB: posed.rB, uB: posed.uB, muscles: activeMuscles(posed) });
        out.push({
            t,
            FB: r.FB,
            JL: vec.norm(r.FJL),
            JR: vec.norm(r.FJR),
            bad: r.noBite || r.distractionL || r.distractionR
        });
    }
    return out;
}

export const SCENARIOS = [
    {
        id: 'incisal', label: 'Mordida incisal',
        hint: 'Morder con los incisivos y activación simétrica: palanca larga, ventaja mecánica baja.',
        apply: (s) => { s.bite.t = 0; }
    },
    {
        id: 'molar', label: 'Molar izquierdo',
        hint: 'Mismo esfuerzo muscular, pero mordiendo con el 1.er molar izquierdo: brazo de palanca corto.',
        apply: (s) => { s.bite.t = -TOOTH_CENTERS[5]; }
    },
    {
        id: 'molar-balance', label: 'Molar izq. · balance reducido',
        hint: 'Molar izquierdo con los músculos del lado derecho (balance) al 50 %: la resultante se desplaza hacia el lado de trabajo.',
        apply: (s) => {
            s.bite.t = -TOOTH_CENTERS[5];
            s.muscles.forEach((m) => { if (m.side === 'R') m.force = Math.round(m.force * 0.5); });
        }
    },
    {
        id: 'distraction', label: 'Distracción articular',
        hint: 'Canino izquierdo con solo los músculos derechos: la resultante sale del triángulo de soporte y la ATM izquierda tendría que «tirar».',
        apply: (s) => {
            s.bite.t = -TOOTH_CENTERS[2];
            s.muscles.forEach((m) => { if (m.side === 'L') m.active = false; });
        }
    },
    {
        id: 'open', label: 'Boca abierta 20°',
        hint: 'Mordida incisal con 20° de apertura: cambian las líneas de acción de los músculos y sus brazos de palanca.',
        apply: (s) => { s.bite.t = 0; s.theta = 20; }
    }
];
