// Anatomical model: reference geometry, muscles, dental arch and posing.
import { vec, rotateOpen, solveStatics } from './math.js';
import { t, cap } from './i18n.js';

// Reference geometry the default coordinates are expressed in (mm).
// X scales with w, Y and Z scale with L.
export const REF = { w: 50, L: 95 };

export const MUSCLE_TYPES = [
    {
        key: 'masseter', color: '#10b981', force: 150, active: true,
        ins: [-47, 12, -46], ori: [-52, 34, -2]
    },
    {
        key: 'temporalis', color: '#6366f1', force: 120, active: true,
        ins: [-41, 27, -6], ori: [-52, 14, 52]
    },
    {
        key: 'pterygoidMed', color: '#f59e0b', force: 100, active: true,
        ins: [-40, 8, -44], ori: [-14, 24, -8]
    },
    {
        key: 'pterygoidLat', color: '#ec4899', force: 40, active: false,
        ins: [-44, 3, -4], ori: [-18, 26, -14]
    }
];

export function createMuscles() {
    const muscles = MUSCLE_TYPES.flatMap((mt) => ['L', 'R'].map((side) => {
        const sx = side === 'L' ? 1 : -1; // reference coordinates are given for the left side (x < 0)
        return {
            id: `${mt.key}-${side}`,
            type: mt.key,
            side,
            color: mt.color,
            active: mt.active,
            force: mt.force,
            insRef: [mt.ins[0] * sx, mt.ins[1], mt.ins[2]],
            oriRef: [mt.ori[0] * sx, mt.ori[1], mt.ori[2]]
        };
    }));
    localizeMuscles(muscles);
    return muscles;
}

/** (Re)computes the language-dependent labels of each muscle: name, plain tag and LaTeX subscript. */
export function localizeMuscles(muscles) {
    muscles.forEach((m) => {
        const abbr = t(`muscle.${m.type}.abbr`);
        const sub = t(`sub.${m.side}`);
        m.name = cap(t('muscle.full', { name: t(`muscle.${m.type}`), side: t(`side.${m.side}`) }));
        m.tag = `${abbr}-${sub}`;
        m.tex = `\\mathrm{${abbr}}_{${sub}}`;
    });
}

export const toMM = (p, g) => [p[0] * g.w / REF.w, p[1] * g.L / REF.L, p[2] * g.L / REF.L];
export const fromMM = (p, g) => [p[0] * REF.w / g.w, p[1] * REF.L / g.L, p[2] * REF.L / g.L];

// Mandibular teeth per side, from the midline backwards (mesiodistal/buccolingual widths in mm)
export const TEETH = [
    { md: 5.5, bl: 6.0, h: 9.5 },
    { md: 6.0, bl: 6.2, h: 9.5 },
    { md: 7.0, bl: 7.5, h: 11 },
    { md: 7.0, bl: 7.8, h: 8.5 },
    { md: 7.2, bl: 8.2, h: 8 },
    { md: 11.0, bl: 10.5, h: 7.5 },
    { md: 10.5, bl: 10.0, h: 7 }
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
export function describeBite(pos) {
    const at = Math.abs(pos);
    if (at < 0.03) return t('bite.midline');
    let best = 0;
    TOOTH_CENTERS.forEach((c, i) => {
        if (Math.abs(at - c) < Math.abs(at - TOOTH_CENTERS[best])) best = i;
    });
    return toothName(best, pos < 0 ? 'L' : 'R');
}

export function toothName(i, side) {
    return cap(t('tooth.full', { tooth: t(`tooth.${i}`), side: t(`side.${side}`) }));
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
        id: 'incisal',
        apply: (s) => { s.bite.t = 0; }
    },
    {
        id: 'molar',
        apply: (s) => { s.bite.t = -TOOTH_CENTERS[5]; }
    },
    {
        id: 'molar-balance',
        apply: (s) => {
            s.bite.t = -TOOTH_CENTERS[5];
            s.muscles.forEach((m) => { if (m.side === 'R') m.force = Math.round(m.force * 0.5); });
        }
    },
    {
        id: 'distraction',
        apply: (s) => {
            s.bite.t = -TOOTH_CENTERS[2];
            s.muscles.forEach((m) => { if (m.side === 'L') m.active = false; });
        }
    },
    {
        id: 'open',
        apply: (s) => { s.bite.t = 0; s.theta = 20; }
    }
];
