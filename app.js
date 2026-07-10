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

// Vector Math Utilities
const vec = {
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

// Three.js visual objects references
let scene, camera, renderer, controls;
let jawMeshObjects = [];
let muscleVectorsObjects = [];
let biteVectorObject = null;
let jointVectorsObjects = [];
let staticBitePointMarker = null;
let axesHelper = null;

// Initialize Web App
window.addEventListener('DOMContentLoaded', () => {
    initUI();
    initThreeJS();
    initTooltips();
    initResizer();
    calculateAndRender();
    // Safety check in case script loaded earlier
    if (typeof renderMathInElement !== 'undefined') {
        renderStaticMath();
    }
});

// Setup dynamic UI components and event listeners
function initUI() {
    // Inject muscles into the control panel
    const container = document.getElementById('muscles-container');
    container.innerHTML = '';
    
    state.muscles.forEach((m, idx) => {
        const item = document.createElement('div');
        item.className = 'muscle-item-config';
        item.id = `muscle-config-${m.id}`;
        
        item.innerHTML = `
            <div class="muscle-header-row" onclick="toggleMuscleAccordion('${m.id}')">
                <div class="muscle-title">
                    <span class="muscle-indicator" style="background-color: rgb(${m.color === 0x00e676 ? '0,230,118' : m.color === 0x2979ff ? '41,121,255' : '255,145,0'})"></span>
                    <span>${m.name}</span>
                </div>
                <div class="muscle-header-actions-wrapper" style="display: flex; align-items: center; gap: 0.6rem;">
                    <div class="muscle-header-actions" onclick="event.stopPropagation()" style="display: flex; align-items: center; gap: 0.6rem;">
                        <span class="value-display" id="val-${m.id}-force-hdr" style="font-size: 0.8rem; margin-right: 0.5rem; font-weight:bold;">${m.force} N</span>
                        <label class="switch" data-tooltip="Activa o desactiva la contribución de fuerza de este músculo a la simulación.">
                            <input type="checkbox" id="check-${m.id}" ${m.active ? 'checked' : ''} onchange="updateMuscleState('${m.id}', 'active', this.checked)">
                            <span class="slider-switch"></span>
                        </label>
                    </div>
                    <i class="fa-solid fa-chevron-down muscle-details-toggle"></i>
                </div>
            </div>
            <div class="muscle-body">
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">${m.description}</p>
                <div class="input-row" data-tooltip="Fuerza contráctil máxima ejercida por el músculo. Se mide en Newtons (N).">
                    <label for="slide-${m.id}-force">Magnitud de Fuerza <span class="unit">(N)</span></label>
                    <div class="slider-container">
                        <input type="range" id="slide-${m.id}-force" min="0" max="300" value="${m.force}" oninput="updateMuscleState('${m.id}', 'force', parseFloat(this.value))">
                        <span class="value-display" id="val-${m.id}-force">${m.force}</span>
                    </div>
                </div>
                
                <!-- Insertion Sliders -->
                <div class="coordinate-slider-group">
                    <div class="coord-group-title">Inserción en Mandíbula <span class="unit">(mm)</span></div>
                    <div class="input-row sub-row" data-tooltip="Posición lateral del anclaje del músculo en el hueso mandibular (Eje X).">
                        <label>Eje X (Lateral): <span class="value-display" id="val-${m.id}-rx">${m.r[0]}</span></label>
                        <input type="range" id="slide-${m.id}-rx" min="-80" max="80" value="${m.r[0]}" step="1" oninput="updateMuscleVector('${m.id}', 'r', 0, parseFloat(this.value))">
                    </div>
                    <div class="input-row sub-row" data-tooltip="Posición anteroposterior del anclaje en la mandíbula (Eje Y, distancia del eje trasero).">
                        <label>Eje Y (Anteroposterior): <span class="value-display" id="val-${m.id}-ry">${m.r[1]}</span></label>
                        <input type="range" id="slide-${m.id}-ry" min="0" max="130" value="${m.r[1]}" step="1" oninput="updateMuscleVector('${m.id}', 'r', 1, parseFloat(this.value))">
                    </div>
                    <div class="input-row sub-row" data-tooltip="Altura vertical del anclaje en el cuerpo mandibular (Eje Z).">
                        <label>Eje Z (Vertical): <span class="value-display" id="val-${m.id}-rz">${m.r[2]}</span></label>
                        <input type="range" id="slide-${m.id}-rz" min="-60" max="60" value="${m.r[2]}" step="1" oninput="updateMuscleVector('${m.id}', 'r', 2, parseFloat(this.value))">
                    </div>
                </div>
                
                <!-- Origin Sliders -->
                <div class="coordinate-slider-group">
                    <div class="coord-group-title">Origen en Cráneo <span class="unit">(mm)</span></div>
                    <div class="input-row sub-row" data-tooltip="Posición lateral del anclaje del músculo en el cráneo (Eje X).">
                        <label>Eje X (Lateral): <span class="value-display" id="val-${m.id}-ox">${m.origin[0]}</span></label>
                        <input type="range" id="slide-${m.id}-ox" min="-80" max="80" value="${m.origin[0]}" step="1" oninput="updateMuscleVector('${m.id}', 'origin', 0, parseFloat(this.value))">
                    </div>
                    <div class="input-row sub-row" data-tooltip="Posición anteroposterior del anclaje en el cráneo (Eje Y, distancia del eje posterior).">
                        <label>Eje Y (Anteroposterior): <span class="value-display" id="val-${m.id}-oy">${m.origin[1]}</span></label>
                        <input type="range" id="slide-${m.id}-oy" min="0" max="130" value="${m.origin[1]}" step="1" oninput="updateMuscleVector('${m.id}', 'origin', 1, parseFloat(this.value))">
                    </div>
                    <div class="input-row sub-row" data-tooltip="Altura vertical de la inserción del músculo en el cráneo (Eje Z).">
                        <label>Eje Z (Vertical): <span class="value-display" id="val-${m.id}-oz">${m.origin[2]}</span></label>
                        <input type="range" id="slide-${m.id}-oz" min="-60" max="100" value="${m.origin[2]}" step="1" oninput="updateMuscleVector('${m.id}', 'origin', 2, parseFloat(this.value))">
                    </div>
                </div>
            </div>
        `;
        container.appendChild(item);
    });

    // Theme Toggle Listener
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const body = document.body;
        if (body.classList.contains('dark-mode')) {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
            state.theme = 'light';
            document.getElementById('theme-toggle').innerHTML = '<i class="fa-solid fa-moon"></i>';
            if (renderer) renderer.setClearColor(0xf0f4f9);
        } else {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
            state.theme = 'dark';
            document.getElementById('theme-toggle').innerHTML = '<i class="fa-solid fa-sun"></i>';
            if (renderer) renderer.setClearColor(0x0b0f19);
        }
    });

    // Mandible Geometry Input Listeners
    document.getElementById('input-jaw-width').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.w = val / 2;
        document.getElementById('val-jaw-width').innerText = val;
        // Adjust muscles and bite point to maintain anatomical proportion
        adjustMuscleDimensions(state.w, state.L);
        updateBitePreset(state.bitePreset);
        calculateAndRender();
    });

    document.getElementById('input-jaw-length').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.L = val;
        document.getElementById('val-jaw-length').innerText = val;
        // Adjust muscles and bite point to maintain anatomical proportion
        adjustMuscleDimensions(state.w, state.L);
        updateBitePreset(state.bitePreset);
        calculateAndRender();
    });

    // Bite Presets Dropdown Listener
    document.getElementById('bite-preset').addEventListener('change', (e) => {
        updateBitePreset(e.target.value);
        calculateAndRender();
    });

    // Bite Custom coordinate listener inputs
    ['xb', 'yb', 'zb'].forEach((axis, index) => {
        document.getElementById(`input-${axis}`).addEventListener('change', (e) => {
            state.rB[index] = parseFloat(e.target.value);
            document.getElementById('bite-preset').value = 'custom';
            state.bitePreset = 'custom';
            calculateAndRender();
        });
    });

    // Bite Direction Selector Listener
    document.getElementById('bite-direction-type').addEventListener('change', (e) => {
        const type = e.target.value;
        state.biteDirectionType = type;
        const dirContainer = document.getElementById('bite-dir-container');
        
        if (type === 'free') {
            dirContainer.classList.remove('hidden');
            // Populate values from input elements
            state.uB[0] = parseFloat(document.getElementById('input-ubx').value);
            state.uB[1] = parseFloat(document.getElementById('input-uby').value);
            state.uB[2] = parseFloat(document.getElementById('input-ubz').value);
            state.uB = vec.normalize(state.uB);
        } else {
            dirContainer.classList.add('hidden');
            state.uB = [0, 0, -1];
        }
        calculateAndRender();
    });

    // Free direction coordinates manual inputs
    ['ubx', 'uby', 'ubz'].forEach((comp, idx) => {
        document.getElementById(`input-${comp}`).addEventListener('change', (e) => {
            state.uB[idx] = parseFloat(e.target.value);
            state.uB = vec.normalize(state.uB);
            calculateAndRender();
        });
    });
}

// Proportionally scale muscle insertion (r) and skull origin coordinates relative to base jaw width/length
function adjustMuscleDimensions(w, L) {
    const scaleX = w / 60;
    const scaleY = L / 100;
    const scaleZ = L / 100; // Vertical depth scales proportionally to jaw length
    
    state.muscles.forEach((m) => {
        m.r[0] = Math.round(m.default_r[0] * scaleX);
        m.r[1] = Math.round(m.default_r[1] * scaleY);
        m.r[2] = Math.round(m.default_r[2] * scaleZ);
        
        m.origin[0] = Math.round(m.default_origin[0] * scaleX);
        m.origin[1] = Math.round(m.default_origin[1] * scaleY);
        m.origin[2] = Math.round(m.default_origin[2] * scaleZ);
        
        // Update slider values and displays in the UI
        ['rx', 'ry', 'rz'].forEach((axis, idx) => {
            const slider = document.getElementById(`slide-${m.id}-${axis}`);
            if (slider) slider.value = m.r[idx];
            const display = document.getElementById(`val-${m.id}-${axis}`);
            if (display) display.innerText = m.r[idx];
        });
        
        ['ox', 'oy', 'oz'].forEach((axis, idx) => {
            const slider = document.getElementById(`slide-${m.id}-${axis}`);
            if (slider) slider.value = m.origin[idx];
            const display = document.getElementById(`val-${m.id}-${axis}`);
            if (display) display.innerText = m.origin[idx];
        });
    });
}

// Compute bite coordinates precisely sitting on top of the anatomical teeth curve (relative to w, L)
function updateBitePreset(preset) {
    state.bitePreset = preset;
    const w = state.w;
    const L = state.L;
    
    // Teeth lie on parabolas connecting angles to symphysis (chin).
    // Interpolated positions match the dental arch in the 3D Viewport.
    switch (preset) {
        case 'incisors':
            // Symphysis chin dentition (t = 1.0)
            state.rB = [0, L, -22];
            break;
        case 'premolar-left':
            // Premolar mid-arch left (t = 0.75)
            state.rB = [Math.round(-0.25 * (w - 10)), Math.round(5 + 0.75 * L), -23];
            break;
        case 'premolar-right':
            // Premolar mid-arch right (t = 0.75)
            state.rB = [Math.round(0.25 * (w - 10)), Math.round(5 + 0.75 * L), -23];
            break;
        case 'molar-left':
            // Molar back left (t = 0.5)
            state.rB = [Math.round(-0.5 * (w - 10)), Math.round(10 + 0.5 * L), -24];
            break;
        case 'molar-right':
            // Molar back right (t = 0.5)
            state.rB = [Math.round(0.5 * (w - 10)), Math.round(10 + 0.5 * L), -24];
            break;
        case 'custom':
            // Keep current custom user coordinates
            return;
    }
    
    // Sync to coordinate UI textboxes
    document.getElementById('input-xb').value = Math.round(state.rB[0]);
    document.getElementById('input-yb').value = Math.round(state.rB[1]);
    document.getElementById('input-zb').value = Math.round(state.rB[2]);
}

function toggleMuscleAccordion(id) {
    const el = document.getElementById(`muscle-config-${id}`);
    const isOpen = el.classList.contains('open');
    
    // Close other panels (optional but clean)
    document.querySelectorAll('.muscle-item-config').forEach(item => {
        item.classList.remove('open');
    });
    
    if (!isOpen) {
        el.classList.add('open');
    }
}

function updateMuscleState(id, prop, val) {
    const m = state.muscles.find(x => x.id === id);
    if (!m) return;
    
    m[prop] = val;
    
    if (prop === 'force') {
        document.getElementById(`val-${id}-force`).innerText = val;
        document.getElementById(`val-${id}-force-hdr`).innerText = `${val} N`;
    }
    
    calculateAndRender();
}

function updateMuscleVector(id, prop, index, val) {
    const m = state.muscles.find(x => x.id === id);
    if (!m) return;
    
    m[prop][index] = val;
    
    // Update value display text in DOM
    const axisName = index === 0 ? 'x' : index === 1 ? 'y' : 'z';
    const displayId = `val-${id}-${prop}${axisName}`;
    const displayEl = document.getElementById(displayId);
    if (displayEl) {
        displayEl.innerText = val;
    }
    
    calculateAndRender();
}

function switchTab(tabId, targetTermId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Set active button
    const btnId = `btn-${tabId}`;
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.add('active');
    }
    
    const content = document.getElementById(tabId);
    if (content) {
        content.classList.add('active');
    }
    
    // If a target term was requested, scroll to it inside the scrollable container and highlight it
    if (targetTermId) {
        setTimeout(() => {
            const targetEl = document.getElementById(targetTermId);
            if (targetEl) {
                const container = targetEl.closest('.glossary-list');
                if (container) {
                    container.scrollTo({
                        top: targetEl.offsetTop - container.offsetTop - 10,
                        behavior: 'smooth'
                    });
                } else {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                // Add a brief glow effect
                targetEl.classList.add('glow-highlight');
                setTimeout(() => {
                    targetEl.classList.remove('glow-highlight');
                }, 2000);
            }
        }, 100);
    }
}

// -------------------------------------------------------------
// THREE.JS GRAPHICS ENVIRONMENT SETUP
// -------------------------------------------------------------
function initThreeJS() {
    const container = document.getElementById('threejs-container');
    const width = container.clientWidth;
    const height = container.clientHeight || 450; // Fallback
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(state.theme === 'dark' ? 0x0b0f19 : 0xf0f4f9);
    
    // Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(0, 80, 180);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, -15, 50);
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Limit below ground looking up too much
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(100, 200, 50);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-100, 100, -50);
    scene.add(fillLight);
    
    // Grid Helper & Hinge Axis Line
    const grid = new THREE.GridHelper(300, 30, 0x3b82f6, 0x1e293b);
    grid.position.y = -45;
    scene.add(grid);
    
    // Add X, Y, Z Coordinate Axes on the floor
    // Size is 100mm, thickness and colors are Three.js default (X=Red, Y=Green, Z=Blue)
    axesHelper = new THREE.AxesHelper(100);
    axesHelper.position.set(0, -45, 0); // Position on the floor/grid level
    scene.add(axesHelper);
    
    // Start Animation Loop
    animate();
    
    // Resize Listener
    window.addEventListener('resize', onWindowResize);
    
    // Initialize Raycaster interaction
    initRaycasting();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    if (state.isAnimating) {
        state.animationTime += 0.04;
        // Cosine-based opening angle: oscillates between 0 (closed) and 0.15 rad (open, ~8.6 degrees)
        state.theta = 0.15 * (0.5 - 0.5 * Math.cos(state.animationTime));
        calculateAndRender();
    }
    
    renderer.render(scene, camera);
}

// Toggle Play/Pause of the chewing simulation animation
function togglePlayAnimation() {
    state.isAnimating = !state.isAnimating;
    const btn = document.getElementById('btn-play-sim');
    if (!btn) return;
    
    if (state.isAnimating) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausa';
        btn.style.background = '#eab308'; // Tailwind yellow-500
        btn.style.borderColor = '#ca8a04';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Simulación';
        btn.style.background = ''; // restore css styles
        btn.style.borderColor = '';
        
        // Return to closed jaw position on pause
        state.theta = 0;
        calculateAndRender();
    }
}

function onWindowResize() {
    const container = document.getElementById('threejs-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

function setCameraPreset(view) {
    const L = state.L;
    const w = state.w;
    const rScale = L / 100;
    
    controls.target.set(0, -15 * rScale, L / 2);
    
    switch (view) {
        case 'front':
            camera.position.set(0, 30 * rScale, L + Math.max(w * 1.5, L * 1.2));
            break;
        case 'side':
            camera.position.set(Math.max(w * 2.2, L * 1.6), 10 * rScale, L / 2);
            break;
        case 'top':
            camera.position.set(0.1, Math.max(w * 2.5, L * 2.0), L / 2);
            break;
        case 'iso':
        default:
            camera.position.set(Math.max(w * 1.8, L * 1.3), 80 * rScale, L + 80 * rScale);
            break;
    }
}

// -------------------------------------------------------------
// BIOMECHANICS COMPUTATION ENGINE & RENDERING INTERACTION
// -------------------------------------------------------------
function calculateAndRender() {
    // 1. Gather geometries
    const w = state.w;
    const L = state.L;
    const theta = state.theta || 0;
    
    // Rotate bite point in anatomical space
    const rB = vec.rotateX(state.rB, theta);
    const uB = state.uB;
    
    // 2. Compute Muscle Forces & Torques
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
        // tau_i = r_i x F_i
        const tau_i = vec.cross(r_rotated, F_i);
        
        // Accumulate
        totalMuscleTorque = vec.add(totalMuscleTorque, tau_i);
        sumActiveForcesScalar += m.force;
        sumActiveForcesVector = vec.add(sumActiveForcesVector, F_i);
        
        // Save computed values
        // Important: we pass the rotated insertion point inside 'm.r' so that
        // the 3D drawing routines and tooltips represent the rotated state!
        const mCopy = { ...m, r: r_rotated };
        musclesComputed.push({
            m: mCopy,
            u_i,
            F_i,
            tau_i
        });
    });
    
    const T_x = totalMuscleTorque[0];
    const T_y = totalMuscleTorque[1];
    const T_z = totalMuscleTorque[2];
    
    // 3. Solve Bite Force (F_B)
    const xB = rB[0];
    const yB = rB[1];
    const zB = rB[2];
    
    const uBx = uB[0];
    const uBy = uB[1];
    const uBz = uB[2];
    
    // Denominator of the division
    const denominator = yB * uBz - zB * uBy;
    
    let FB = 0;
    let FB_vector = [0, 0, 0];
    let biteTorque = [0, 0, 0];
    let divideByZero = false;
    
    // Only solve bite force if the mouth is closed (theta <= 0.005)
    if (theta <= 0.005) {
        if (Math.abs(denominator) > 1e-5) {
            FB = -T_x / denominator;
            FB_vector = vec.scale(uB, FB);
            biteTorque = vec.cross(rB, FB_vector);
        } else {
            divideByZero = true;
        }
    } else {
        // Mouth is open, food is not contactable -> bite force is 0!
        FB = 0;
        FB_vector = [0, 0, 0];
        biteTorque = [0, 0, 0];
    }
    
    // 4. Solve Joint Reaction Forces (F_JL, F_JR)
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
    
    // 5. Global Mechanical Advantage
    const MA = sumActiveForcesScalar > 0 ? Math.abs(FB) / sumActiveForcesScalar : 0;
    
    // 6. Sync results panel values
    document.getElementById('res-fb-mag').innerHTML = `${Math.abs(FB).toFixed(1)} <span class="kpi-unit">N</span>`;
    document.getElementById('res-fb-vector').innerText = `Vector: ${vec.format(FB_vector)} N`;
    
    document.getElementById('res-ma').innerText = MA.toFixed(2);
    
    document.getElementById('res-fjl-mag').innerHTML = `${vec.norm(F_JL).toFixed(1)} <span class="kpi-unit">N</span>`;
    document.getElementById('res-fjl-vector').innerText = `Vector: ${vec.format(F_JL)} N`;
    
    document.getElementById('res-fjr-mag').innerHTML = `${vec.norm(F_JR).toFixed(1)} <span class="kpi-unit">N</span>`;
    document.getElementById('res-fjr-vector').innerText = `Vector: ${vec.format(F_JR)} N`;
    
    document.getElementById('res-total-input-force').innerText = `${sumActiveForcesScalar.toFixed(1)} N`;
    
    // 7. Render dynamic muscle contribution bar chart
    renderMuscleContributionChart(musclesComputed, sumActiveForcesScalar);
    
    // 8. Physical Integrity Warnings
    renderPhysicalWarnings(FB, F_JL, F_JR, divideByZero);
    
    // 9. Update math LaTeX cards in Tab 2
    renderLaTeXSteps(musclesComputed, totalMuscleTorque, rB, uB, FB, FB_vector, denominator, F_net, tau_net, w, F_JL, F_JR, MA, sumActiveForcesScalar);

    // 10. Update 3D visual representations
    update3DScene(w, L, rB, musclesComputed, FB_vector, F_JL, F_JR);
}

// Render dynamic horizontal bars for active muscle proportions
function renderMuscleContributionChart(musclesComputed, sumActiveForcesScalar) {
    const container = document.getElementById('muscle-bar-chart');
    container.innerHTML = '';
    
    if (musclesComputed.length === 0) {
        container.innerHTML = `<p style="font-size: 0.8rem; text-align: center; color: var(--text-muted); padding: 1rem 0;">Ningún músculo está activo.</p>`;
        return;
    }
    
    musclesComputed.forEach(({ m }) => {
        const pct = sumActiveForcesScalar > 0 ? (m.force / sumActiveForcesScalar) * 100 : 0;
        const bar = document.createElement('div');
        bar.className = 'chart-bar-wrapper';
        bar.innerHTML = `
            <div class="chart-bar-labels">
                <span class="chart-bar-name">${m.name}</span>
                <span class="chart-bar-val">${m.force.toFixed(0)} N (${pct.toFixed(0)}%)</span>
            </div>
            <div class="chart-bar-outer">
                <div class="chart-bar-inner" style="width: ${pct}%; background: linear-gradient(90deg, rgb(${m.color === 0x00e676 ? '0,230,118' : m.color === 0x2979ff ? '41,121,255' : '255,145,0'}), var(--color-primary))"></div>
            </div>
        `;
        container.appendChild(bar);
    });
}

// Highlight structural issues or mechanical alerts
function renderPhysicalWarnings(FB, F_JL, F_JR, divideByZero) {
    const container = document.getElementById('physical-warnings');
    container.innerHTML = '';
    
    if (divideByZero) {
        container.innerHTML += `
            <div class="alert-box danger">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span><strong>Error del Sistema:</strong> La dirección de mordida seleccionada es paralela a los brazos de palanca, haciendo que el torque resultante sea nulo. No se puede calcular una mordida de reacción equilibrada. Modifique el vector de dirección.</span>
            </div>
        `;
        return;
    }
    
    // Dynamic alerts
    if (FB < 0) {
        container.innerHTML += `
            <div class="alert-box warning">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span><strong>Fuerza Invertida:</strong> Los vectores musculares están jalando de tal forma que la mandíbula se "abriría" contra el vector de mordida en lugar de cerrarse. Revise que las fuerzas musculares tengan dirección ascendente (+Z).</span>
            </div>
        `;
    }
    
    // ATM structural tension warning: TMJ loading exceeds bite force
    const maxJoint = Math.max(vec.norm(F_JL), vec.norm(F_JR));
    if (maxJoint > Math.abs(FB) && Math.abs(FB) > 5) {
        container.innerHTML += `
            <div class="alert-box note">
                <i class="fa-solid fa-circle-info"></i>
                <span><strong>Carga Articular Alta:</strong> La carga en la ATM (${maxJoint.toFixed(0)} N) supera la fuerza de mordida útil. Esto ocurre típicamente al morder muy hacia delante (incisivos), donde la ventaja mecánica es muy baja.</span>
            </div>
        `;
    }
    
    // Side asymmetry warning
    const lForce = state.muscles.filter(m => m.active && m.id.endsWith('-l')).reduce((acc, m) => acc + m.force, 0);
    const rForce = state.muscles.filter(m => m.active && m.id.endsWith('-r')).reduce((acc, m) => acc + m.force, 0);
    if (Math.abs(lForce - rForce) > 50) {
        container.innerHTML += `
            <div class="alert-box warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span><strong>Asimetría Muscular Alta:</strong> Hay un desequilibrio de ${Math.abs(lForce - rForce).toFixed(0)} N entre el lado izquierdo y derecho. Esto generará fuerzas de reacción asimétricas en la ATM y una torsión lateral en la mandíbula.</span>
            </div>
        `;
    }
}

// Dynamic LaTeX formulas generation using KaTeX
function renderLaTeXSteps(muscles, totalTorque, rB, uB, FB, FB_vec, denominator, F_net, tau_net, w, F_JL, F_JR, MA, sumActiveForces) {
    if (typeof katex === 'undefined') return; // Fail-soft if CDN didn't load
    
    // Step 1: Muscle Forces
    let htmlStep1 = '';
    if (muscles.length === 0) {
        htmlStep1 = '\\text{Ningún músculo activo.}';
    } else {
        htmlStep1 = '\\begin{aligned}';
        muscles.forEach(({ m, u_i, F_i }) => {
            const rx = m.r[0], ry = m.r[1], rz = m.r[2];
            const ox = m.origin[0], oy = m.origin[1], oz = m.origin[2];
            const dx = ox - rx;
            const dy = oy - ry;
            const dz = oz - rz;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            htmlStep1 += `\\vec{d}_{\\text{${m.shortName}}} &= [${ox}, ${oy}, ${oz}]^T - [${rx}, ${ry}, ${rz}]^T = [${dx}, ${dy}, ${dz}]^T \\text{ mm} \\\\`;
            htmlStep1 += `\\|\\vec{d}_{\\text{${m.shortName}}}\\| &= \\sqrt{(${dx})^2 + (${dy})^2 + (${dz})^2} = ${dist.toFixed(1)}\\text{ mm} \\\\`;
            htmlStep1 += `\\hat{u}_{\\text{${m.shortName}}} &= \\frac{\\vec{d}_{\\text{${m.shortName}}}}{\\|\\vec{d}_{\\text{${m.shortName}}}\\|} = \\frac{[${dx}, ${dy}, ${dz}]^T}{${dist.toFixed(1)}} = [${u_i[0].toFixed(3)}, ${u_i[1].toFixed(3)}, ${u_i[2].toFixed(3)}]^T \\\\`;
            htmlStep1 += `\\vec{F}_{\\text{${m.shortName}}} &= ${m.force}\\text{ N} \\cdot \\hat{u}_{\\text{${m.shortName}}} = ${m.force}\\text{ N} \\cdot [${u_i[0].toFixed(3)}, ${u_i[1].toFixed(3)}, ${u_i[2].toFixed(3)}]^T \\\\`;
            htmlStep1 += `&= [${m.force} \\cdot ${u_i[0].toFixed(3)}, ${m.force} \\cdot ${u_i[1].toFixed(3)}, ${m.force} \\cdot ${u_i[2].toFixed(3)}]^T \\\\`;
            htmlStep1 += `&= [${F_i[0].toFixed(1)}, ${F_i[1].toFixed(1)}, ${F_i[2].toFixed(1)}]^T \\text{ N} \\\\[0.8em]`;
        });
        htmlStep1 += '\\end{aligned}';
    }
    katex.render(htmlStep1, document.getElementById('math-step-1'), { displayMode: true, throwOnError: false });
    
    // Step 2: Individual and total muscle torques
    let htmlStep2 = '';
    if (muscles.length === 0) {
        htmlStep2 = '\\vec{\\tau}_{\\text{músculos}} = [0, 0, 0]^T \\text{ N}\\cdot\\text{mm}';
    } else {
        htmlStep2 = '\\begin{aligned}';
        muscles.forEach(({ m, F_i, tau_i }) => {
            const rx = m.r[0], ry = m.r[1], rz = m.r[2];
            const fx = F_i[0], fy = F_i[1], fz = F_i[2];
            
            htmlStep2 += `\\vec{\\tau}_{\\text{${m.shortName}}} &= \\vec{r}_{\\text{${m.shortName}}} \\times \\vec{F}_{\\text{${m.shortName}}} \\\\`;
            htmlStep2 += `&= [${rx}, ${ry}, ${rz}]^T \\times [${fx.toFixed(1)}, ${fy.toFixed(1)}, ${fz.toFixed(1)}]^T \\\\`;
            htmlStep2 += `&= \\begin{bmatrix} (${ry}) \\cdot (${fz.toFixed(1)}) - (${rz}) \\cdot (${fy.toFixed(1)}) \\\\ (${rz}) \\cdot (${fx.toFixed(1)}) - (${rx}) \\cdot (${fz.toFixed(1)}) \\\\ (${rx}) \\cdot (${fy.toFixed(1)}) - (${ry}) \\cdot (${fx.toFixed(1)}) \\end{bmatrix} \\\\`;
            htmlStep2 += `&= [${tau_i[0].toFixed(0)}, ${tau_i[1].toFixed(0)}, ${tau_i[2].toFixed(0)}]^T \\text{ N}\\cdot\\text{mm} \\\\[0.8em]`;
        });
        htmlStep2 += `\\vec{\\tau}_{\\text{músculos}} &= \\sum \\vec{\\tau}_i = \\mathbf{[${totalTorque[0].toFixed(0)}, ${totalTorque[1].toFixed(0)}, ${totalTorque[2].toFixed(0)}]^T} \\text{ N}\\cdot\\text{mm}`;
        htmlStep2 += '\\end{aligned}';
    }
    katex.render(htmlStep2, document.getElementById('math-step-2'), { displayMode: true, throwOnError: false });
    
    // Step 3: Bite Force solving
    const expDiv = document.getElementById('math-step-3-explanation');
    let htmlStep3 = '';
    if (state.biteDirectionType === 'vertical-down') {
        expDiv.innerHTML = `<p>Dado que asumimos una reacción vertical hacia abajo en la mandíbula (\\\\(u_B = [0, 0, -1]^T\\\\)), el <a class="glossary-link" onclick="switchTab('tab-glossary', 'term-torque')">torque</a> de mordida es \\\\(\\\\vec{\\tau}_B = [y_B F_{Bz}, -x_B F_{Bz}, 0]^T\\\\) (calculado mediante el <a class="glossary-link" onclick="switchTab('tab-glossary', 'term-cross')">producto cruz</a>). El <a class="glossary-link" onclick="switchTab('tab-glossary', 'term-static')">equilibrio estático</a> sobre el eje X exige:</p>`;
        
        htmlStep3 = `\\begin{aligned}`;
        htmlStep3 += `y_B \\cdot F_{Bz} &= -T_x \\\\`;
        htmlStep3 += `${rB[1]}\\text{ mm} \\cdot F_{Bz} &= -(${totalTorque[0].toFixed(0)}\\text{ N}\\cdot\\text{mm}) \\\\`;
        htmlStep3 += `F_{Bz} &= \\frac{-${totalTorque[0].toFixed(0)}}{${rB[1]}} = \\mathbf{${FB_vec[2].toFixed(1)}\\text{ N}} \\\\[0.8em]`;
        htmlStep3 += `\\vec{F}_B &= F_{Bz} \\cdot \\hat{u}_B = [0.0, 0.0, ${FB_vec[2].toFixed(1)}]^T \\text{ N} \\quad (\\|\\vec{F}_B\\| = ${Math.abs(FB).toFixed(1)}\\text{ N})`;
        htmlStep3 += `\\end{aligned}`;
    } else {
        expDiv.innerHTML = `<p>Para una dirección de reacción libre definida por el <a class="glossary-link" onclick="switchTab('tab-glossary', 'term-unitvector')">vector unitario</a> de mordida \\\\(\\\\hat{u}_B = [${uB[0].toFixed(2)}, ${uB[1].toFixed(2)}, ${uB[2].toFixed(2)}]^T\\\\):</p>`;
        
        htmlStep3 = `\\begin{aligned}`;
        htmlStep3 += `F_B &= \\frac{-T_x}{y_B u_{Bz} - z_B u_{By}} \\\\`;
        htmlStep3 += `F_B &= \\frac{-(${totalTorque[0].toFixed(0)})}{${rB[1]} \\cdot (${uBz.toFixed(2)}) - (${rB[2]}) \\cdot (${uBy.toFixed(2)})} \\\\`;
        htmlStep3 += `F_B &= \\frac{-${totalTorque[0].toFixed(0)}}{${denominator.toFixed(2)}} = \\mathbf{${FB.toFixed(1)}\\text{ N}} \\\\[0.8em]`;
        htmlStep3 += `\\vec{F}_B &= F_B \\cdot \\hat{u}_B = ${FB.toFixed(1)}\\text{ N} \\cdot [${uBx.toFixed(2)}, ${uBy.toFixed(2)}, ${uBz.toFixed(2)}]^T \\\\`;
        htmlStep3 += `&= [${FB.toFixed(1)} \\cdot ${uBx.toFixed(2)}, ${FB.toFixed(1)} \\cdot ${uBy.toFixed(2)}, ${FB.toFixed(1)} \\cdot ${uBz.toFixed(2)}]^T \\\\`;
        htmlStep3 += `&= [${FB_vec[0].toFixed(1)}, ${FB_vec[1].toFixed(1)}, ${FB_vec[2].toFixed(1)}]^T \\text{ N} \\quad (\\|\\vec{F}_B\\| = ${Math.abs(FB).toFixed(1)}\\text{ N})`;
        htmlStep3 += `\\end{aligned}`;
    }

    // Render inline equations in the explanation block
    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(expDiv, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
        });
    }
    
    katex.render(htmlStep3, document.getElementById('math-step-3'), { displayMode: true, throwOnError: false });
    
    // Step 4: Joint Forces
    let sumF_muscles = [0, 0, 0];
    let sumTau_muscles = [0, 0, 0];
    muscles.forEach(({ F_i, tau_i }) => {
        sumF_muscles = vec.add(sumF_muscles, F_i);
        sumTau_muscles = vec.add(sumTau_muscles, tau_i);
    });

    const biteTorque = vec.cross(rB, FB_vec);
    const termY = tau_net[1] / w;
    const termZ = tau_net[2] / w;

    let htmlStep4 = `\\begin{aligned}`;
    htmlStep4 += `\\vec{F}_{\\text{net}} &= -\\vec{F}_B - \\sum \\vec{F}_i \\\\`;
    htmlStep4 += `&= -[${FB_vec[0].toFixed(1)}, ${FB_vec[1].toFixed(1)}, ${FB_vec[2].toFixed(1)}]^T - [${sumF_muscles[0].toFixed(1)}, ${sumF_muscles[1].toFixed(1)}, ${sumF_muscles[2].toFixed(1)}]^T \\\\`;
    htmlStep4 += `&= [${F_net[0].toFixed(1)}, ${F_net[1].toFixed(1)}, ${F_net[2].toFixed(1)}]^T \\text{ N} \\\\[0.6em]`;
    
    htmlStep4 += `\\vec{\\tau}_{\\text{net}} &= -\\vec{\\tau}_B - \\sum \\vec{\\tau}_i \\\\`;
    htmlStep4 += `&= -[${biteTorque[0].toFixed(0)}, ${biteTorque[1].toFixed(0)}, ${biteTorque[2].toFixed(0)}]^T - [${sumTau_muscles[0].toFixed(0)}, ${sumTau_muscles[1].toFixed(0)}, ${sumTau_muscles[2].toFixed(0)}]^T \\\\`;
    htmlStep4 += `&= [${tau_net[0].toFixed(0)}, ${tau_net[1].toFixed(0)}, ${tau_net[2].toFixed(0)}]^T \\text{ N}\\cdot\\text{mm} \\quad (w = ${w}\\text{ mm}) \\\\[0.8em]`;
    
    htmlStep4 += `F_{JRz} &= 0.5 \\cdot \\left(${F_net[2].toFixed(1)} + \\frac{${tau_net[1].toFixed(0)}}{${w}}\\right) = 0.5 \\cdot (${F_net[2].toFixed(1)} + ${termY.toFixed(1)}) = \\mathbf{${F_JR[2].toFixed(1)}\\text{ N}} \\\\`;
    htmlStep4 += `F_{JLz} &= 0.5 \\cdot \\left(${F_net[2].toFixed(1)} - \\frac{${tau_net[1].toFixed(0)}}{${w}}\\right) = 0.5 \\cdot (${F_net[2].toFixed(1)} - ${termY.toFixed(1)}) = \\mathbf{${F_JL[2].toFixed(1)}\\text{ N}} \\\\[0.5em]`;
    
    htmlStep4 += `F_{JLy} &= 0.5 \\cdot \\left(${F_net[1].toFixed(1)} + \\frac{${tau_net[2].toFixed(0)}}{${w}}\\right) = 0.5 \\cdot (${F_net[1].toFixed(1)} + ${termZ.toFixed(1)}) = \\mathbf{${F_JL[1].toFixed(1)}\\text{ N}} \\\\`;
    htmlStep4 += `F_{JRy} &= 0.5 \\cdot \\left(${F_net[1].toFixed(1)} - \\frac{${tau_net[2].toFixed(0)}}{${w}}\\right) = 0.5 \\cdot (${F_net[1].toFixed(1)} - ${termZ.toFixed(1)}) = \\mathbf{${F_JR[1].toFixed(1)}\\text{ N}} \\\\[0.5em]`;
    
    htmlStep4 += `F_{JLx} &= F_{JRx} = 0.5 \\cdot (${F_net[0].toFixed(1)}) = \\mathbf{${F_JL[0].toFixed(1)}\\text{ N}} \\\\[0.8em]`;
    
    htmlStep4 += `\\vec{F}_{JL} &= [${F_JL[0].toFixed(1)}, ${F_JL[1].toFixed(1)}, ${F_JL[2].toFixed(1)}]^T \\text{ N} \\\\`;
    htmlStep4 += `\\vec{F}_{JR} &= [${F_JR[0].toFixed(1)}, ${F_JR[1].toFixed(1)}, ${F_JR[2].toFixed(1)}]^T \\text{ N}`;
    htmlStep4 += `\\end{aligned}`;
    
    katex.render(htmlStep4, document.getElementById('math-step-4'), { displayMode: true, throwOnError: false });
    
    // Step 5: Mechanical Advantage
    let htmlStep5 = `\\begin{aligned}`;
    htmlStep5 += `MA_{\\text{global}} &= \\frac{\\|\\vec{F}_B\\|}{\\sum F_i} = \\frac{${Math.abs(FB).toFixed(1)}\\text{ N}}{${sumActiveForces.toFixed(0)}\\text{ N}} = \\mathbf{${MA.toFixed(2)}}`;
    htmlStep5 += `\\end{aligned}`;
    
    katex.render(htmlStep5, document.getElementById('math-step-5'), { displayMode: true, throwOnError: false });
}

// -------------------------------------------------------------
// THREE.JS SCENE DYNAMIC REDRAW LOOP
function update3DScene(w, L, rB, muscles, FB_vector, F_JL, F_JR) {
    if (!scene) return;
    
    // 1. Clear previous dynamic objects
    jawMeshObjects.forEach(obj => scene.add(obj)); // Preserve base if persistent, else re-create
    jawMeshObjects.forEach(obj => scene.remove(obj));
    jawMeshObjects = [];
    
    muscleVectorsObjects.forEach(obj => scene.remove(obj));
    muscleVectorsObjects = [];
    
    if (biteVectorObject) {
        scene.remove(biteVectorObject);
        biteVectorObject = null;
    }
    
    jointVectorsObjects.forEach(obj => scene.remove(obj));
    jointVectorsObjects = [];
    
    if (staticBitePointMarker) {
        scene.remove(staticBitePointMarker);
        staticBitePointMarker = null;
    }
    
    // Proportional scaling factor for 3D elements based on mandible length L
    const rScale = L / 100;
    
    // Helper to map anatomical (X: lateral, Y: anteroposterior, Z: vertical)
    // to Three.js (X: lateral, Y: vertical, Z: anteroposterior)
    const toThreeVec = (v) => new THREE.Vector3(v[0], v[2], v[1]);
    
    // 2. Re-create Mandible geometric model (V-shape)
    // Primary nodes scaled proportionally to width and length:
    const theta = state.theta || 0;
    
    const leftCondyleAnat = [-w, 0, 0];
    const rightCondyleAnat = [w, 0, 0];
    
    const leftAngleAnat = vec.rotateX([-w + 10 * rScale, 20 * rScale, -35 * rScale], theta);
    const rightAngleAnat = vec.rotateX([w - 10 * rScale, 20 * rScale, -35 * rScale], theta);
    
    const coronoidLeftAnat = vec.rotateX([-w + 15 * rScale, 30 * rScale, 10 * rScale], theta);
    const coronoidRightAnat = vec.rotateX([w - 15 * rScale, 30 * rScale, 10 * rScale], theta);
    
    const symphysisAnat = vec.rotateX([0, L, -30 * rScale], theta);
    
    const leftCondyle = toThreeVec(leftCondyleAnat);
    const rightCondyle = toThreeVec(rightCondyleAnat);
    const leftAngle = toThreeVec(leftAngleAnat);
    const rightAngle = toThreeVec(rightAngleAnat);
    const coronoidLeft = toThreeVec(coronoidLeftAnat);
    const coronoidRight = toThreeVec(coronoidRightAnat);
    const symphysis = toThreeVec(symphysisAnat);
    
    // Materials
    const materialBone = new THREE.MeshPhongMaterial({
        color: state.theme === 'dark' ? 0x38bdf8 : 0x0284c7,
        transparent: true,
        opacity: 0.35,
        wireframe: false,
        shininess: 80
    });
    
    const materialBoneWire = new THREE.MeshBasicMaterial({
        color: state.theme === 'dark' ? 0x0ea5e9 : 0x0369a1,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    });

    // Helper: Draw cylinder bone connector
    function createBoneSegment(p1, p2, radius = 2.5) {
        const distance = p1.distanceTo(p2);
        const position = p2.clone().add(p1).multiplyScalar(0.5);
        const geometry = new THREE.CylinderGeometry(radius, radius, distance, 8);
        const mesh = new THREE.Mesh(geometry, materialBone);
        const meshWire = new THREE.Mesh(geometry, materialBoneWire);
        
        // Orient cylinder along direction
        const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
        const alignAxis = new THREE.Vector3(0, 1, 0); // Cylinders default oriented vertically
        mesh.quaternion.setFromUnitVectors(alignAxis, direction);
        meshWire.quaternion.copy(mesh.quaternion);
        
        mesh.position.copy(position);
        meshWire.position.copy(position);
        
        // Set metadata
        const desc = "Segmento rígido del hueso mandibular (cuerpo o rama). Actúa como palanca mecánica para transmitir la fuerza muscular.";
        setMetadata(mesh, 'bone', 'Hueso Mandibular', desc);
        setMetadata(meshWire, 'bone', 'Hueso Mandibular', desc);
        
        scene.add(mesh);
        scene.add(meshWire);
        jawMeshObjects.push(mesh, meshWire);
    }

    // Build Jaw V-shape components
    createBoneSegment(leftCondyle, leftAngle, 4 * rScale); // Left Ramus
    createBoneSegment(rightCondyle, rightAngle, 4 * rScale); // Right Ramus
    createBoneSegment(leftAngle, coronoidLeft, 3 * rScale); // Left coronoid front
    createBoneSegment(rightAngle, coronoidRight, 3 * rScale); // Right coronoid front
    createBoneSegment(leftCondyle, coronoidLeft, 2.5 * rScale); // Condyle to coronoid L
    createBoneSegment(rightCondyle, coronoidRight, 2.5 * rScale); // Condyle to coronoid R
    
    createBoneSegment(leftAngle, symphysis, 4.5 * rScale); // Left body
    createBoneSegment(rightAngle, symphysis, 4.5 * rScale); // Right body
    
    // Draw Joint condyle spheres
    const condyleGeo = new THREE.SphereGeometry(6 * rScale, 16, 16);
    const condyleMaterialL = new THREE.MeshPhongMaterial({ color: 0xd500f9, shininess: 100 });
    const condyleMaterialR = new THREE.MeshPhongMaterial({ color: 0x2979ff, shininess: 100 });
    
    const condyleMeshL = new THREE.Mesh(condyleGeo, condyleMaterialL);
    condyleMeshL.position.copy(leftCondyle);
    setMetadata(condyleMeshL, 'joint', 'Cóndilo ATM Izquierdo', 'Punto de articulación izquierdo (ATM). Funciona como el fulcro o punto de apoyo del sistema de palanca de la mandíbula.', { coord: [-w, 0, 0] });
    scene.add(condyleMeshL);
    jawMeshObjects.push(condyleMeshL);
    
    const condyleMeshR = new THREE.Mesh(condyleGeo, condyleMaterialR);
    condyleMeshR.position.copy(rightCondyle);
    setMetadata(condyleMeshR, 'joint', 'Cóndilo ATM Derecho', 'Punto de articulación derecho (ATM). Funciona como el fulcro o punto de apoyo del sistema de palanca de la mandíbula.', { coord: [w, 0, 0] });
    scene.add(condyleMeshR);
    jawMeshObjects.push(condyleMeshR);
    
    // Draw Hinge Axis Line
    const hingeGeo = new THREE.BufferGeometry().setFromPoints([leftCondyle, rightCondyle]);
    const hingeMat = new THREE.LineDashedMaterial({
        color: 0x6b7280,
        dashSize: 4,
        gapSize: 2
    });
    const hingeLine = new THREE.Line(hingeGeo, hingeMat);
    hingeLine.computeLineDistances();
    setMetadata(hingeLine, 'hinge-axis', 'Eje de Bisagra Condilar', 'Línea imaginaria que conecta ambos cóndilos de la ATM. Representa el eje principal de rotación de la mandíbula durante la apertura y el cierre.', {});
    scene.add(hingeLine);
    jawMeshObjects.push(hingeLine);

    // Draw dental arch teeth (parabolic white cubes)
    const teethMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 100 });
    const toothGeo = new THREE.BoxGeometry(4 * rScale, 4 * rScale, 4 * rScale);
    
    // Generate teeth locations on dental arch curve
    // From angle to symphysis along both branches
    const totalTeeth = 8;
    for (let i = 1; i < totalTeeth; i++) {
        const t = i / totalTeeth;
        // Interpolate along left branch (excluding back ramus angle)
        if (t > 0.3) {
            // Left tooth: calculate unrotated anatomical, apply rotation around hinge axis, then map to Three.js
            const xL = -w + 10 * rScale + (0 - (-w + 10 * rScale)) * t;
            const yL = 20 * rScale + (L - 20 * rScale) * t;
            const zL = -35 * rScale + (-30 * rScale - (-35 * rScale)) * t + 8 * rScale;
            const toothL_rot = vec.rotateX([xL, yL, zL], theta);
            const toothMeshL = new THREE.Mesh(toothGeo, teethMaterial);
            toothMeshL.position.copy(toThreeVec(toothL_rot));
            setMetadata(toothMeshL, 'tooth', 'Diente Mandibular', 'Pieza dental del arco inferior. Punto de contacto potencial para la mordida. Los molares traseros multiplican más la fuerza.', {});
            scene.add(toothMeshL);
            jawMeshObjects.push(toothMeshL);
            
            // Right tooth: similar
            const xR = w - 10 * rScale + (0 - (w - 10 * rScale)) * t;
            const yR = 20 * rScale + (L - 20 * rScale) * t;
            const zR = -35 * rScale + (-30 * rScale - (-35 * rScale)) * t + 8 * rScale;
            const toothR_rot = vec.rotateX([xR, yR, zR], theta);
            const toothMeshR = new THREE.Mesh(toothGeo, teethMaterial);
            toothMeshR.position.copy(toThreeVec(toothR_rot));
            setMetadata(toothMeshR, 'tooth', 'Diente Mandibular', 'Pieza dental del arco inferior. Punto de contacto potencial para la mordida.', {});
            scene.add(toothMeshR);
            jawMeshObjects.push(toothMeshR);
        }
    }

    // 3. Draw Muscle Vectors (Green arrows + origin anchors)
    const originSphereGeo = new THREE.SphereGeometry(3 * rScale, 8, 8);
    
    muscles.forEach(({ m, u_i, F_i }) => {
        // Insertion and Origin Positions
        const pInsert = toThreeVec(m.r);
        const pOrigin = toThreeVec(m.origin);
        
        const desc = `${m.description}`;
        const extraData = { id: m.id, force: m.force, r: m.r, origin: m.origin };
        
        // Draw skull anchor sphere
        const anchorMat = new THREE.MeshBasicMaterial({
            color: m.color,
            transparent: true,
            opacity: 0.6
        });
        const anchorMesh = new THREE.Mesh(originSphereGeo, anchorMat);
        anchorMesh.position.copy(pOrigin);
        setMetadata(anchorMesh, 'muscle-origin', `Origen: ${m.name}`, desc, extraData);
        scene.add(anchorMesh);
        muscleVectorsObjects.push(anchorMesh);
        
        // Draw thin muscle line connector
        const lineGeo = new THREE.BufferGeometry().setFromPoints([pInsert, pOrigin]);
        const lineMat = new THREE.LineBasicMaterial({
            color: m.color,
            transparent: true,
            opacity: 0.4
        });
        const muscleLine = new THREE.Line(lineGeo, lineMat);
        setMetadata(muscleLine, 'muscle-line', `Cuerpo: ${m.name}`, desc, extraData);
        scene.add(muscleLine);
        muscleVectorsObjects.push(muscleLine);
        
        // Draw force arrow at insertion point pointing along muscle direction
        const arrowLength = vec.norm(F_i) * 0.25 * rScale; // Scale factor: 4 N per mm (scaled)
        if (arrowLength > 1e-2) {
            const dir = toThreeVec(u_i).normalize();
            const arrow = new THREE.ArrowHelper(dir, pInsert, arrowLength, m.color, 8 * rScale, 3 * rScale);
            setMetadata(arrow, 'muscle-force', `Vector Fuerza: ${m.name}`, desc, extraData);
            scene.add(arrow);
            muscleVectorsObjects.push(arrow);
        }
    });

    // 4. Draw Bite Point & Bite Force vector
    const pB = toThreeVec(rB);
    
    // Golden bite point sphere marker
    const bitePointGeo = new THREE.SphereGeometry(4 * rScale, 16, 16);
    const bitePointMat = new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0xcca300, shininess: 120 });
    staticBPointMarker = new THREE.Mesh(bitePointGeo, bitePointMat); // Use local let for safety if defined globally
    staticBitePointMarker = staticBPointMarker; 
    staticBitePointMarker.position.copy(pB);
    setMetadata(staticBitePointMarker, 'bite-point', 'Punto de Mordida (Contacto)', `Punto de contacto oclusal de la mordida o mordisco.`, { rB: rB });
    scene.add(staticBitePointMarker);
    
    // Bite Force Arrow
    const fbMag = vec.norm(FB_vector);
    const arrowFB_length = fbMag * 0.25 * rScale; // Same force scale: 4 N per mm
    
    if (arrowFB_length > 1e-2) {
        const dirFB = toThreeVec(FB_vector).normalize();
        biteVectorObject = new THREE.ArrowHelper(dirFB, pB, arrowFB_length, 0xff1744, 10 * rScale, 4 * rScale);
        setMetadata(biteVectorObject, 'bite-force', 'Fuerza de Mordida (F_B)', `Fuerza reactiva total ejercida por el alimento sobre el diente.`, { fbMag: fbMag, FB_vector: FB_vector });
        scene.add(biteVectorObject);
    }

    // 5. Draw Joint Reaction Force Arrows at Left & Right ATMs
    const drawJointArrow = (originVec, forceAnat, color, side) => {
        const forceMag = vec.norm(forceAnat);
        const arrowLength = forceMag * 0.25 * rScale;
        if (arrowLength > 1e-2) {
            const dir = toThreeVec(forceAnat).normalize();
            const arrow = new THREE.ArrowHelper(dir, originVec, arrowLength, color, 8 * rScale, 3 * rScale);
            const sideName = side === 'left' ? 'Izquierdo' : 'Derecho';
            const fName = side === 'left' ? 'F_{JL}' : 'F_{JR}';
            setMetadata(arrow, 'joint-reaction', `Fuerza en ATM ${sideName} (${fName})`, `Fuerza de reacción/compresión en el cóndilo condilar ${sideName.toLowerCase()} para mantener el equilibrio estático.`, { forceMag: forceMag, forceAnat: forceAnat });
            scene.add(arrow);
            jointVectorsObjects.push(arrow);
        }
    };
    
    drawJointArrow(leftCondyle, F_JL, 0xd500f9, 'left'); // Purple arrow
    drawJointArrow(rightCondyle, F_JR, 0x2979ff, 'right'); // Light blue arrow
}

// Tooltip JS Helper
function initTooltips() {
    let tooltipEl = null;

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;

        const text = target.getAttribute('data-tooltip');
        if (!text) return;

        // Create tooltip
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'custom-tooltip';
        tooltipEl.innerText = text;
        document.body.appendChild(tooltipEl);

        // Position
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        let top = rect.top - tooltipRect.height - 10;
        // Fallback if it goes above the viewport
        if (top < 0) {
            top = rect.bottom + 10;
            tooltipEl.classList.add('tooltip-bottom');
        } else {
            tooltipEl.classList.add('tooltip-top');
        }

        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        // Keep within viewport boundaries
        if (left < 8) left = 8;
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }

        tooltipEl.style.top = `${top + window.scrollY}px`;
        tooltipEl.style.left = `${left + window.scrollX}px`;
        // Force reflow and set opacity
        tooltipEl.offsetHeight; 
        tooltipEl.style.opacity = '1';
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;

        if (tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
    });
    
    // Safety check: close on scroll to avoid dangling tooltips
    window.addEventListener('scroll', () => {
        if (tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
    }, { passive: true });
}

// Raycaster global instances for 3D selections
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered3DObject = null;
let tooltip3D = null;
let mouseDownPos = { x: 0, y: 0 };

function initRaycasting() {
    const canvas = renderer.domElement;
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    canvas.addEventListener('mousedown', (e) => {
        mouseDownPos.x = e.clientX;
        mouseDownPos.y = e.clientY;
    });
    canvas.addEventListener('click', onCanvasClick);
}

function onCanvasMouseMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();

    // Map screen mouse position to NDC (-1 to +1) relative to canvas bounds
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    let hitObject = null;
    for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;
        if (obj.userData && obj.userData.label) {
            hitObject = obj;
            break;
        }
    }

    const canvas = renderer.domElement;
    if (hitObject) {
        canvas.style.cursor = 'pointer';
        
        if (hovered3DObject !== hitObject) {
            hovered3DObject = hitObject;
            show3DTooltip(e.clientX, e.clientY, hitObject.userData);
        } else {
            update3DTooltipPos(e.clientX, e.clientY);
        }
    } else {
        canvas.style.cursor = '';
        if (hovered3DObject) {
            hovered3DObject = null;
            hide3DTooltip();
        }
    }
}

function onCanvasMouseLeave() {
    const canvas = renderer.domElement;
    canvas.style.cursor = '';
    if (hovered3DObject) {
        hovered3DObject = null;
        hide3DTooltip();
    }
}

function onCanvasClick(e) {
    // If the mouse moved significantly, assume it was a camera drag, not a selection click!
    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    if (deltaX > 4 || deltaY > 4) {
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    let hitObject = null;
    for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;
        if (obj.userData && obj.userData.label) {
            hitObject = obj;
            break;
        }
    }

    if (hitObject) {
        handle3DSelection(hitObject.userData);
    }
}

function handle3DSelection(data) {
    if (data.type === 'muscle-origin' || data.type === 'muscle-line' || data.type === 'muscle-force') {
        const mId = data.id;
        toggleMuscleAccordion(mId);
        
        const el = document.getElementById(`muscle-config-${mId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            el.style.borderColor = 'var(--color-muscle)';
            setTimeout(() => {
                el.style.borderColor = '';
            }, 1200);
        }
    } else if (data.type === 'bite-point' || data.type === 'bite-force') {
        const detailsEl = document.getElementById('details-bite');
        if (detailsEl) {
            detailsEl.open = true;
            detailsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            detailsEl.style.borderColor = 'var(--color-bite)';
            setTimeout(() => {
                detailsEl.style.borderColor = '';
            }, 1200);
        }
    } else if (data.type === 'joint' || data.type === 'joint-reaction') {
        switchTab('tab-results');
        const kpi = document.querySelector('.joint-forces-grid');
        if (kpi) {
            kpi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            kpi.style.outline = '2px solid var(--color-joint-left)';
            kpi.style.borderRadius = 'var(--border-radius-md)';
            setTimeout(() => {
                kpi.style.outline = '';
            }, 1200);
        }
    }
}

function show3DTooltip(clientX, clientY, data) {
    if (tooltip3D) tooltip3D.remove();

    tooltip3D = document.createElement('div');
    tooltip3D.className = 'custom-tooltip tooltip-3d';
    
    // Check data and render custom structure based on type
    if (data.type && data.type.startsWith('muscle')) {
        const fVal = data.force !== undefined ? `${data.force} N` : 'N/A';
        const rVal = data.r ? `X: ${data.r[0]}, Y: ${data.r[1]}, Z: ${data.r[2]}` : 'N/A';
        const oVal = data.origin ? `X: ${data.origin[0]}, Y: ${data.origin[1]}, Z: ${data.origin[2]}` : 'N/A';
        
        tooltip3D.innerHTML = `
            <div class="tooltip-title">${data.label}</div>
            <div class="tooltip-row"><span>Fuerza:</span> <strong>${fVal}</strong></div>
            <div class="tooltip-row"><span>Inserción:</span> <strong>${rVal}</strong></div>
            <div class="tooltip-row"><span>Origen:</span> <strong>${oVal}</strong></div>
            <div class="tooltip-divider"></div>
            <div class="tooltip-notes">${data.desc}</div>
        `;
    } else if (data.type === 'bite-point') {
        const rBVal = data.rB ? `X: ${Math.round(data.rB[0])}, Y: ${Math.round(data.rB[1])}, Z: ${Math.round(data.rB[2])}` : 'N/A';
        tooltip3D.innerHTML = `
            <div class="tooltip-title">${data.label}</div>
            <div class="tooltip-row"><span>Posición:</span> <strong>${rBVal}</strong></div>
            <div class="tooltip-divider"></div>
            <div class="tooltip-notes">${data.desc}</div>
        `;
    } else if (data.type === 'bite-force') {
        const fMag = data.fbMag !== undefined ? `${data.fbMag.toFixed(1)} N` : 'N/A';
        const fVec = data.FB_vector ? `X: ${data.FB_vector[0].toFixed(1)}, Y: ${data.FB_vector[1].toFixed(1)}, Z: ${data.FB_vector[2].toFixed(1)}` : 'N/A';
        tooltip3D.innerHTML = `
            <div class="tooltip-title">${data.label}</div>
            <div class="tooltip-row"><span>Fuerza Reactiva:</span> <strong>${fMag}</strong></div>
            <div class="tooltip-row"><span>Componentes:</span> <strong>${fVec}</strong></div>
            <div class="tooltip-divider"></div>
            <div class="tooltip-notes">${data.desc}</div>
        `;
    } else if (data.type === 'joint') {
        const coordVal = data.coord ? `X: ${Math.round(data.coord[0])}, Y: ${Math.round(data.coord[1])}, Z: ${Math.round(data.coord[2])}` : 'N/A';
        tooltip3D.innerHTML = `
            <div class="tooltip-title">${data.label}</div>
            <div class="tooltip-row"><span>Posición:</span> <strong>${coordVal}</strong></div>
            <div class="tooltip-divider"></div>
            <div class="tooltip-notes">${data.desc}</div>
        `;
    } else if (data.type === 'joint-reaction') {
        const fMag = data.forceMag !== undefined ? `${data.forceMag.toFixed(1)} N` : 'N/A';
        const fVec = data.forceAnat ? `X: ${data.forceAnat[0].toFixed(1)}, Y: ${data.forceAnat[1].toFixed(1)}, Z: ${data.forceAnat[2].toFixed(1)}` : 'N/A';
        tooltip3D.innerHTML = `
            <div class="tooltip-title">${data.label}</div>
            <div class="tooltip-row"><span>Fuerza Reacción:</span> <strong>${fMag}</strong></div>
            <div class="tooltip-row"><span>Componentes:</span> <strong>${fVec}</strong></div>
            <div class="tooltip-divider"></div>
            <div class="tooltip-notes">${data.desc}</div>
        `;
    } else {
        tooltip3D.innerHTML = `<strong>${data.label}</strong><br><span style="font-size:0.72rem; color:var(--text-secondary); font-weight:normal;">${data.desc}</span>`;
    }

    document.body.appendChild(tooltip3D);

    tooltip3D.offsetHeight; // force reflow
    tooltip3D.style.opacity = '1';
    tooltip3D.style.transform = 'translateY(0)';
    position3DTooltip(clientX, clientY);
}

function position3DTooltip(clientX, clientY) {
    if (!tooltip3D) return;
    const tooltipRect = tooltip3D.getBoundingClientRect();
    
    let top = clientY - tooltipRect.height - 15;
    if (top < 10) {
        top = clientY + 15;
    }
    
    let left = clientX - tooltipRect.width / 2;
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
    }
    
    tooltip3D.style.top = `${top + window.scrollY}px`;
    tooltip3D.style.left = `${left + window.scrollX}px`;
}

function update3DTooltipPos(clientX, clientY) {
    position3DTooltip(clientX, clientY);
}

function hide3DTooltip() {
    if (tooltip3D) {
        tooltip3D.remove();
        tooltip3D = null;
    }
}

// Helper to assign rich metadata to Three.js meshes and arrows for Raycasting selection
function setMetadata(obj, type, label, desc, extraData = {}) {
    const metadata = { type, label, desc, ...extraData };
    obj.userData = metadata;
    
    // Propagate to internal parts of composite objects like ArrowHelper
    if (obj.line) obj.line.userData = metadata;
    if (obj.cone) obj.cone.userData = metadata;
    
    // Propagate to all child meshes recursively
    if (obj.children) {
        obj.children.forEach(child => {
            setMetadata(child, type, label, desc, extraData);
        });
    }
}

// Render all static LaTeX formulas in HTML paragraphs using KaTeX auto-render extension
function renderStaticMath() {
    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(document.body, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
        });
    }
}

// Toggle Axis visibility inside Three.js scene
function toggleAxes() {
    if (!axesHelper) return;
    const btn = document.getElementById('btn-toggle-axes');
    if (axesHelper.visible) {
        axesHelper.visible = false;
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-arrows-to-dot"></i> Ejes: OFF';
            btn.style.opacity = '0.6';
        }
    } else {
        axesHelper.visible = true;
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-arrows-to-dot"></i> Ejes: ON';
            btn.style.opacity = '1';
        }
    }
}

// Toggle overlay theory modal
function toggleTheoryModal(show) {
    const overlay = document.getElementById('theory-modal-overlay');
    if (!overlay) return;
    if (show) {
        overlay.classList.remove('hidden');
        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(overlay, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false
            });
        }
    } else {
        overlay.classList.add('hidden');
    }
}

// Draggable split screen resizer setup
function initResizer() {
    const resizer = document.getElementById('resizer-right');
    const rightPanel = document.getElementById('panel-math');
    const container = document.querySelector('.app-workspace');
    
    if (!resizer || !rightPanel || !container) return;
    
    let isDragging = false;
    
    resizer.addEventListener('mousedown', (e) => {
        isDragging = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const containerRect = container.getBoundingClientRect();
        // Calculate new width of the right results/derivations panel
        const newWidth = containerRect.right - e.clientX;
        
        // Limits: min 320px, max to leave at least 660px for controls + viewport
        if (newWidth > 320 && newWidth < (containerRect.width - 660)) {
            rightPanel.style.width = `${newWidth}px`;
            onWindowResize(); // Force Three.js update!
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            onWindowResize(); // Force Three.js update!
        }
    });
}
