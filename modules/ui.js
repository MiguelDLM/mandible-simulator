// UI Controller Module
import { vec } from './math.js';

let localState = null;

export function initUI(state, callbacks) {
    localState = state;
    const container = document.getElementById('muscles-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    state.muscles.forEach((m) => {
        const item = document.createElement('div');
        item.className = 'muscle-item-config';
        item.id = `muscle-config-${m.id}`;
        
        item.innerHTML = `
            <div class="muscle-header-row" onclick="window.toggleMuscleAccordion('${m.id}')">
                <div class="muscle-title">
                    <span class="muscle-indicator" style="background-color: rgb(${m.color === 0x00e676 ? '0,230,118' : m.color === 0x2979ff ? '41,121,255' : '255,145,0'})"></span>
                    <span>${m.name}</span>
                </div>
                <div class="muscle-header-actions-wrapper" style="display: flex; align-items: center; gap: 0.6rem;">
                    <div class="muscle-header-actions" onclick="event.stopPropagation()" style="display: flex; align-items: center; gap: 0.6rem;">
                        <span class="value-display" id="val-${m.id}-force-hdr" style="font-size: 0.8rem; margin-right: 0.5rem; font-weight:bold;">${m.force} N</span>
                        <label class="switch" data-tooltip="Activa o desactiva la contribución de fuerza de este músculo a la simulación.">
                            <input type="checkbox" id="check-${m.id}" ${m.active ? 'checked' : ''} onchange="window.updateMuscleState('${m.id}', 'active', this.checked)">
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
                        <input type="range" id="slide-${m.id}-force" min="0" max="300" value="${m.force}" oninput="window.updateMuscleState('${m.id}', 'force', parseFloat(this.value))">
                        <span class="value-display" id="val-${m.id}-force">${m.force}</span>
                    </div>
                </div>
                
                <!-- Insertion Sliders -->
                <div class="coordinate-slider-group">
                    <div class="coord-group-title">Inserción en Mandíbula <span class="unit">(mm)</span></div>
                    <div class="input-row sub-row" data-tooltip="Posición lateral del anclaje del músculo en el hueso mandibular (Eje X).">
                        <label>Eje X (Lateral): <span class="value-display" id="val-${m.id}-rx">${m.r[0]}</span></label>
                        <input type="range" id="slide-${m.id}-rx" min="-80" max="80" value="${m.r[0]}" step="1" oninput="window.updateMuscleVector('${m.id}', 'r', 0, parseFloat(this.value))">
                    </div>
                    <div class="input-row sub-row" data-tooltip="Posición anteroposterior del anclaje en la mandíbula (Eje Y, distancia del eje trasero).">
                        <label>Eje Y (Anteroposterior): <span class="value-display" id="val-${m.id}-ry">${m.r[1]}</span></label>
                        <input type="range" id="slide-${m.id}-ry" min="0" max="130" value="${m.r[1]}" step="1" oninput="window.updateMuscleVector('${m.id}', 'r', 1, parseFloat(this.value))">
                    </div>
                    <div class="input-row sub-row" data-tooltip="Altura vertical del anclaje en el cuerpo mandibular (Eje Z).">
                        <label>Eje Z (Vertical): <span class="value-display" id="val-${m.id}-rz">${m.r[2]}</span></label>
                        <input type="range" id="slide-${m.id}-rz" min="-60" max="60" value="${m.r[2]}" step="1" oninput="window.updateMuscleVector('${m.id}', 'r', 2, parseFloat(this.value))">
                    </div>
                </div>
                
                <!-- Origin Sliders -->
                <div class="coordinate-slider-group">
                    <div class="coord-group-title">Origen en Cráneo <span class="unit">(mm)</span></div>
                    <div class="input-row sub-row" data-tooltip="Posición lateral del anclaje del músculo en el cráneo (Eje X).">
                        <label>Eje X (Lateral): <span class="value-display" id="val-${m.id}-ox">${m.origin[0]}</span></label>
                        <input type="range" id="slide-${m.id}-ox" min="-80" max="80" value="${m.origin[0]}" step="1" oninput="window.updateMuscleVector('${m.id}', 'origin', 0, parseFloat(this.value))">
                    </div>
                    <div class="input-row sub-row" data-tooltip="Posición anteroposterior del anclaje en el cráneo (Eje Y, distancia del eje posterior).">
                        <label>Eje Y (Anteroposterior): <span class="value-display" id="val-${m.id}-oy">${m.origin[1]}</span></label>
                        <input type="range" id="slide-${m.id}-oy" min="0" max="130" value="${m.origin[1]}" step="1" oninput="window.updateMuscleVector('${m.id}', 'origin', 1, parseFloat(this.value))">
                    </div>
                    <div class="input-row sub-row" data-tooltip="Altura vertical de la inserción del músculo en el cráneo (Eje Z).">
                        <label>Eje Z (Vertical): <span class="value-display" id="val-${m.id}-oz">${m.origin[2]}</span></label>
                        <input type="range" id="slide-${m.id}-oz" min="-60" max="100" value="${m.origin[2]}" step="1" oninput="window.updateMuscleVector('${m.id}', 'origin', 2, parseFloat(this.value))">
                    </div>
                </div>
            </div>
        `;
        container.appendChild(item);
    });

    // Wire up global window scope helpers called by inline elements
    window.toggleMuscleAccordion = function(id) {
        const el = document.getElementById(`muscle-config-${id}`);
        if (!el) return;
        const isOpen = el.classList.contains('open');
        document.querySelectorAll('.muscle-item-config').forEach(item => {
            item.classList.remove('open');
        });
        if (!isOpen) {
            el.classList.add('open');
        }
    };
    
    window.updateMuscleState = (id, prop, val) => callbacks.onMuscleStateChange(id, prop, val);
    window.updateMuscleVector = (id, prop, index, val) => callbacks.onMuscleVectorChange(id, prop, index, val);

    // Theme Toggle Listener
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const body = document.body;
        let newTheme = 'dark';
        if (body.classList.contains('dark-mode')) {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
            newTheme = 'light';
            document.getElementById('theme-toggle').innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
            newTheme = 'dark';
            document.getElementById('theme-toggle').innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
        callbacks.onThemeToggle(newTheme);
    });

    // Mandible Geometry Input Listeners
    document.getElementById('input-jaw-width').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-jaw-width').innerText = val;
        callbacks.onJawWidthChange(val);
    });

    document.getElementById('input-jaw-length').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-jaw-length').innerText = val;
        callbacks.onJawLengthChange(val);
    });

    // Bite Presets Dropdown Listener
    document.getElementById('bite-preset').addEventListener('change', (e) => {
        callbacks.onBitePresetChange(e.target.value);
    });

    // Bite Custom coordinate listener inputs
    ['xb', 'yb', 'zb'].forEach((axis, index) => {
        document.getElementById(`input-${axis}`).addEventListener('change', (e) => {
            callbacks.onBiteCoordChange(axis, index, parseFloat(e.target.value));
        });
    });

    // Bite Direction Selector Listener
    document.getElementById('bite-direction-type').addEventListener('change', (e) => {
        callbacks.onBiteDirTypeChange(e.target.value);
    });

    // Free direction coordinates manual inputs
    ['ubx', 'uby', 'ubz'].forEach((comp, idx) => {
        document.getElementById(`input-${comp}`).addEventListener('change', (e) => {
            callbacks.onBiteDirCompChange(comp, idx, parseFloat(e.target.value));
        });
    });
}

// Adjust UI slider values after proportion resizing
export function updateSlidersFromState(muscles) {
    muscles.forEach((m) => {
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

// Render dynamic horizontal bars for active muscle proportions
export function renderMuscleContributionChart(musclesComputed, sumActiveForcesScalar) {
    const container = document.getElementById('muscle-bar-chart');
    if (!container) return;
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
export function renderPhysicalWarnings(FB, F_JL, F_JR, divideByZero, musclesState) {
    const container = document.getElementById('physical-warnings');
    if (!container) return;
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
    
    if (FB < 0) {
        container.innerHTML += `
            <div class="alert-box warning">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span><strong>Fuerza Invertida:</strong> Los vectores musculares están jalando de tal forma que la mandíbula se "abriría" contra el vector de mordida en lugar de cerrarse. Revise que las fuerzas musculares tengan dirección ascendente (+Z).</span>
            </div>
        `;
    }
    
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
    const lForce = musclesState.filter(m => m.active && m.id.endsWith('-l')).reduce((acc, m) => acc + m.force, 0);
    const rForce = musclesState.filter(m => m.active && m.id.endsWith('-r')).reduce((acc, m) => acc + m.force, 0);
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
export function renderLaTeXSteps(muscles, totalTorque, rB, uB, FB, FB_vec, denominator, F_net, tau_net, w, F_JL, F_JR, MA, sumActiveForces, biteDirectionType) {
    if (typeof katex === 'undefined') return;
    
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
    const step1El = document.getElementById('math-step-1');
    if (step1El) katex.render(htmlStep1, step1El, { displayMode: true, throwOnError: false });
    
    // Step 2: Muscle Torques
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
    const step2El = document.getElementById('math-step-2');
    if (step2El) katex.render(htmlStep2, step2El, { displayMode: true, throwOnError: false });
    
    // Step 3: Bite Force solving
    const expDiv = document.getElementById('math-step-3-explanation');
    let htmlStep3 = '';
    if (expDiv) {
        if (biteDirectionType === 'vertical-down') {
            expDiv.innerHTML = `<p>Dado que asumimos una reacción vertical hacia abajo en la mandíbula (\\\\(u_B = [0, 0, -1]^T\\\\)), el <a class="glossary-link" onclick="window.switchTab('tab-glossary', 'term-torque')">torque</a> de mordida es \\\\(\\\\vec{\\tau}_B = [y_B F_{Bz}, -x_B F_{Bz}, 0]^T\\\\) (calculado mediante el <a class="glossary-link" onclick="window.switchTab('tab-glossary', 'term-cross')">producto cruz</a>). El <a class="glossary-link" onclick="window.switchTab('tab-glossary', 'term-static')">equilibrio estático</a> sobre el eje X exige:</p>`;
            
            htmlStep3 = `\\begin{aligned}`;
            htmlStep3 += `y_B \\cdot F_{Bz} &= -T_x \\\\`;
            htmlStep3 += `${rB[1]}\\text{ mm} \\cdot F_{Bz} &= -(${totalTorque[0].toFixed(0)}\\text{ N}\\cdot\\text{mm}) \\\\`;
            htmlStep3 += `F_{Bz} &= \\frac{-${totalTorque[0].toFixed(0)}}{${rB[1]}} = \\mathbf{${FB_vec[2].toFixed(1)}\\text{ N}} \\\\[0.8em]`;
            htmlStep3 += `\\vec{F}_B &= F_{Bz} \\cdot \\hat{u}_B = [0.0, 0.0, ${FB_vec[2].toFixed(1)}]^T \\text{ N} \\quad (\\|\\vec{F}_B\\| = ${Math.abs(FB).toFixed(1)}\\text{ N})`;
            htmlStep3 += `\\end{aligned}`;
        } else {
            expDiv.innerHTML = `<p>Para una dirección de reacción libre definida por el <a class="glossary-link" onclick="window.switchTab('tab-glossary', 'term-unitvector')">vector unitario</a> de mordida \\\\(\\\\hat{u}_B = [${uB[0].toFixed(2)}, ${uB[1].toFixed(2)}, ${uB[2].toFixed(2)}]^T\\\\):</p>`;
            
            htmlStep3 = `\\begin{aligned}`;
            htmlStep3 += `F_B &= \\frac{-T_x}{y_B u_{Bz} - z_B u_{By}} \\\\`;
            htmlStep3 += `F_B &= \\frac{-(${totalTorque[0].toFixed(0)})}{${rB[1]} \\cdot (${uB[2].toFixed(2)}) - (${rB[2]}) \\cdot (${uB[1].toFixed(2)})} \\\\`;
            htmlStep3 += `F_B &= \\frac{-${totalTorque[0].toFixed(0)}}{${denominator.toFixed(2)}} = \\mathbf{${FB.toFixed(1)}\\text{ N}} \\\\[0.8em]`;
            htmlStep3 += `\\vec{F}_B &= F_B \\cdot \\hat{u}_B = ${FB.toFixed(1)}\\text{ N} \\cdot [${uB[0].toFixed(2)}, ${uB[1].toFixed(2)}, ${uB[2].toFixed(2)}]^T \\\\`;
            htmlStep3 += `&= [${FB.toFixed(1)} \\cdot ${uB[0].toFixed(2)}, ${FB.toFixed(1)} \\cdot ${uB[1].toFixed(2)}, ${FB.toFixed(1)} \\cdot ${uB[2].toFixed(2)}]^T \\\\`;
            htmlStep3 += `&= [${FB_vec[0].toFixed(1)}, ${FB_vec[1].toFixed(1)}, ${FB_vec[2].toFixed(1)}]^T \\text{ N} \\quad (\\|\\vec{F}_B\\| = ${Math.abs(FB).toFixed(1)}\\text{ N})`;
            htmlStep3 += `\\end{aligned}`;
        }

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
    }
    const step3El = document.getElementById('math-step-3');
    if (step3El) katex.render(htmlStep3, step3El, { displayMode: true, throwOnError: false });
    
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
    
    const step4El = document.getElementById('math-step-4');
    if (step4El) katex.render(htmlStep4, step4El, { displayMode: true, throwOnError: false });
    
    // Step 5: Mechanical Advantage
    let htmlStep5 = `\\begin{aligned}`;
    htmlStep5 += `MA_{\\text{global}} &= \\frac{\\|\\vec{F}_B\\|}{\\sum F_i} = \\frac{${Math.abs(FB).toFixed(1)}\\text{ N}}{${sumActiveForces.toFixed(0)}\\text{ N}} = \\mathbf{${MA.toFixed(2)}}`;
    htmlStep5 += `\\end{aligned}`;
    
    const step5El = document.getElementById('math-step-5');
    if (step5El) katex.render(htmlStep5, step5El, { displayMode: true, throwOnError: false });
}

// Render all static LaTeX formulas in HTML paragraphs
export function renderStaticMath() {
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

// Tooltip JS Helper
export function initTooltips() {
    let tooltipEl = null;

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;

        const text = target.getAttribute('data-tooltip');
        if (!text) return;

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'custom-tooltip';
        tooltipEl.innerText = text;
        document.body.appendChild(tooltipEl);

        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        let top = rect.top - tooltipRect.height - 10;
        if (top < 0) {
            top = rect.bottom + 10;
            tooltipEl.classList.add('tooltip-bottom');
        } else {
            tooltipEl.classList.add('tooltip-top');
        }

        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        if (left < 8) left = 8;
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }

        tooltipEl.style.top = `${top + window.scrollY}px`;
        tooltipEl.style.left = `${left + window.scrollX}px`;
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
    
    window.addEventListener('scroll', () => {
        if (tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
    }, { passive: true });
}

// Draggable split screen resizer setup
export function initResizer(onResizeCallback) {
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
        const newWidth = containerRect.right - e.clientX;
        
        if (newWidth > 320 && newWidth < (containerRect.width - 660)) {
            rightPanel.style.width = `${newWidth}px`;
            if (onResizeCallback) onResizeCallback();
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            if (onResizeCallback) onResizeCallback();
        }
    });
}

// Toggle overlay theory modal
export function toggleTheoryModal(show) {
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

// Switch Tab logic with glossary scrolling fix
export function switchTab(tabId, targetTermId) {
    if (localState) {
        localState.activeTab = tabId;
    }
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const btnId = `btn-${tabId}`;
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
    
    const content = document.getElementById(tabId);
    if (content) content.classList.add('active');
    
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
                targetEl.classList.add('glow-highlight');
                setTimeout(() => {
                    targetEl.classList.remove('glow-highlight');
                }, 2000);
            }
        }, 100);
    }
}
