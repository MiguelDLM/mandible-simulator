// Vector Math Utilities
export const vec = {
    add: (v1, v2) => [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]],
    sub: (v1, v2) => [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]],
    scale: (v, s) => [v[0] * s, v[1] * s, v[2] * s],
    dot: (v1, v2) => v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2],
    cross: (v1, v2) => [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
    ],
    norm: (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
    normalize: (v) => {
        const n = vec.norm(v);
        return n > 0 ? vec.scale(v, 1 / n) : [0, 0, 0];
    },
    format: (v, dec = 1) => `[${v[0].toFixed(dec)}, ${v[1].toFixed(dec)}, ${v[2].toFixed(dec)}]`,
    rotateX: (p, theta) => {
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        return [
            p[0],
            p[1] * cosT + p[2] * sinT,
            -p[1] * sinT + p[2] * cosT
        ];
    }
};

/**
 * Solve static biomechanical equations of the jaw model.
 * 
 * @param {Object} state - The global application state containing jaw parameters.
 * @returns {Object} Calculated metrics (vectors, advantage, etc.)
 */
export function solveBiomechanics(state) {
    const w = state.w;
    const L = state.L;
    const theta = state.theta || 0;
    
    // Rotate bite point in anatomical space
    const rB = vec.rotateX(state.rB, theta);
    const uB = state.uB;
    
    let totalMuscleTorque = [0, 0, 0];
    let sumActiveForcesScalar = 0;
    let sumActiveForcesVector = [0, 0, 0];
    const musclesComputed = [];
    
    state.muscles.forEach((m) => {
        if (!m.active) return;
        
        // Rotate muscle insertion on mandible, origin on skull is static
        const r_rotated = vec.rotateX(m.r, theta);
        
        // Direction vector from insertion pointing toward skull origin
        const dirVec = vec.sub(m.origin, r_rotated);
        const u_i = vec.normalize(dirVec);
        
        // Force vector
        const F_i = vec.scale(u_i, m.force);
        
        // Torque about origin (ATM midpoint)
        const tau_i = vec.cross(r_rotated, F_i);
        
        // Accumulate
        totalMuscleTorque = vec.add(totalMuscleTorque, tau_i);
        sumActiveForcesScalar += m.force;
        sumActiveForcesVector = vec.add(sumActiveForcesVector, F_i);
        
        const mCopy = { ...m, r: r_rotated };
        musclesComputed.push({
            m: mCopy,
            u_i,
            F_i,
            tau_i
        });
    });
    
    const T_x = totalMuscleTorque[0];
    
    // Solve Bite Force (F_B)
    const yB = rB[1];
    const zB = rB[2];
    const uBx = uB[0];
    const uBy = uB[1];
    const uBz = uB[2];
    
    const denominator = yB * uBz - zB * uBy;
    
    let FB = 0;
    let FB_vector = [0, 0, 0];
    let biteTorque = [0, 0, 0];
    let divideByZero = false;
    
    if (theta <= 0.005) {
        if (Math.abs(denominator) > 1e-5) {
            FB = -T_x / denominator;
            FB_vector = vec.scale(uB, FB);
            biteTorque = vec.cross(rB, FB_vector);
        } else {
            divideByZero = true;
        }
    } else {
        FB = 0;
        FB_vector = [0, 0, 0];
        biteTorque = [0, 0, 0];
    }
    
    // Solve Joint Reaction Forces (F_JL, F_JR)
    const F_input_total_vec = sumActiveForcesVector;
    const F_net = vec.scale(vec.add(FB_vector, F_input_total_vec), -1);
    const tau_net = vec.scale(vec.add(biteTorque, totalMuscleTorque), -1);
    
    let F_JL = [0, 0, 0];
    let F_JR = [0, 0, 0];
    
    if (w > 0) {
        F_JR[2] = 0.5 * (F_net[2] + tau_net[1] / w);
        F_JL[2] = 0.5 * (F_net[2] - tau_net[1] / w);
        
        F_JL[1] = 0.5 * (F_net[1] + tau_net[2] / w);
        F_JR[1] = 0.5 * (F_net[1] - tau_net[2] / w);
        
        F_JL[0] = 0.5 * F_net[0];
        F_JR[0] = 0.5 * F_net[0];
    }
    
    const MA = sumActiveForcesScalar > 0 ? Math.abs(FB) / sumActiveForcesScalar : 0;
    
    return {
        rB,
        musclesComputed,
        totalMuscleTorque,
        sumActiveForcesScalar,
        sumActiveForcesVector,
        FB,
        FB_vector,
        biteTorque,
        denominator,
        divideByZero,
        F_net,
        tau_net,
        F_JL,
        F_JR,
        MA
    };
}
