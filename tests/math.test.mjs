// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { solveStatics, vec, rotateOpen } from '../modules/math.js';
import { createMuscles, poseModel, activeMuscles, TOOTH_CENTERS, SCENARIOS } from '../modules/model.js';

const baseState = () => ({
    geom: { w: 50, L: 95 },
    theta: 0,
    bite: { t: 0, custom: false, point: [0, 95, -30], dirMode: 'vertical', alpha: 0, beta: 0 },
    muscles: createMuscles()
});

const solve = (state) => {
    const p = poseModel(state);
    return solveStatics({ w: p.w, rB: p.rB, uB: p.uB, muscles: activeMuscles(p) });
};

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test('equilibrium residuals vanish for random configurations', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 200; k++) {
        const s = baseState();
        s.bite.t = rnd() * 2 - 1;
        s.theta = rnd() * 25;
        s.bite.dirMode = ['vertical', 'occlusal', 'free'][k % 3];
        s.bite.alpha = rnd() * 60 - 30;
        s.bite.beta = rnd() * 60 - 30;
        s.muscles.forEach((m) => { m.force = rnd() * 300; m.active = rnd() > 0.2; });
        const r = solve(s);
        if (r.singular) continue;
        const scale = 1 + r.sumForces;
        r.residualF.forEach((c) => close(c / scale, 0, 1e-9));
        r.residualT.forEach((c) => close(c / (scale * 100), 0, 1e-9));
    }
});

test('symmetric incisal bite loads both condyles equally, in compression', () => {
    const r = solve(baseState());
    close(r.FJL[2], r.FJR[2], 1e-9);
    assert.ok(r.FJL[2] < 0 && r.FB > 0);
    assert.ok(r.MA > 0.2 && r.MA < 0.4, `MA=${r.MA}`);
});

test('unilateral molar bite loads the balancing (contralateral) condyle more', () => {
    const s = baseState();
    s.bite.t = -TOOTH_CENTERS[5]; // left first molar
    const r = solve(s);
    assert.ok(vec.norm(r.FJR) > vec.norm(r.FJL), 'right (balancing) condyle should carry more load');
});

test('bite force equals sum of F_i * b_i / y_B for a vertical bite (lever law)', () => {
    const r = solve(baseState());
    const moment = r.muscles.reduce((a, m) => a + m.force * m.lever, 0);
    close(r.FB, moment / r.rB[1], 1e-9);
});

test("Greaves' barycentric shares reproduce the vertical reactions", () => {
    const s = baseState();
    s.bite.t = -0.4;
    const r = solve(s);
    const [lL, lR, lB] = r.bary;
    close(r.FB, lB * r.R[2], 1e-6);
    close(-r.FJL[2], lL * r.R[2], 1e-6);
    close(-r.FJR[2], lR * r.R[2], 1e-6);
});

test('distraction scenario produces a condyle in tension', () => {
    const s = baseState();
    SCENARIOS.find((x) => x.id === 'distraction').apply(s);
    const r = solve(s);
    assert.ok(r.distractionL || r.distractionR);
});

test('rotateOpen moves the chin downwards', () => {
    const p = rotateOpen([0, 95, -30], 0.3);
    assert.ok(p[2] < -30);
});
