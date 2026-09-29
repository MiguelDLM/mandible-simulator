// Pure math: 3D vector helpers and the rigid-body statics solver of the mandible.
// Anatomical frame (mm, N): origin at the midpoint between condyles,
// +X = the animal's right, +Y = anterior, +Z = superior. The hinge axis is the X axis.

export const vec = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (v, s) => [v[0] * s, v[1] * s, v[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ],
    norm: (v) => Math.hypot(v[0], v[1], v[2]),
    normalize: (v) => {
        const n = vec.norm(v);
        return n > 0 ? vec.scale(v, 1 / n) : [0, 0, 0];
    },
    sum: (list) => list.reduce((acc, v) => vec.add(acc, v), [0, 0, 0])
};

/**
 * Rotates a point of the mandible about the hinge (X) axis.
 * theta > 0 opens the mouth: the chin (+Y) moves down (-Z).
 */
export function rotateOpen(p, theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return [p[0], p[1] * c + p[2] * s, -p[1] * s + p[2] * c];
}

/** Barycentric coordinates of 2D point P in triangle (A, B, C). */
export function barycentric(P, A, B, C) {
    const det = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    if (Math.abs(det) < 1e-9) return null;
    const l1 = ((B[1] - C[1]) * (P[0] - C[0]) + (C[0] - B[0]) * (P[1] - C[1])) / det;
    const l2 = ((C[1] - A[1]) * (P[0] - C[0]) + (A[0] - C[0]) * (P[1] - C[1])) / det;
    return [l1, l2, 1 - l1 - l2];
}

/**
 * Static equilibrium of the mandible.
 *
 * Unknowns: bite force magnitude F_B (direction uB is given) and the two
 * condylar reactions F_JL, F_JR (3 components each) -> 7 unknowns.
 * Equations: sum F = 0 and sum tau = 0 about the origin -> 6 equations.
 * The missing equation is supplied by the assumption F_JLx = F_JRx.
 *
 * @param {{w:number, rB:number[], uB:number[], muscles:{id:string, r:number[], o:number[], force:number}[]}} input
 *   w: half intercondylar width; rB: bite point; uB: unit direction of the food reaction on the mandible;
 *   muscles: active muscles with insertion r (on the mandible) and origin o (on the skull).
 */
export function solveStatics({ w, rB, uB, muscles }) {
    const computed = muscles.map((m) => {
        const d = vec.sub(m.o, m.r);
        const len = vec.norm(d);
        const u = vec.normalize(d);
        const F = vec.scale(u, m.force);
        const tau = vec.cross(m.r, F);
        // Effective lever arm about the hinge axis: tau_x = F * b
        const lever = m.force > 0 ? tau[0] / m.force : 0;
        return { ...m, d, len, u, F, tau, lever };
    });

    const R = vec.sum(computed.map((c) => c.F));
    const Tm = vec.sum(computed.map((c) => c.tau));
    const sumForces = computed.reduce((acc, c) => acc + c.force, 0);

    // 1) Moment balance about the hinge axis (X): condyles lie on X, so they drop out.
    //    Tm_x + F_B (rB x uB)_x = 0
    const rBxuB = vec.cross(rB, uB);
    const denom = rBxuB[0]; // = yB*uBz - zB*uBy
    const singular = Math.abs(denom) < 1e-6;
    const FB = singular ? 0 : -Tm[0] / denom;
    const FBvec = vec.scale(uB, FB);
    const tauB = vec.cross(rB, FBvec);
    const biteLever = -denom; // tau_Bx = -F_B * biteLever

    // 2) What the joints must supply
    const Fnet = vec.scale(vec.add(R, FBvec), -1);
    const tauNet = vec.scale(vec.add(Tm, tauB), -1);

    // 3) Joint reactions. Joint moments: rJL x FJL + rJR x FJR = [0, w(FJLz - FJRz), w(FJRy - FJLy)]
    const FJL = [
        Fnet[0] / 2,
        (Fnet[1] - tauNet[2] / w) / 2,
        (Fnet[2] + tauNet[1] / w) / 2
    ];
    const FJR = [
        Fnet[0] / 2,
        (Fnet[1] + tauNet[2] / w) / 2,
        (Fnet[2] - tauNet[1] / w) / 2
    ];

    // 4) Verification: residuals must vanish
    const rJL = [-w, 0, 0];
    const rJR = [w, 0, 0];
    const residualF = vec.sum([R, FBvec, FJL, FJR]);
    const residualT = vec.sum([Tm, tauB, vec.cross(rJL, FJL), vec.cross(rJR, FJR)]);

    // 5) Geometric reading (Greaves' support triangle): the point M of the
    //    occlusal (XY) projection where a single vertical force R_z produces the
    //    same tau_x and tau_y as all the muscles. Exact for a vertical bite force.
    let M = null;
    let bary = null;
    if (R[2] > 1e-6) {
        M = [-Tm[1] / R[2], Tm[0] / R[2]];
        bary = barycentric(M, [-w, 0], [w, 0], [rB[0], rB[1]]); // [lambda_L, lambda_R, lambda_B]
    }

    return {
        muscles: computed,
        R,
        Tm,
        sumForces,
        rB,
        uB,
        w,
        rBxuB,
        denom,
        singular,
        biteLever,
        FB,
        FBvec,
        tauB,
        Fnet,
        tauNet,
        FJL,
        FJR,
        rJL,
        rJR,
        residualF,
        residualT,
        M,
        bary,
        MA: sumForces > 0 ? FB / sumForces : 0,
        noBite: !singular && FB < 0,
        // The fossa can only push the condyle down (F_z < 0 = compression).
        distractionL: FJL[2] > 1e-6,
        distractionR: FJR[2] > 1e-6
    };
}
