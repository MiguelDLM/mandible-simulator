// Step-by-step derivation rendered with KaTeX, using the live numbers of the current configuration.
/* global katex */
import { vec } from './math.js';

const num = (x, d = 1) => {
    const r = Number(x.toFixed(d));
    return (r === 0 ? 0 : r).toFixed(d); // avoids "-0.0"
};
const par = (x, d = 1) => {
    const s = num(x, d);
    return s.startsWith('-') ? `(${s})` : s;
};
const row = (v, d = 1) => `\\left[\\,${num(v[0], d)},\\ ${num(v[1], d)},\\ ${num(v[2], d)}\\,\\right]`;
const MM = '\\,\\text{mm}';
const N = '\\,\\text{N}';
const NMM = '\\,\\text{N}\\!\\cdot\\!\\text{mm}';

const tex = (el, s) => {
    if (el) katex.render(s, el, { displayMode: true, throwOnError: false });
};
export const im = (s) => katex.renderToString(s, { throwOnError: false });
const $ = (id) => document.getElementById(id);

function table(el, head, rows, foot) {
    if (!el) return;
    const th = head.map((h) => `<th>${h}</th>`).join('');
    const tr = rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? '' : ' class="name"'}>${c}</td>`).join('')}</tr>`).join('');
    const tf = foot ? `<tfoot><tr>${foot.map((c) => `<td>${c}</td>`).join('')}</tr></tfoot>` : '';
    el.innerHTML = `<table class="data-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${tf}</table>`;
}

const chip = (m) => `<span class="m-chip" style="--c:${m.color}">${m.tag}</span>`;
const vcell = (v, d = 1) => `<span class="mono">[${num(v[0], d)}, ${num(v[1], d)}, ${num(v[2], d)}]</span>`;

export function renderSteps(state, posed, res, selectedId) {
    if (typeof katex === 'undefined') return;
    const ms = res.muscles;
    const sel = ms.find((m) => m.id === selectedId) || ms[0];
    const w = res.w;
    const thetaDeg = state.theta;

    // ---- Step 0: data of the problem
    tex($('s0-data'), `\\begin{aligned}
        w &= ${num(w)}${MM}\\\\
        \\vec r_{JI} &= ${row(res.rJL)}${MM}\\\\
        \\vec r_{JD} &= ${row(res.rJR)}${MM}\\\\
        \\vec r_B &= ${row(res.rB)}${MM}\\\\
        \\hat u_B &= ${row(res.uB, 3)}
    \\end{aligned}`);
    const rot = $('s0-rotation');
    if (rot) {
        if (thetaDeg > 0.01) {
            rot.hidden = false;
            const c = Math.cos(posed.theta).toFixed(3);
            const s = Math.sin(posed.theta).toFixed(3);
            rot.querySelector('.rot-text').innerHTML = `Con la boca abierta ${im(`\\theta = ${num(thetaDeg)}^\\circ`)}, cada punto de la mandíbula
                (inserciones y punto de mordida) se rota alrededor del eje X antes de calcular; los orígenes en el cráneo no se mueven:`;
            tex(rot.querySelector('.rot-math'), `\\vec r = \\begin{bmatrix}1&0&0\\\\0&\\cos\\theta&\\sin\\theta\\\\0&-\\sin\\theta&\\cos\\theta\\end{bmatrix}\\vec r_0
                = \\begin{bmatrix}1&0&0\\\\0&${c}&${s}\\\\0&-${s}&${c}\\end{bmatrix}\\vec r_0`);
        } else {
            rot.hidden = true;
        }
    }

    const empty = ms.length === 0;
    document.querySelectorAll('.needs-muscle').forEach((el) => { el.hidden = empty; });
    const noMuscle = $('steps-empty');
    if (noMuscle) noMuscle.hidden = !empty;
    if (empty) return;

    // ---- Step 1: directions
    tex($('s1-detail'), `\\begin{aligned}
        \\vec d_{${sel.tex}} &= \\vec o - \\vec r = ${row(sel.o)} - ${row(sel.r)}\\\\
        &= ${row(sel.d)}${MM}\\\\
        \\|\\vec d_{${sel.tex}}\\| &= \\sqrt{${par(sel.d[0])}^2 + ${par(sel.d[1])}^2 + ${par(sel.d[2])}^2} = ${num(sel.len)}${MM}\\\\
        \\hat u_{${sel.tex}} &= \\frac{\\vec d}{\\|\\vec d\\|} = \\frac{${row(sel.d)}}{${num(sel.len)}}\\\\
        &= ${row(sel.u, 3)}
    \\end{aligned}`);
    table($('s1-table'), ['Músculo', 'd (mm)', '‖d‖ (mm)', 'û'],
        ms.map((m) => [chip(m), vcell(m.d), num(m.len), vcell(m.u, 3)]));

    // ---- Step 2: force vectors
    tex($('s2-detail'), `\\begin{aligned}
        \\vec F_{${sel.tex}} &= F\\,\\hat u = ${num(sel.force, 0)}${N} \\cdot ${row(sel.u, 3)}\\\\
        &= \\left[\\,${num(sel.force, 0)}\\cdot${par(sel.u[0], 3)},\\ ${num(sel.force, 0)}\\cdot${par(sel.u[1], 3)},\\ ${num(sel.force, 0)}\\cdot${par(sel.u[2], 3)}\\,\\right] = ${row(sel.F)}${N}
    \\end{aligned}`);
    table($('s2-table'), ['Músculo', 'F (N)', 'F⃗ (N)'],
        ms.map((m) => [chip(m), num(m.force, 0), vcell(m.F)]),
        ['<b>Σ = R⃗</b>', num(res.sumForces, 0), vcell(res.R)]);

    // ---- Step 3: moments
    const [rx, ry, rz] = sel.r;
    const [Fx, Fy, Fz] = sel.F;
    tex($('s3-detail'), `\\begin{aligned}
        \\vec\\tau_{${sel.tex}} &= \\vec r\\times\\vec F =
        \\begin{vmatrix}\\hat\\imath & \\hat\\jmath & \\hat k\\\\ ${num(rx)} & ${num(ry)} & ${num(rz)}\\\\ ${num(Fx)} & ${num(Fy)} & ${num(Fz)}\\end{vmatrix}\\\\[4pt]
        &= \\begin{bmatrix}
            ${par(ry)}\\cdot${par(Fz)} - ${par(rz)}\\cdot${par(Fy)}\\\\
            ${par(rz)}\\cdot${par(Fx)} - ${par(rx)}\\cdot${par(Fz)}\\\\
            ${par(rx)}\\cdot${par(Fy)} - ${par(ry)}\\cdot${par(Fx)}
        \\end{bmatrix} = ${row(sel.tau, 0)}${NMM}\\\\[4pt]
        b_{${sel.tex}} &= \\frac{\\tau_x}{F} = \\frac{${num(sel.tau[0], 0)}}{${num(sel.force, 0)}} = ${num(sel.lever)}${MM}
    \\end{aligned}`);
    table($('s3-table'), ['Músculo', 'τ⃗ (N·mm)', 'b (mm)', 'F·b = τₓ (N·mm)'],
        ms.map((m) => [chip(m), vcell(m.tau, 0), num(m.lever), num(m.tau[0], 0)]),
        ['<b>Σ = T⃗ₘ</b>', vcell(res.Tm, 0), '', `<b>${num(res.Tm[0], 0)}</b>`]);

    // ---- Step 4: bite force from the X moment balance
    const [xB, yB, zB] = res.rB;
    const uB = res.uB;
    if (res.singular) {
        tex($('s4-math'), `y_B u_{Bz} - z_B u_{By} = 0 \\;\\Rightarrow\\; \\text{la mordida no genera momento en X: sin solución}`);
        $('s4-lever').innerHTML = '';
    } else {
        tex($('s4-math'), `\\begin{aligned}
            (\\vec r_B\\times\\hat u_B)_x &= y_B\\,u_{Bz} - z_B\\,u_{By}\\\\
            &= ${par(yB)}\\cdot${par(uB[2], 3)} - ${par(zB)}\\cdot${par(uB[1], 3)} = ${num(res.denom, 2)}${MM}\\\\[4pt]
            F_B &= \\frac{-T_{m,x}}{(\\vec r_B\\times\\hat u_B)_x} = \\frac{-${par(res.Tm[0], 0)}}{${par(res.denom, 2)}} = \\boxed{${num(res.FB)}${N}}\\\\[4pt]
            \\vec F_B &= F_B\\,\\hat u_B = ${num(res.FB)} \\cdot ${row(uB, 3)}\\\\
            &= ${row(res.FBvec)}${N}
        \\end{aligned}`);
        $('s4-lever').innerHTML = `<p>Es la <b>ley de la palanca</b> generalizada: el brazo de la mordida es
            ${im(`b_B = -(\\vec r_B\\times\\hat u_B)_x = ${num(res.biteLever)}${MM}`)}${Math.abs(uB[0]) + Math.abs(uB[1]) < 1e-9 ? ` (con mordida vertical es simplemente ${im('y_B')})` : ''} y</p>
            ${katex.renderToString(`F_B = \\frac{\\sum_i F_i\\,b_i}{b_B} = \\frac{${num(res.Tm[0], 0)}${NMM}}{${num(res.biteLever)}${MM}} = ${num(res.FB)}${N}`, { displayMode: true, throwOnError: false })}
            <p>Por eso morder atrás (menor ${im('b_B')}) produce más fuerza con el mismo esfuerzo muscular.</p>`;
    }

    // ---- Step 5: bite moment
    tex($('s5-math'), `\\begin{aligned}
        \\vec\\tau_B &= \\vec r_B \\times \\vec F_B = ${row(res.rB)} \\times ${row(res.FBvec)}\\\\
        &= ${row(res.tauB, 0)}${NMM}\\\\
        T_{m,x} + \\tau_{B,x} &= ${num(res.Tm[0], 0)} + ${par(res.tauB[0], 0)} = ${num(res.Tm[0] + res.tauB[0], 0)} \\;\\checkmark
    \\end{aligned}`);

    // ---- Step 6: what the joints must supply
    tex($('s6-math'), `\\begin{aligned}
        \\vec F_{\\text{net}} &= -(\\vec R + \\vec F_B) = -\\left(${row(res.R)} + ${row(res.FBvec)}\\right)\\\\
        &= ${row(res.Fnet)}${N}\\\\[4pt]
        \\vec \\tau_{\\text{net}} &= -(\\vec T_m + \\vec\\tau_B) = -\\left(${row(res.Tm, 0)} + ${row(res.tauB, 0)}\\right)\\\\
        &= ${row(res.tauNet, 0)}${NMM}
    \\end{aligned}`);

    // ---- Step 7: joint reactions
    const Fn = res.Fnet;
    const tn = res.tauNet;
    const ty = tn[1] / w;
    const tz = tn[2] / w;
    tex($('s7-math'), `\\begin{aligned}
        \\tfrac{\\tau_{\\text{net},y}}{w} &= \\tfrac{${num(tn[1], 0)}}{${num(w)}} = ${num(ty)}${N}, \\qquad
        \\tfrac{\\tau_{\\text{net},z}}{w} = \\tfrac{${num(tn[2], 0)}}{${num(w)}} = ${num(tz)}${N}\\\\[8pt]
        F_{JI,z} &= \\tfrac12\\big(F_{\\text{net},z} + \\tfrac{\\tau_{\\text{net},y}}{w}\\big)\\\\
        &= \\tfrac12\\big(${num(Fn[2])} + ${par(ty)}\\big) = \\mathbf{${num(res.FJL[2])}}${N}\\\\
        F_{JD,z} &= \\tfrac12\\big(F_{\\text{net},z} - \\tfrac{\\tau_{\\text{net},y}}{w}\\big)\\\\
        &= \\tfrac12\\big(${num(Fn[2])} - ${par(ty)}\\big) = \\mathbf{${num(res.FJR[2])}}${N}\\\\[4pt]
        F_{JI,y} &= \\tfrac12\\big(F_{\\text{net},y} - \\tfrac{\\tau_{\\text{net},z}}{w}\\big)\\\\
        &= \\tfrac12\\big(${num(Fn[1])} - ${par(tz)}\\big) = \\mathbf{${num(res.FJL[1])}}${N}\\\\
        F_{JD,y} &= \\tfrac12\\big(F_{\\text{net},y} + \\tfrac{\\tau_{\\text{net},z}}{w}\\big)\\\\
        &= \\tfrac12\\big(${num(Fn[1])} + ${par(tz)}\\big) = \\mathbf{${num(res.FJR[1])}}${N}\\\\[4pt]
        F_{JI,x} &= F_{JD,x} = \\tfrac12 F_{\\text{net},x} = \\tfrac12\\cdot${par(Fn[0])} = \\mathbf{${num(res.FJL[0])}}${N} \\quad\\text{(supuesto)}\\\\[8pt]
        \\vec F_{JI} &= ${row(res.FJL)}${N}, \\quad \\|\\vec F_{JI}\\| = ${num(vec.norm(res.FJL))}${N}\\\\
        \\vec F_{JD} &= ${row(res.FJR)}${N}, \\quad \\|\\vec F_{JD}\\| = ${num(vec.norm(res.FJR))}${N}
    \\end{aligned}`);
    const verdict = (F, name) => (F[2] > 1e-6
        ? `<li class="bad">${name}: ${im('F_z > 0')} → <b>distracción</b>. La fosa tendría que tirar del cóndilo hacia arriba, cosa que una articulación no puede hacer.</li>`
        : `<li class="ok">${name}: ${im('F_z < 0')} → <b>compresión</b>. La fosa empuja el cóndilo hacia abajo, que es lo físicamente posible.</li>`);
    $('s7-interp').innerHTML = `<ul class="verdicts">${verdict(res.FJL, 'ATM izquierda')}${verdict(res.FJR, 'ATM derecha')}</ul>`;

    // ---- Step 8: verification
    tex($('s8-math'), `\\begin{aligned}
        \\textstyle\\sum \\vec F &= \\vec R + \\vec F_B + \\vec F_{JI} + \\vec F_{JD}\\\\
        &= ${row(res.residualF, 3)}${N}\\\\[4pt]
        \\textstyle\\sum \\vec \\tau &= \\vec T_m + \\vec\\tau_B + \\vec r_{JI}\\times\\vec F_{JI} + \\vec r_{JD}\\times\\vec F_{JD}\\\\
        &= ${row(res.residualT, 3)}${NMM}
    \\end{aligned}`);

    // ---- Step 9: geometric reading
    const s9 = $('s9-math');
    if (res.M && res.bary) {
        const [lL, lR, lB] = res.bary;
        const vertical = Math.abs(uB[0]) + Math.abs(uB[1]) < 1e-9;
        const eq = vertical ? '=' : '\\approx';
        tex(s9, `\\begin{aligned}
            M &= \\left(-\\frac{T_{m,y}}{R_z},\\ \\frac{T_{m,x}}{R_z}\\right)\\\\
            &= \\left(-\\frac{${num(res.Tm[1], 0)}}{${num(res.R[2])}},\\ \\frac{${num(res.Tm[0], 0)}}{${num(res.R[2])}}\\right)\\\\
            &= (${num(res.M[0])},\\ ${num(res.M[1])})${MM}\\\\[4pt]
            M &= \\lambda_I\\,J_I + \\lambda_D\\,J_D + \\lambda_B\\,B\\\\
            &\\Rightarrow\\ \\lambda_I = ${num(lL, 3)},\\ \\lambda_D = ${num(lR, 3)},\\ \\lambda_B = ${num(lB, 3)}\\\\[4pt]
            F_B &${eq} \\lambda_B R_z = ${num(lB, 3)}\\cdot${num(res.R[2])} = ${num(lB * res.R[2])}${N}\\\\
            -F_{JI,z} &${eq} \\lambda_I R_z = ${num(lL * res.R[2])}${N}\\\\
            -F_{JD,z} &${eq} \\lambda_D R_z = ${num(lR * res.R[2])}${N}\\\\[4pt]
            \\text{VM} &= \\frac{F_B}{\\sum F_i} = \\frac{${num(res.FB)}}{${num(res.sumForces, 0)}} = \\boxed{${num(res.MA, 2)}}
        \\end{aligned}`);
        $('s9-note').hidden = vertical;
    } else {
        tex(s9, `R_z \\le 0 \\;\\Rightarrow\\; \\text{los músculos no empujan hacia arriba: no hay triángulo de soporte que analizar}`);
        $('s9-note').hidden = true;
    }
}
