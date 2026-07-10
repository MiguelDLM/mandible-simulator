// Main Application Entry Point & Orchestrator
import { solveBiomechanics, vec } from './modules/math.js';
import { 
    initThreeJS, 
    update3DScene, 
    setCameraPreset, 
    toggleAxes, 
    updateClearColor, 
    onWindowResize 
} from './modules/viewer.js';
import { 
    initUI, 
    updateSlidersFromState, 
    renderMuscleContributionChart, 
    renderPhysicalWarnings, 
    renderLaTeXSteps, 
    renderStaticMath, 
    initTooltips, 
    initResizer, 
    toggleTheoryModal, 
    switchTab 
} from './modules/ui.js';

// Global state variables
const state = {
    // Mandible geometry
    w: 60, // Half intercondylar width (so 2w = 120)
    L: 100, // Mandible length from hinge axis to symphysis (chin)
    
    // Bite point position
    rB: [0, 100, -10], // Default is incisors
    bitePreset: 'incisors',
    
    // Bite reaction force direction type
    biteDirectionType: 'vertical-down',
    uB: [0, 0, -1], // unit direction of food reaction force on mandible
    
    // Theme
    theme: 'dark',
    
    // Active tab
    activeTab: 'tab-results',
    
    // Animation properties
    isAnimating: false,
    animationTime: 0,
    theta: 0,
    
    // Muscles configuration list
    muscles: [
        {
            id: 'masseter-l',
            name: 'Masetero Izquierdo',
            shortName: 'M. Izq',
            description: 'Músculo elevador principal en el lado izquierdo. Gran ventaja mecánica.',
            active: true,
            force: 150, // Newtons
            r: [-50, 30, -35], // Insertion on jaw (x, y, z)
            origin: [-60, 50, 15], // Origin on skull (x, y, z)
            default_r: [-50, 30, -35],
            default_origin: [-60, 50, 15],
            color: 0x00e676
        },
        {
            id: 'masseter-r',
            name: 'Masetero Derecho',
            shortName: 'M. Der',
            description: 'Músculo elevador principal en el lado derecho. Gran ventaja mecánica.',
            active: true,
            force: 150, // Newtons
            r: [50, 30, -35],
            origin: [60, 50, 15],
            default_r: [50, 30, -35],
            default_origin: [60, 50, 15],
            color: 0x00e676
        },
        {
            id: 'temporalis-l',
            name: 'Temporal Izquierdo',
            shortName: 'T. Izq',
            description: 'Se inserta en la apófisis coronoides. Fibras anteriores elevan, posteriores retruyen.',
            active: true,
            force: 120, // Newtons
            r: [-45, 40, 10],
            origin: [-55, 20, 70],
            default_r: [-45, 40, 10],
            default_origin: [-55, 20, 70],
            color: 0x2979ff
        },
        {
            id: 'temporalis-r',
            name: 'Temporal Derecho',
            shortName: 'T. Der',
            description: 'Se inserta en la apófisis coronoides. Fibras anteriores elevan, posteriores retruyen.',
            active: true,
            force: 120, // Newtons
            r: [45, 40, 10],
            origin: [55, 20, 70],
            default_r: [45, 40, 10],
            default_origin: [55, 20, 70],
            color: 0x2979ff
        },
        {
            id: 'pterygoid-med-l',
            name: 'Pterigoideo Medial Izq.',
            shortName: 'PM. Izq',
            description: 'Se inserta en la cara medial del ángulo mandibular. Eleva y ayuda a la lateralidad.',
            active: true,
            force: 80, // Newtons
            r: [-45, 25, -35],
            origin: [-15, 35, 0],
            default_r: [-45, 25, -35],
            default_origin: [-15, 35, 0],
            color: 0xff9100
        },
        {
            id: 'pterygoid-med-r',
            name: 'Pterigoideo Medial Der.',
            shortName: 'PM. Der',
            description: 'Se inserta en la cara medial del ángulo mandibular. Eleva y ayuda a la lateralidad.',
            active: true,
            force: 80, // Newtons
            r: [45, 25, -35],
            origin: [15, 35, 0],
            default_r: [45, 25, -35],
            default_origin: [15, 35, 0],
            color: 0xff9100
        }
    ]
};

// Initialize Web App
window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize UI Controls
    initUI(state, {
        onMuscleStateChange: (id, prop, val) => {
            const m = state.muscles.find(x => x.id === id);
            if (m) m[prop] = val;
            if (prop === 'force') {
                const fValHdr = document.getElementById(`val-${id}-force-hdr`);
                if (fValHdr) fValHdr.innerText = `${val} N`;
                const fVal = document.getElementById(`val-${id}-force`);
                if (fVal) fVal.innerText = val;
            }
            calculateAndRender();
        },
        onMuscleVectorChange: (id, prop, index, val) => {
            const m = state.muscles.find(x => x.id === id);
            if (m) m[prop][index] = val;
            const axisName = index === 0 ? 'x' : index === 1 ? 'y' : 'z';
            const displayEl = document.getElementById(`val-${id}-${prop}${axisName}`);
            if (displayEl) displayEl.innerText = val;
            calculateAndRender();
        },
        onJawWidthChange: (val) => {
            state.w = val / 2;
            adjustMuscleDimensions(state.w, state.L);
            updateBitePreset(state.bitePreset);
            calculateAndRender();
        },
        onJawLengthChange: (val) => {
            state.L = val;
            adjustMuscleDimensions(state.w, state.L);
            updateBitePreset(state.bitePreset);
            calculateAndRender();
        },
        onBitePresetChange: (val) => {
            updateBitePreset(val);
            calculateAndRender();
        },
        onBiteCoordChange: (axis, index, val) => {
            state.rB[index] = val;
            const selectEl = document.getElementById('bite-preset');
            if (selectEl) selectEl.value = 'custom';
            state.bitePreset = 'custom';
            calculateAndRender();
        },
        onBiteDirTypeChange: (val) => {
            state.biteDirectionType = val;
            const dirContainer = document.getElementById('bite-dir-container');
            if (val === 'free') {
                if (dirContainer) dirContainer.classList.remove('hidden');
                const ux = parseFloat(document.getElementById('input-ubx').value);
                const uy = parseFloat(document.getElementById('input-uby').value);
                const uz = parseFloat(document.getElementById('input-ubz').value);
                state.uB = vec.normalize([ux, uy, uz]);
            } else {
                if (dirContainer) dirContainer.classList.add('hidden');
                state.uB = [0, 0, -1];
            }
            calculateAndRender();
        },
        onBiteDirCompChange: (comp, index, val) => {
            state.uB[index] = val;
            state.uB = vec.normalize(state.uB);
            calculateAndRender();
        },
        onThemeToggle: (newTheme) => {
            state.theme = newTheme;
            updateClearColor(newTheme);
        }
    });

    // 2. Initialize ThreeJS Graphics Viewer
    initThreeJS('threejs-container', state, tick, (selectionData) => {
        handle3DSelection(selectionData);
    });

    // 3. Setup other general UI utilities
    initTooltips();
    initResizer(() => onWindowResize('threejs-container'));

    // 4. Initial calculations & KaTeX compiling
    calculateAndRender();
    if (typeof renderMathInElement !== 'undefined') {
        renderStaticMath();
    }
});

// Primary calculation and scene redraw loop
function calculateAndRender() {
    // 1. Solve the biomechanics
    const calcs = solveBiomechanics(state);

    // 2. Update KPI results displays in DOM
    const resFbMag = document.getElementById('res-fb-mag');
    if (resFbMag) resFbMag.innerHTML = `${Math.abs(calcs.FB).toFixed(1)} <span class="kpi-unit">N</span>`;
    
    const resFbVec = document.getElementById('res-fb-vector');
    if (resFbVec) resFbVec.innerText = `Vector: ${vec.format(calcs.FB_vector)} N`;
    
    const resFjlMag = document.getElementById('res-fjl-mag');
    if (resFjlMag) resFjlMag.innerHTML = `${vec.norm(calcs.F_JL).toFixed(1)} <span class="kpi-unit">N</span>`;
    
    const resFjlVec = document.getElementById('res-fjl-vector');
    if (resFjlVec) resFjlVec.innerText = `Vector: ${vec.format(calcs.F_JL)} N`;
    
    const resFjrMag = document.getElementById('res-fjr-mag');
    if (resFjrMag) resFjrMag.innerHTML = `${vec.norm(calcs.F_JR).toFixed(1)} <span class="kpi-unit">N</span>`;
    
    const resFjrVec = document.getElementById('res-fjr-vector');
    if (resFjrVec) resFjrVec.innerText = `Vector: ${vec.format(calcs.F_JR)} N`;
    
    const resMa = document.getElementById('res-ma');
    if (resMa) resMa.innerText = calcs.MA.toFixed(2);
    
    const resSumF = document.getElementById('res-total-input-force');
    if (resSumF) resSumF.innerText = `${calcs.sumActiveForcesScalar.toFixed(1)} N`;

    // 3. Render charts & mathematical outputs
    renderMuscleContributionChart(calcs.musclesComputed, calcs.sumActiveForcesScalar);
    renderPhysicalWarnings(calcs.FB, calcs.F_JL, calcs.F_JR, calcs.divideByZero, state.muscles);
    
    renderLaTeXSteps(
        calcs.musclesComputed,
        calcs.totalMuscleTorque,
        calcs.rB,
        state.uB,
        calcs.FB,
        calcs.FB_vector,
        calcs.denominator,
        calcs.F_net,
        calcs.tau_net,
        state.w,
        calcs.F_JL,
        calcs.F_JR,
        calcs.MA,
        calcs.sumActiveForcesScalar,
        state.biteDirectionType
    );

    // 4. Update the Three.js 3D viewer
    update3DScene(
        state.w,
        state.L,
        calcs.rB,
        calcs.musclesComputed,
        calcs.FB_vector,
        calcs.F_JL,
        calcs.F_JR,
        state.theta,
        state.theme
    );
}

// Tick updater run in the ThreeJS render frame
function tick() {
    if (state.isAnimating) {
        state.animationTime += 0.04;
        state.theta = 0.15 * (0.5 - 0.5 * Math.cos(state.animationTime));
        calculateAndRender();
    }
}

// Toggle play state of chewing animation
function togglePlayAnimation() {
    state.isAnimating = !state.isAnimating;
    const btn = document.getElementById('btn-play-sim');
    if (!btn) return;
    
    if (state.isAnimating) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausa';
        btn.style.background = '#eab308';
        btn.style.borderColor = '#ca8a04';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Simulación';
        btn.style.background = '';
        btn.style.borderColor = '';
        
        state.theta = 0;
        calculateAndRender();
    }
}

// Draggable Resizing proportionality calculators
function adjustMuscleDimensions(w, L) {
    const scaleX = w / 60;
    const scaleY = L / 100;
    const scaleZ = L / 100;
    
    state.muscles.forEach((m) => {
        m.r[0] = Math.round(m.default_r[0] * scaleX);
        m.r[1] = Math.round(m.default_r[1] * scaleY);
        m.r[2] = Math.round(m.default_r[2] * scaleZ);
        
        m.origin[0] = Math.round(m.default_origin[0] * scaleX);
        m.origin[1] = Math.round(m.default_origin[1] * scaleY);
        m.origin[2] = Math.round(m.default_origin[2] * scaleZ);
    });
    
    updateSlidersFromState(state.muscles);
}

function updateBitePreset(preset) {
    state.bitePreset = preset;
    const w = state.w;
    const L = state.L;
    
    switch (preset) {
        case 'incisors':
            state.rB = [0, L, -22];
            break;
        case 'premolar-left':
            state.rB = [Math.round(-0.25 * (w - 10)), Math.round(5 + 0.75 * L), -23];
            break;
        case 'premolar-right':
            state.rB = [Math.round(0.25 * (w - 10)), Math.round(5 + 0.75 * L), -23];
            break;
        case 'molar-left':
            state.rB = [Math.round(-0.5 * (w - 10)), Math.round(10 + 0.5 * L), -24];
            break;
        case 'molar-right':
            state.rB = [Math.round(0.5 * (w - 10)), Math.round(10 + 0.5 * L), -24];
            break;
        case 'custom':
            return;
    }
    
    const inputX = document.getElementById('input-xb');
    if (inputX) inputX.value = Math.round(state.rB[0]);
    const inputY = document.getElementById('input-yb');
    if (inputY) inputY.value = Math.round(state.rB[1]);
    const inputZ = document.getElementById('input-zb');
    if (inputZ) inputZ.value = Math.round(state.rB[2]);
}

// Coordinate 3D raycaster selection handling
function handle3DSelection(data) {
    if (data.type === 'muscle-origin' || data.type === 'muscle-line' || data.type === 'muscle-force') {
        const mId = data.id;
        window.toggleMuscleAccordion(mId);
        
        const el = document.getElementById(`muscle-config-${mId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            el.style.borderColor = 'var(--color-muscle)';
            setTimeout(() => { el.style.borderColor = ''; }, 1200);
        }
    } else if (data.type === 'bite-point' || data.type === 'bite-force') {
        const detailsEl = document.getElementById('details-bite');
        if (detailsEl) {
            detailsEl.open = true;
            detailsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            detailsEl.style.borderColor = 'var(--color-bite)';
            setTimeout(() => { detailsEl.style.borderColor = ''; }, 1200);
        }
    } else if (data.type === 'joint' || data.type === 'joint-reaction') {
        window.switchTab('tab-results');
        const kpi = document.querySelector('.joint-forces-grid');
        if (kpi) {
            kpi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            kpi.style.outline = '2px solid var(--color-joint-left)';
            kpi.style.borderRadius = 'var(--border-radius-md)';
            setTimeout(() => { kpi.style.outline = ''; }, 1200);
        }
    }
}

// Attach callbacks to global window scope so standard HTML elements can call them
window.switchTab = switchTab;
window.toggleTheoryModal = toggleTheoryModal;
window.setCameraPreset = (view) => setCameraPreset(view, state.L, state.w);
window.toggleAxes = toggleAxes;
window.togglePlayAnimation = togglePlayAnimation;
