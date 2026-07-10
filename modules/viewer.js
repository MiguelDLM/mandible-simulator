// Three.js Visualizer Module
import { vec } from './math.js';

let scene, camera, renderer, controls, axesHelper;
let jawMeshObjects = [];
let muscleVectorsObjects = [];
let biteVectorObject = null;
let jointVectorsObjects = [];
let staticBitePointMarker = null;

// Raycaster variables
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered3DObject = null;
let tooltip3D = null;
let mouseDownPos = { x: 0, y: 0 };
let onElementSelectCallback = null;

export function initThreeJS(containerId, state, tickCallback, onElementSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight || 450;
    
    onElementSelectCallback = onElementSelect;

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
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(100, 200, 50);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-100, 100, -50);
    scene.add(fillLight);
    
    // Grid Helper
    const grid = new THREE.GridHelper(300, 30, 0x3b82f6, 0x1e293b);
    grid.position.y = -45;
    scene.add(grid);
    
    // Axes Helper
    axesHelper = new THREE.AxesHelper(100);
    axesHelper.position.set(0, -45, 0);
    scene.add(axesHelper);
    
    // Raycaster initialization
    const canvas = renderer.domElement;
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    canvas.addEventListener('mousedown', (e) => {
        mouseDownPos.x = e.clientX;
        mouseDownPos.y = e.clientY;
    });
    canvas.addEventListener('click', onCanvasClick);
    
    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        if (tickCallback) tickCallback();
        renderer.render(scene, camera);
    }
    animate();
    
    // Window Resize setup
    window.addEventListener('resize', () => onWindowResize(containerId));
}

export function onWindowResize(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !camera || !renderer) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

export function setCameraPreset(view, L, w) {
    if (!controls || !camera) return;
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

export function toggleAxes() {
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

export function updateClearColor(theme) {
    if (renderer) {
        renderer.setClearColor(theme === 'dark' ? 0x0b0f19 : 0xf0f4f9);
    }
    if (scene) {
        scene.background = new THREE.Color(theme === 'dark' ? 0x0b0f19 : 0xf0f4f9);
    }
}

export function update3DScene(w, L, rB, muscles, FB_vector, F_JL, F_JR, theta, theme) {
    if (!scene) return;
    
    // 1. Clear previous dynamic objects
    jawMeshObjects.forEach(obj => scene.remove(obj));
    jawMeshObjects = [];
    
    muscleVectorsObjects.forEach(obj => scene.remove(obj));
    muscleVectorsObjects = [];
    
    if (biteVectorObject) {
        scene.remove(biteVectorObject);
        biteVectorObject = null;
    }
    
    if (staticBitePointMarker) {
        scene.remove(staticBitePointMarker);
        staticBitePointMarker = null;
    }
    
    jointVectorsObjects.forEach(obj => scene.remove(obj));
    jointVectorsObjects = [];
    
    const rScale = L / 100;
    const toThreeVec = (v) => new THREE.Vector3(v[0], v[2], v[1]);
    
    // 2. Re-create Mandible geometric model (V-shape)
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
    
    const materialBone = new THREE.MeshPhongMaterial({
        color: theme === 'dark' ? 0x38bdf8 : 0x0284c7,
        transparent: true,
        opacity: 0.35,
        shininess: 80
    });
    
    const materialBoneWire = new THREE.MeshBasicMaterial({
        color: theme === 'dark' ? 0x0ea5e9 : 0x0369a1,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    });

    function createBoneSegment(p1, p2, radius = 2.5) {
        const distance = p1.distanceTo(p2);
        const position = p2.clone().add(p1).multiplyScalar(0.5);
        const geometry = new THREE.CylinderGeometry(radius, radius, distance, 8);
        const mesh = new THREE.Mesh(geometry, materialBone);
        const meshWire = new THREE.Mesh(geometry, materialBoneWire);
        
        const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
        const alignAxis = new THREE.Vector3(0, 1, 0);
        mesh.quaternion.setFromUnitVectors(alignAxis, direction);
        meshWire.quaternion.copy(mesh.quaternion);
        
        mesh.position.copy(position);
        meshWire.position.copy(position);
        
        const desc = "Segmento rígido del hueso mandibular (cuerpo o rama). Actúa como palanca mecánica para transmitir la fuerza muscular.";
        setMetadata(mesh, 'bone', 'Hueso Mandibular', desc);
        setMetadata(meshWire, 'bone', 'Hueso Mandibular', desc);
        
        scene.add(mesh);
        scene.add(meshWire);
        jawMeshObjects.push(mesh, meshWire);
    }

    createBoneSegment(leftCondyle, leftAngle, 4 * rScale);
    createBoneSegment(rightCondyle, rightAngle, 4 * rScale);
    createBoneSegment(leftAngle, coronoidLeft, 3 * rScale);
    createBoneSegment(rightAngle, coronoidRight, 3 * rScale);
    createBoneSegment(leftCondyle, coronoidLeft, 2.5 * rScale);
    createBoneSegment(rightCondyle, coronoidRight, 2.5 * rScale);
    createBoneSegment(leftAngle, symphysis, 4.5 * rScale);
    createBoneSegment(rightAngle, symphysis, 4.5 * rScale);
    
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
    
    const hingeGeo = new THREE.BufferGeometry().setFromPoints([leftCondyle, rightCondyle]);
    const hingeMat = new THREE.LineDashedMaterial({ color: 0x6b7280, dashSize: 4, gapSize: 2 });
    const hingeLine = new THREE.Line(hingeGeo, hingeMat);
    hingeLine.computeLineDistances();
    setMetadata(hingeLine, 'hinge-axis', 'Eje de Bisagra Condilar', 'Línea imaginaria que conecta ambos cóndilos de la ATM. Representa el eje principal de rotación de la mandíbula durante la apertura y el cierre.', {});
    scene.add(hingeLine);
    jawMeshObjects.push(hingeLine);

    const teethMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 100 });
    const toothGeo = new THREE.BoxGeometry(4 * rScale, 4 * rScale, 4 * rScale);
    
    const totalTeeth = 8;
    for (let i = 1; i < totalTeeth; i++) {
        const t = i / totalTeeth;
        if (t > 0.3) {
            const xL = -w + 10 * rScale + (0 - (-w + 10 * rScale)) * t;
            const yL = 20 * rScale + (L - 20 * rScale) * t;
            const zL = -35 * rScale + (-30 * rScale - (-35 * rScale)) * t + 8 * rScale;
            const toothL_rot = vec.rotateX([xL, yL, zL], theta);
            const toothMeshL = new THREE.Mesh(toothGeo, teethMaterial);
            toothMeshL.position.copy(toThreeVec(toothL_rot));
            setMetadata(toothMeshL, 'tooth', 'Diente Mandibular', 'Pieza dental del arco inferior. Punto de contacto potencial para la mordida. Los molares traseros multiplican más la fuerza.', {});
            scene.add(toothMeshL);
            jawMeshObjects.push(toothMeshL);
            
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

    // 3. Draw Muscle Vectors
    const originSphereGeo = new THREE.SphereGeometry(3 * rScale, 8, 8);
    muscles.forEach(({ m, u_i, F_i }) => {
        const pInsert = toThreeVec(m.r);
        const pOrigin = toThreeVec(m.origin);
        
        const desc = `${m.description}`;
        const extraData = { id: m.id, force: m.force, r: m.r, origin: m.origin };
        
        const anchorMat = new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.6 });
        const anchorMesh = new THREE.Mesh(originSphereGeo, anchorMat);
        anchorMesh.position.copy(pOrigin);
        setMetadata(anchorMesh, 'muscle-origin', `Origen: ${m.name}`, desc, extraData);
        scene.add(anchorMesh);
        muscleVectorsObjects.push(anchorMesh);
        
        const lineGeo = new THREE.BufferGeometry().setFromPoints([pInsert, pOrigin]);
        const lineMat = new THREE.LineBasicMaterial({ color: m.color, transparent: true, opacity: 0.4 });
        const muscleLine = new THREE.Line(lineGeo, lineMat);
        setMetadata(muscleLine, 'muscle-line', `Cuerpo: ${m.name}`, desc, extraData);
        scene.add(muscleLine);
        muscleVectorsObjects.push(muscleLine);
        
        const arrowLength = vec.norm(F_i) * 0.25 * rScale;
        if (arrowLength > 1e-2) {
            const dir = toThreeVec(u_i).normalize();
            const arrow = new THREE.ArrowHelper(dir, pInsert, arrowLength, m.color, 8 * rScale, 3 * rScale);
            setMetadata(arrow, 'muscle-force', `Vector Fuerza: ${m.name}`, desc, extraData);
            scene.add(arrow);
            muscleVectorsObjects.push(arrow);
        }
    });

    // 4. Draw Bite Point
    const pB = toThreeVec(rB);
    const bitePointGeo = new THREE.SphereGeometry(4 * rScale, 16, 16);
    const bitePointMat = new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0xcca300, shininess: 120 });
    staticBitePointMarker = new THREE.Mesh(bitePointGeo, bitePointMat);
    staticBitePointMarker.position.copy(pB);
    setMetadata(staticBitePointMarker, 'bite-point', 'Punto de Mordida (Contacto)', `Punto de contacto oclusal de la mordida o mordisco.`, { rB: rB });
    scene.add(staticBitePointMarker);
    
    const fbMag = vec.norm(FB_vector);
    const arrowFB_length = fbMag * 0.25 * rScale;
    if (arrowFB_length > 1e-2) {
        const dirFB = toThreeVec(FB_vector).normalize();
        biteVectorObject = new THREE.ArrowHelper(dirFB, pB, arrowFB_length, 0xff1744, 10 * rScale, 4 * rScale);
        setMetadata(biteVectorObject, 'bite-force', 'Fuerza de Mordida (F_B)', `Fuerza reactiva total ejercida por el alimento sobre el diente.`, { fbMag: fbMag, FB_vector: FB_vector });
        scene.add(biteVectorObject);
    }

    // 5. Draw Joint Reaction Forces
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
    
    drawJointArrow(leftCondyle, F_JL, 0xd500f9, 'left');
    drawJointArrow(rightCondyle, F_JR, 0x2979ff, 'right');
}

function onCanvasMouseMove(e) {
    if (!renderer || !camera || !scene) return;
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
    if (renderer) renderer.domElement.style.cursor = '';
    if (hovered3DObject) {
        hovered3DObject = null;
        hide3DTooltip();
    }
}

function onCanvasClick(e) {
    if (!renderer || !camera || !scene) return;
    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    if (deltaX > 4 || deltaY > 4) return;

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

    if (hitObject && onElementSelectCallback) {
        onElementSelectCallback(hitObject.userData);
    }
}

function show3DTooltip(clientX, clientY, data) {
    if (tooltip3D) tooltip3D.remove();

    tooltip3D = document.createElement('div');
    tooltip3D.className = 'custom-tooltip tooltip-3d';
    
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
    if (top < 10) top = clientY + 15;
    
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

function setMetadata(obj, type, label, desc, extraData = {}) {
    const metadata = { type, label, desc, ...extraData };
    obj.userData = metadata;
    if (obj.line) obj.line.userData = metadata;
    if (obj.cone) obj.cone.userData = metadata;
    if (obj.children) {
        obj.children.forEach(child => {
            setMetadata(child, type, label, desc, extraData);
        });
    }
}
