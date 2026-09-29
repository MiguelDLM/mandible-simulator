// Three.js viewer. Works directly in the anatomical frame (Z up), so no axis remapping is needed.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { vec } from './math.js';
import { TEETH, TOOTH_CENTERS, REF } from './model.js';

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const Y_UP = new THREE.Vector3(0, 1, 0);

export const COLORS = {
    bite: '#ef4444',
    jointL: '#a855f7',
    jointR: '#06b6d4',
    resultant: '#eab308'
};

function makeLabel(className) {
    const el = document.createElement('div');
    el.className = `lbl ${className}`;
    return new CSS2DObject(el);
}

function makeArrow(color) {
    const a = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 10, color);
    a.line.material.transparent = true;
    a.cone.material.transparent = true;
    a.line.material.linewidth = 2;
    return a;
}

// Places an arrow of length len along dir. tipAtPoint: the arrow ends at p (a push); otherwise it starts at p (a pull).
function placeArrow(arrow, p, dir, len, tipAtPoint = false) {
    const d = V3(dir);
    if (!(len > 0.5) || d.lengthSq() < 1e-12) {
        arrow.visible = false;
        return null;
    }
    d.normalize();
    const start = tipAtPoint ? V3(p).addScaledVector(d, -len) : V3(p);
    arrow.visible = true;
    arrow.position.copy(start);
    arrow.setDirection(d);
    arrow.setLength(len, Math.min(len * 0.3, 9), Math.min(len * 0.15, 4.5));
    return start.clone().addScaledVector(d, len * 0.5);
}

export class JawViewer {
    constructor(container, { onPick } = {}) {
        this.container = container;
        this.onPick = onPick;
        this.opts = { labels: true, axes: true, triangle: true, bodies: true, scale: 0.2 };
        this.focus = null;
        this.tagged = [];
        this.pickables = [];
        this.geomKey = '';
        this.camAnim = null;
        this._initRenderer();
        this._initScene();
        this._initDynamic();
        this._initPicking();
        this._loop();
    }

    // ---------- setup ----------
    _initRenderer() {
        const c = this.container;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        c.appendChild(this.renderer.domElement);

        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.domElement.className = 'label-layer';
        c.appendChild(this.labelRenderer.domElement);

        this.camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
        this.camera.up.set(0, 0, 1);
        this.camera.position.set(230, 250, 110);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.target.set(0, 40, -25);
        this.controls.minDistance = 60;
        this.controls.maxDistance = 900;
        this.controls.addEventListener('start', () => { this.camAnim = null; });

        new ResizeObserver(() => this.resize()).observe(c);
        this.resize();
    }

    _initScene() {
        const scene = (this.scene = new THREE.Scene());
        const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4150, 1.6);
        hemi.position.set(0, 0, 1);
        scene.add(hemi);
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(140, 180, 240);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xffffff, 0.8);
        rim.position.set(-180, -120, 60);
        scene.add(rim);

        // Axes (anatomical)
        this.axes = new THREE.Group();
        const axisDefs = [
            [[1, 0, 0], '#ef4444', 'X lateral (der.)'],
            [[0, 1, 0], '#22c55e', 'Y anterior'],
            [[0, 0, 1], '#3b82f6', 'Z superior']
        ];
        axisDefs.forEach(([d, color, text]) => {
            const a = new THREE.ArrowHelper(V3(d), new THREE.Vector3(), 34, color, 6, 3);
            this.axes.add(a);
            const lbl = makeLabel('lbl-axis');
            lbl.element.textContent = text;
            lbl.element.style.color = color;
            lbl.position.copy(V3(d).multiplyScalar(42));
            this.axes.add(lbl);
        });
        scene.add(this.axes);

        // Hinge axis
        this.hinge = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)]),
            new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 4, gapSize: 3, transparent: true })
        );
        scene.add(this.hinge);
        this._tag(this.hinge, ['hinge', 'joints']);

        this.jaw = new THREE.Group();
        scene.add(this.jaw);

        this.mat = {
            bone: new THREE.MeshStandardMaterial({
                color: 0xe7dcc3, roughness: 0.6, transparent: true, opacity: 0.5, depthWrite: false
            }),
            tooth: new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.35, transparent: true }),
            toothActive: new THREE.MeshStandardMaterial({
                color: 0xfde68a, emissive: 0xb45309, emissiveIntensity: 0.35, roughness: 0.35, transparent: true
            }),
            condyleL: new THREE.MeshStandardMaterial({ color: COLORS.jointL, roughness: 0.4, transparent: true }),
            condyleR: new THREE.MeshStandardMaterial({ color: COLORS.jointR, roughness: 0.4, transparent: true })
        };
    }

    _initDynamic() {
        const scene = this.scene;
        this.muscle3D = new Map();

        // Bite
        this.biteMarker = new THREE.Mesh(
            new THREE.SphereGeometry(1, 20, 14),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x92400e, emissiveIntensity: 0.4, transparent: true })
        );
        this.biteMarker.userData = { kind: 'bite', label: 'Punto de mordida' };
        scene.add(this.biteMarker);
        this.biteArrow = makeArrow(COLORS.bite);
        scene.add(this.biteArrow);
        this.biteLabel = makeLabel('lbl-force lbl-bite');
        scene.add(this.biteLabel);
        this._tag(this.biteMarker, ['bite']);
        this._tag(this.biteArrow, ['bite']);
        this._tagLabel(this.biteLabel, ['bite']);
        this._pick(this.biteMarker, { kind: 'bite', label: 'Punto de mordida' });
        this._pickArrow(this.biteArrow, { kind: 'bite', label: 'Fuerza de mordida' });

        // Joints
        this.jointArrows = { L: makeArrow(COLORS.jointL), R: makeArrow(COLORS.jointR) };
        this.jointLabels = { L: makeLabel('lbl-force lbl-jl'), R: makeLabel('lbl-force lbl-jr') };
        ['L', 'R'].forEach((s) => {
            scene.add(this.jointArrows[s]);
            scene.add(this.jointLabels[s]);
            this._tag(this.jointArrows[s], ['joints', `joint:${s}`]);
            this._tagLabel(this.jointLabels[s], ['joints', `joint:${s}`]);
            this._pickArrow(this.jointArrows[s], { kind: 'joint', side: s, label: `Reacción ATM ${s === 'L' ? 'izquierda' : 'derecha'}` });
        });

        // Support triangle + equivalent resultant
        const triGeo = new THREE.BufferGeometry();
        triGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
        this.triangle = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({
            color: 0x22c55e, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false
        }));
        this.triangleEdge = new THREE.LineLoop(triGeo, new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true }));
        this.mMarker = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: COLORS.resultant, transparent: true }));
        this.mArrow = makeArrow(COLORS.resultant);
        this.mLabel = makeLabel('lbl-force lbl-m');
        this.triangleGroup = new THREE.Group();
        this.triangleGroup.add(this.triangle, this.triangleEdge, this.mMarker, this.mArrow, this.mLabel);
        scene.add(this.triangleGroup);
        [this.triangle, this.triangleEdge, this.mMarker, this.mArrow].forEach((o) => this._tag(o, ['triangle']));
        this._tagLabel(this.mLabel, ['triangle']);
        this._pick(this.triangle, { kind: 'triangle', label: 'Triángulo de soporte' });

        // Lever-arm helpers
        this.levers = new THREE.Group();
        const lineMat = (c) => new THREE.LineDashedMaterial({ color: c, dashSize: 3, gapSize: 2 });
        this.leverMuscle = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff }));
        this.leverAction = new THREE.Line(new THREE.BufferGeometry(), lineMat(0xffffff));
        this.leverBite = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.bite }));
        this.leverLabelM = makeLabel('lbl-lever');
        this.leverLabelB = makeLabel('lbl-lever lbl-lever-bite');
        this.levers.add(this.leverMuscle, this.leverAction, this.leverBite, this.leverLabelM, this.leverLabelB);
        this.levers.visible = false;
        scene.add(this.levers);
    }

    _ensureMuscle(m) {
        if (this.muscle3D.has(m.id)) return this.muscle3D.get(m.id);
        const color = new THREE.Color(m.color);
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 0.75, 1, 18, 1, true),
            new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8 })
        );
        const origin = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color, transparent: true }));
        const insertion = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color, transparent: true }));
        const arrow = makeArrow(m.color);
        const label = makeLabel('lbl-muscle');
        label.element.style.setProperty('--c', m.color);
        [body, origin, insertion, arrow, label].forEach((o) => this.scene.add(o));
        const tags = ['muscles', `muscle:${m.id}`];
        [body, origin, insertion, arrow].forEach((o) => this._tag(o, tags));
        this._tagLabel(label, tags);
        const info = { kind: 'muscle', id: m.id };
        this._pick(body, info);
        this._pick(origin, info);
        this._pickArrow(arrow, info);
        const obj = { body, origin, insertion, arrow, label, info };
        this.muscle3D.set(m.id, obj);
        return obj;
    }

    // ---------- mandible mesh (rebuilt only when w or L change) ----------
    setGeometry(g, arch) {
        const key = `${g.w}|${g.L}`;
        if (key === this.geomKey) return;
        this.geomKey = key;

        this.jaw.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        this.jaw.clear();
        this.tagged = this.tagged.filter((t) => !t.jaw);
        this.pickables = this.pickables.filter((p) => !p.userData.jaw);

        const q = g.w / REF.w;
        const s = g.L / REF.L;
        const P = (x, y, z) => new THREE.Vector3(x * q, y * s, z * s);
        const add = (mesh, tags = ['jaw']) => {
            this.jaw.add(mesh);
            this._tag(mesh, tags, true);
            return mesh;
        };
        const tube = (pts, radius, segs = 48) => add(new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, radius, 14, false), this.mat.bone
        ));

        // Body along the dental arch, from gonion to gonion
        const bodyPts = [];
        const gon = (sx) => P(46 * sx, 2, -52);
        bodyPts.push(gon(-1), P(-40, 14, -50), P(-30, 29, -46));
        for (let i = 0; i <= 16; i++) {
            const t = -1 + i / 8;
            const [x, y] = arch.point(t);
            const chin = (1 - Math.abs(t)) ** 3;
            bodyPts.push(new THREE.Vector3(x * 1.06, y + 2 * s * chin, (-44 - 7 * chin) * s));
        }
        bodyPts.push(P(30, 29, -46), P(40, 14, -50), gon(1));
        tube(bodyPts, 7 * s, 160);

        [-1, 1].forEach((sx) => {
            tube([P(49 * sx, -1, -6), P(48 * sx, -3, -26), P(47.5 * sx, -1, -42), gon(sx)], 6.2 * s);
            tube([P(46.5 * sx, 10, -34), P(44 * sx, 19, -19), P(41 * sx, 27, -6)], 3.4 * s, 24);
            const cap = add(new THREE.Mesh(new THREE.SphereGeometry(7 * s, 18, 14), this.mat.bone));
            cap.position.copy(gon(sx));

            const side = sx < 0 ? 'L' : 'R';
            const head = add(new THREE.Mesh(
                new THREE.SphereGeometry(1, 24, 18),
                sx < 0 ? this.mat.condyleL : this.mat.condyleR
            ), ['joints', `joint:${side}`]);
            head.scale.set(9 * q, 5 * s, 5.5 * s);
            head.position.set(sx * g.w, 0, 0);
            head.userData = { kind: 'condyle', side, jaw: true };
            this.pickables.push(head);
        });

        // Teeth
        this.teeth = [];
        [-1, 1].forEach((sx) => {
            TEETH.forEach((tooth, i) => {
                const t = sx * TOOTH_CENTERS[i];
                const p = arch.point(t);
                const tan = arch.tangent(t);
                const md = tooth.md * arch.toothScale * 0.92;
                const h = tooth.h * s;
                const mesh = add(new THREE.Mesh(
                    new RoundedBoxGeometry(md, tooth.bl * s, h, 2, Math.min(md, h) * 0.22),
                    this.mat.tooth
                ), ['jaw', 'teeth']);
                mesh.position.set(p[0], p[1], p[2] - h / 2);
                mesh.rotation.z = Math.atan2(tan[1], tan[0]);
                mesh.userData = { kind: 'tooth', t, label: `${tooth.name} ${sx < 0 ? 'izquierdo' : 'derecho'}`, jaw: true };
                this.pickables.push(mesh);
                this.teeth.push(mesh);
            });
        });

        const hingePos = this.hinge.geometry.attributes.position;
        hingePos.setXYZ(0, -g.w - 18, 0, 0);
        hingePos.setXYZ(1, g.w + 18, 0, 0);
        hingePos.needsUpdate = true;
        this.hinge.computeLineDistances();

        this.biteMarker.scale.setScalar(3.4 * s);
        this.mMarker.scale.setScalar(2.6 * s);
        this.sizeScale = s;
        this._applyFocus();
    }

    // ---------- per-frame update ----------
    update(state, posed, res) {
        this.setGeometry(state.geom, posed.arch);
        const k = this.opts.scale;
        const s = this.sizeScale;
        this.jaw.rotation.x = -posed.theta;

        // Highlight the tooth closest to the bite point
        if (this.teeth) {
            let best = null;
            let bestD = Infinity;
            if (!state.bite.custom) {
                this.teeth.forEach((m) => {
                    const d = Math.abs(m.userData.t - state.bite.t);
                    if (d < bestD) { bestD = d; best = m; }
                });
            }
            this.teeth.forEach((m) => { m.material = m === best && bestD < 0.08 ? this.mat.toothActive : this.mat.tooth; });
        }

        // Muscles
        const byId = new Map(res.muscles.map((c) => [c.id, c]));
        posed.muscles.forEach((m) => {
            const o = this._ensureMuscle(m);
            const c = byId.get(m.id);
            const on = !!c;
            const pr = V3(m.r);
            const po = V3(m.o);
            o.origin.position.copy(po);
            o.origin.scale.setScalar(2.2 * s);
            o.insertion.position.copy(pr);
            o.insertion.scale.setScalar(1.8 * s);
            o.insertion.visible = on;

            const dir = new THREE.Vector3().subVectors(po, pr);
            const len = dir.length();
            o.body.visible = this.opts.bodies;
            o.body.position.copy(pr).addScaledVector(dir, 0.5);
            o.body.quaternion.setFromUnitVectors(Y_UP, dir.clone().normalize());
            const radius = on ? (1.2 + Math.sqrt(m.force) * 0.42) * s : 0.8 * s;
            o.body.scale.set(radius, len, radius);
            // Actual opacity is applied (with focus dimming) by _applyFocus below
            o.body.material.userData.baseOpacity = on ? 0.32 : 0.08;
            o.origin.material.userData.baseOpacity = on ? 1 : 0.25;

            const mid = on ? placeArrow(o.arrow, m.r, c.F, m.force * k) : placeArrow(o.arrow, m.r, [0, 0, 1], 0);
            o.label.visible = this.opts.labels && on;
            if (mid) {
                o.label.position.copy(mid);
                o.label.element.textContent = `${m.tag} ${m.force.toFixed(0)} N`;
            }
            o.info.label = m.name;
            o.info.force = on ? m.force : 0;
        });

        // Bite
        this.biteMarker.position.copy(V3(posed.rB));
        const fbMag = Math.abs(res.FB);
        const fbMid = placeArrow(this.biteArrow, posed.rB, res.FBvec, fbMag * k, true);
        this.biteArrow.setColor(res.noBite ? '#94a3b8' : COLORS.bite);
        this.biteLabel.visible = this.opts.labels && !!fbMid;
        if (fbMid) {
            this.biteLabel.position.copy(fbMid);
            this.biteLabel.element.textContent = `F_B ${res.FB.toFixed(0)} N`;
        }

        // Joints (pushes: arrow tip at the condyle)
        ['L', 'R'].forEach((side) => {
            const F = side === 'L' ? res.FJL : res.FJR;
            const p = side === 'L' ? res.rJL : res.rJR;
            const mid = placeArrow(this.jointArrows[side], p, F, vec.norm(F) * k, true);
            const lbl = this.jointLabels[side];
            lbl.visible = this.opts.labels && !!mid;
            if (mid) {
                lbl.position.copy(mid);
                const bad = F[2] > 1e-6;
                lbl.element.textContent = `F_J${side === 'L' ? 'I' : 'D'} ${vec.norm(F).toFixed(0)} N${bad ? ' ⚠' : ''}`;
                lbl.element.classList.toggle('lbl-bad', bad);
            }
        });

        // Support triangle (plane through both condyles and the bite point)
        const inside = !res.distractionL && !res.distractionR && !res.noBite;
        const triColor = inside ? 0x22c55e : 0xef4444;
        const pos = this.triangle.geometry.attributes.position;
        pos.setXYZ(0, -res.w, 0, 0);
        pos.setXYZ(1, res.w, 0, 0);
        pos.setXYZ(2, posed.rB[0], posed.rB[1], posed.rB[2]);
        pos.needsUpdate = true;
        this.triangle.geometry.computeBoundingSphere();
        this.triangle.material.color.setHex(triColor);
        this.triangleEdge.material.color.setHex(triColor);
        this.triangleGroup.visible = this.opts.triangle;
        if (res.M && Math.abs(posed.rB[1]) > 1e-6) {
            const zM = (posed.rB[2] * res.M[1]) / posed.rB[1];
            const pM = [res.M[0], res.M[1], zM];
            this.mMarker.visible = true;
            this.mMarker.position.copy(V3(pM));
            const mid = placeArrow(this.mArrow, [pM[0], pM[1], zM - res.R[2] * k * 0.5], [0, 0, 1], res.R[2] * k * 0.5);
            this.mLabel.visible = this.opts.labels && !!mid;
            if (mid) {
                this.mLabel.position.copy(V3(pM)).add(new THREE.Vector3(0, 0, -res.R[2] * k * 0.5 - 6 * s));
                this.mLabel.element.textContent = `M · R_z ${res.R[2].toFixed(0)} N`;
            }
        } else {
            this.mMarker.visible = false;
            this.mArrow.visible = false;
            this.mLabel.visible = false;
        }

        this.axes.visible = this.opts.axes;
        this._updateLevers(posed, res);
        this._applyFocus();
    }

    // Lever arm of the selected muscle (in its sagittal plane) and of the bite force about the hinge axis
    _updateLevers(posed, res) {
        const id = this.leverMuscleId;
        const c = id && res.muscles.find((m) => m.id === id);
        if (!c) {
            this.levers.visible = false;
            return;
        }
        this.levers.visible = true;
        const [x, ry, rz] = c.r;
        const uy = c.u[1];
        const uz = c.u[2];
        const n2 = uy * uy + uz * uz || 1;
        const sStar = -(ry * uy + rz * uz) / n2;
        const foot = [x, ry + sStar * uy, rz + sStar * uz];
        this.leverMuscle.geometry.setFromPoints([V3([x, 0, 0]), V3(foot)]);
        const a = [x, ry + (sStar - 40) * uy, rz + (sStar - 40) * uz];
        const b = [x, ry + 60 * uy, rz + 60 * uz];
        this.leverAction.geometry.setFromPoints([V3(a), V3(b)]);
        this.leverAction.computeLineDistances();
        this.leverMuscle.material.color.set(c.color);
        this.leverAction.material.color.set(c.color);
        const dPerp = Math.hypot(foot[1], foot[2]);
        this.leverLabelM.position.copy(V3([x, foot[1] / 2, foot[2] / 2]));
        this.leverLabelM.element.textContent = `d⊥ ${dPerp.toFixed(1)} mm`;
        this.leverLabelM.element.style.setProperty('--c', c.color);

        // Bite: perpendicular from the hinge axis to the bite line of action
        const rB = posed.rB;
        const u = res.uB;
        const n2b = u[1] * u[1] + u[2] * u[2] || 1;
        const sb = -(rB[1] * u[1] + rB[2] * u[2]) / n2b;
        const footB = [rB[0], rB[1] + sb * u[1], rB[2] + sb * u[2]];
        this.leverBite.geometry.setFromPoints([V3([rB[0], 0, 0]), V3(footB), V3(rB)]);
        this.leverLabelB.position.copy(V3([rB[0], footB[1] / 2, footB[2] / 2]));
        this.leverLabelB.element.textContent = `brazo mordida ${Math.hypot(footB[1], footB[2]).toFixed(1)} mm`;
    }

    showLever(muscleId) {
        this.leverMuscleId = muscleId;
    }

    // ---------- focus / highlight ----------
    _tag(obj, tags, jaw = false) {
        const mats = [];
        obj.traverse((o) => {
            if (o.material) {
                o.material.transparent = true;
                mats.push(o.material);
            }
        });
        this.tagged.push({ obj, tags: new Set(tags), mats, jaw });
    }

    _tagLabel(label, tags) {
        this.tagged.push({ obj: label, tags: new Set(tags), mats: [], label: true });
    }

    setFocus(tags) {
        this.focus = tags && tags.length ? new Set(tags) : null;
        this._applyFocus();
    }

    _applyFocus() {
        const f = this.focus;
        this.tagged.forEach((t) => {
            const on = !f || [...t.tags].some((x) => f.has(x));
            if (t.label) {
                t.obj.element.style.opacity = on ? '1' : '0.15';
                return;
            }
            t.mats.forEach((m) => {
                if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
                m.opacity = on ? m.userData.baseOpacity : m.userData.baseOpacity * 0.12;
            });
        });
        const dimBone = f && !f.has('jaw');
        this.mat.bone.opacity = dimBone ? 0.12 : 0.5;
        this.mat.tooth.opacity = dimBone ? 0.25 : 1;
        this.mat.toothActive.opacity = f && !f.has('bite') && !f.has('jaw') ? 0.3 : 1;
    }

    // ---------- picking & tooltips ----------
    _pick(obj, info) {
        obj.userData = Object.assign(obj.userData || {}, info);
        this.pickables.push(obj);
    }

    _pickArrow(arrow, info) {
        this._pick(arrow.cone, info);
        this._pick(arrow.line, info);
    }

    _initPicking() {
        const el = this.renderer.domElement;
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line.threshold = 2;
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'viewer-tooltip';
        this.tooltip.hidden = true;
        this.container.appendChild(this.tooltip);

        let down = null;
        el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
        el.addEventListener('pointermove', (e) => {
            if (e.buttons) { this.tooltip.hidden = true; return; }
            const hit = this._hit(e);
            el.style.cursor = hit ? 'pointer' : '';
            if (!hit) { this.tooltip.hidden = true; return; }
            const d = hit.userData;
            this.tooltip.innerHTML = this.describe ? this.describe(d) : d.label;
            this.tooltip.hidden = false;
            const r = this.container.getBoundingClientRect();
            const x = Math.min(e.clientX - r.left + 14, r.width - this.tooltip.offsetWidth - 8);
            const y = Math.max(8, e.clientY - r.top - this.tooltip.offsetHeight - 12);
            this.tooltip.style.transform = `translate(${x}px, ${y}px)`;
        });
        el.addEventListener('pointerleave', () => { this.tooltip.hidden = true; });
        el.addEventListener('click', (e) => {
            if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
            const hit = this._hit(e);
            if (hit && this.onPick) this.onPick(hit.userData);
        });
    }

    _hit(e) {
        const r = this.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        this.raycaster.setFromCamera(ndc, this.camera);
        const visible = this.pickables.filter((o) => {
            let p = o;
            while (p) { if (!p.visible) return false; p = p.parent; }
            return true;
        });
        const hits = this.raycaster.intersectObjects(visible, false);
        return hits.length ? hits[0].object : null;
    }

    // ---------- camera ----------
    setView(view, g) {
        const s = g.L / REF.L;
        const q = Math.max(g.w / REF.w, s);
        const target = new THREE.Vector3(0, 0.42 * g.L, -24 * s);
        const presets = {
            front: [0, g.L + 250 * q, -10 * s],
            side: [300 * q, 0.42 * g.L, -12 * s],
            top: [0, 0.42 * g.L - 30 * s, 320 * q],
            iso: [210 * q, 0.42 * g.L + 220 * q, 120 * s]
        };
        const to = new THREE.Vector3(...(presets[view] || presets.iso));
        this.camAnim = {
            t0: performance.now(),
            fromPos: this.camera.position.clone(),
            fromTarget: this.controls.target.clone(),
            to,
            target
        };
    }

    setTheme(dark) {
        this.scene.background = new THREE.Color(dark ? 0x0d1117 : 0xf4f6fa);
        if (this.grid) {
            this.scene.remove(this.grid);
            this.grid.geometry.dispose();
            this.grid.material.dispose();
        }
        this.grid = new THREE.GridHelper(420, 42, dark ? 0x334155 : 0xb6c2d2, dark ? 0x1e2633 : 0xdde3ec);
        this.grid.rotation.x = Math.PI / 2;
        this.grid.position.z = -82;
        this.scene.add(this.grid);
        this.mat.bone.color.set(dark ? 0xe7dcc3 : 0xcdbf9f);
    }

    resize() {
        const w = this.container.clientWidth || 1;
        const h = this.container.clientHeight || 1;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.labelRenderer.setSize(w, h);
    }

    _loop() {
        const tick = () => {
            requestAnimationFrame(tick);
            if (this.onFrame) this.onFrame();
            if (this.camAnim) {
                const a = this.camAnim;
                const t = Math.min(1, (performance.now() - a.t0) / 650);
                const e = 1 - (1 - t) ** 3;
                this.camera.position.lerpVectors(a.fromPos, a.to, e);
                this.controls.target.lerpVectors(a.fromTarget, a.target, e);
                if (t >= 1) this.camAnim = null;
            }
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
            this.labelRenderer.render(this.scene, this.camera);
        };
        tick();
    }
}
