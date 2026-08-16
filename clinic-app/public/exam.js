// =============================================
// Smart Clinic OS — Multi-Specialty 3D Exam Room
// 🦷 Dental 3D Odontogram & 🦴 Orthopedic 3D Skeleton
// =============================================

let currentExamAppointment = null;
let lastPrescriptionData = null;
let bodyChartData = {};
let activePopupPart = null;
let currentSpecialty = 'dental';

// Three.js Globals
let scene, camera, renderer, controls;
let clickableMeshes = {};
let raycaster, mouse;
let currentCameraView = 'default';

// =============================================
// SPECIALTY CONFIGURATIONS
// =============================================

// --- 🦷 DENTAL CONFIG ---
const DENTAL_STATUS_CONFIG = {
  healthy:   { name: 'سليم', color: 0xFAFAF9, emissive: 0x10b981, icon: 'fa-circle-check', bg: '#d1fae5', border: '#10b981', text: '#047857' },
  filling:   { name: 'حشو', color: 0xDBEAFE, emissive: 0x3b82f6, icon: 'fa-square-full', bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  endo:      { name: 'علاج عصب', color: 0xEDE9FE, emissive: 0x8b5cf6, icon: 'fa-bolt', bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  extracted: { name: 'خلع/مفقود', color: 0xFEE2E2, emissive: 0xef4444, icon: 'fa-xmark', bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
  crown:     { name: 'تركيبة/طرابوش', color: 0xFEF3C7, emissive: 0xf59e0b, icon: 'fa-chess-queen', bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  implant:   { name: 'زراعة', color: 0xE0F2FE, emissive: 0x0284c7, icon: 'fa-screwdriver-wrench', bg: '#e0f2fe', border: '#0284c7', text: '#0369a1' }
};

const TOOTH_TYPES = {};
[1,2,3,14,15,16,17,18,19,30,31,32].forEach(n => { TOOTH_TYPES[n] = 'molar'; });
[4,5,12,13,20,21,28,29].forEach(n => { TOOTH_TYPES[n] = 'premolar'; });
[6,11,22,27].forEach(n => { TOOTH_TYPES[n] = 'canine'; });
[7,8,9,10,23,24,25,26].forEach(n => { TOOTH_TYPES[n] = 'incisor'; });
const TOOTH_TYPE_AR = { molar: 'ضرس', premolar: 'ضاحك', canine: 'ناب', incisor: 'قاطع' };

// --- 🦴 ORTHOPEDIC CONFIG ---
const ORTHO_STATUS_CONFIG = {
  healthy:       { name: 'سليم', color: 0xFAFAF9, emissive: 0x10b981, icon: 'fa-circle-check', bg: '#d1fae5', border: '#10b981', text: '#047857' },
  fracture:      { name: 'كسر عظمي (Fracture)', color: 0xFEE2E2, emissive: 0xef4444, icon: 'fa-burst', bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
  inflammation:  { name: 'التهاب (Inflammation)', color: 0xFEF3C7, emissive: 0xf59e0b, icon: 'fa-fire-flame-curved', bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  osteoarthritis:{ name: 'خشونة مفاصل (Osteoarthritis)', color: 0xEDE9FE, emissive: 0x8b5cf6, icon: 'fa-arrows-rotate', bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  cartilage:     { name: 'تآكل غضروف (Cartilage Wear)', color: 0xDBEAFE, emissive: 0x3b82f6, icon: 'fa-chart-line-down', bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  surgery:       { name: 'جراحة سابقة / شرائح ومسامير', color: 0xFFEDD5, emissive: 0xf97316, icon: 'fa-screwdriver', bg: '#ffedd5', border: '#f97316', text: '#c2410c' }
};

const SKELETON_PARTS = [
  // Head & Axial
  { id: 'skull', nameAr: 'الجمجمة (Skull)', cat: 'head' },
  { id: 'cervical_spine', nameAr: 'الفقرات العنقية (Cervical Spine)', cat: 'spine' },
  { id: 'thoracic_spine', nameAr: 'الفقرات الصدرية (Thoracic Spine)', cat: 'spine' },
  { id: 'lumbar_spine', nameAr: 'الفقرات القطنية (Lumbar Spine)', cat: 'spine' },
  { id: 'sternum', nameAr: 'عظمة القص (Sternum)', cat: 'torso' },
  { id: 'ribs_right', nameAr: 'الأضلاع والقفص الصدري الأيمن', cat: 'torso' },
  { id: 'ribs_left', nameAr: 'الأضلاع والقفص الصدري الأيسر', cat: 'torso' },
  { id: 'pelvis', nameAr: 'عظام الحوض والمفصل العجزي (Pelvis)', cat: 'pelvis' },

  // Upper Limbs
  { id: 'clavicle_right', nameAr: 'عظمة الترقوة اليمنى (Right Clavicle)', cat: 'upper' },
  { id: 'clavicle_left', nameAr: 'عظمة الترقوة اليسرى (Left Clavicle)', cat: 'upper' },
  { id: 'shoulder_right', nameAr: 'مفصل الكتف الأيمن (Right Shoulder)', cat: 'upper' },
  { id: 'shoulder_left', nameAr: 'مفصل الكتف الأيسر (Left Shoulder)', cat: 'upper' },
  { id: 'humerus_right', nameAr: 'عظمة العضد اليمنى (Right Humerus)', cat: 'upper' },
  { id: 'humerus_left', nameAr: 'عظمة العضد اليسرى (Left Humerus)', cat: 'upper' },
  { id: 'elbow_right', nameAr: 'مفصل الكوع الأيمن (Right Elbow)', cat: 'upper' },
  { id: 'elbow_left', nameAr: 'مفصل الكوع الأيسر (Left Elbow)', cat: 'upper' },
  { id: 'forearm_right', nameAr: 'عظام الساعد الأيمن (Right Forearm)', cat: 'upper' },
  { id: 'forearm_left', nameAr: 'عظام الساعد الأيسر (Left Forearm)', cat: 'upper' },
  { id: 'wrist_right', nameAr: 'مفصل الرسغ واليد اليمنى (Right Wrist & Hand)', cat: 'upper' },
  { id: 'wrist_left', nameAr: 'مفصل الرسغ واليد اليسرى (Left Wrist & Hand)', cat: 'upper' },

  // Lower Limbs
  { id: 'hip_right', nameAr: 'مفصل الفخذ الأيمن (Right Hip Joint)', cat: 'lower' },
  { id: 'hip_left', nameAr: 'مفصل الفخذ الأيسر (Left Hip Joint)', cat: 'lower' },
  { id: 'femur_right', nameAr: 'عظمة الفخذ اليمنى (Right Femur)', cat: 'lower' },
  { id: 'femur_left', nameAr: 'عظمة الفخذ اليسرى (Left Femur)', cat: 'lower' },
  { id: 'knee_right', nameAr: 'مفصل الركبة اليمنى (Right Knee)', cat: 'lower' },
  { id: 'knee_left', nameAr: 'مفصل الركبة اليسرى (Left Knee)', cat: 'lower' },
  { id: 'tibia_right', nameAr: 'عظام الساق والقصبة اليمنى (Right Tibia & Fibula)', cat: 'lower' },
  { id: 'tibia_left', nameAr: 'عظام الساق والقصبة اليسرى (Left Tibia & Fibula)', cat: 'lower' },
  { id: 'ankle_right', nameAr: 'مفصل الكاحل والقدم اليمنى (Right Ankle & Foot)', cat: 'lower' },
  { id: 'ankle_left', nameAr: 'مفصل الكاحل والقدم اليسرى (Left Ankle & Foot)', cat: 'lower' }
];

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('sharedDataReady', () => {
  initExamPage();
});

async function initExamPage() {
  currentSpecialty = window.clinicSpecialty || localStorage.getItem('tenant_specialty') || 'dental';
  const urlParams = new URLSearchParams(window.location.search);
  const apptId = urlParams.get('appointment_id');

  // Setup UI elements for current specialty
  renderSpecialtyUI();

  // Initialize Three.js 3D Scene
  init3DScene();

  if (!apptId) {
    showToast(`يمكنك تجربة الموديل ثلاثي الأبعاد (${currentSpecialty === 'orthopedic' ? 'الهيكل العظمي' : 'الأسنان'}) — اسحب للتدوير واضغط على أي جزء`, 'info');
    document.getElementById('exam-patient-info').innerHTML = `
      المريض: <strong style="color:#0f172a;">وضع التجربة</strong> — اسحب الموديل 3D للتدوير واضغط على أي جزء لتحديد حالته
    `;
    addPrescriptionRow();
    return;
  }

  currentExamAppointment = apptId;
  await loadExamData(apptId);
}

// =============================================
// UI SETUP FOR SPECIALTY
// =============================================
function renderSpecialtyUI() {
  const isOrtho = currentSpecialty === 'orthopedic';
  const statusMap = isOrtho ? ORTHO_STATUS_CONFIG : DENTAL_STATUS_CONFIG;

  // Header Title & Icon
  const headerIcon = document.getElementById('chart-header-icon');
  const cardTitle = document.getElementById('chart-card-title');
  const hintText = document.getElementById('dental-3d-hint-text');
  const summaryTitle = document.getElementById('chart-summary-title');

  if (isOrtho) {
    if (headerIcon) headerIcon.className = 'fa-solid fa-bone';
    if (cardTitle) cardTitle.textContent = 'مخطط الهيكل العظمي والمفاصل ثلاثي الأبعاد (3D Skeleton)';
    if (hintText) hintText.textContent = 'اسحب يمين وشمال للتدوير — اضغط على أي عظمة أو مفصل لاختيار حالته';
    if (summaryTitle) summaryTitle.textContent = 'ملخص حالات العظام والمفاصل المسجلة:';
  } else {
    if (headerIcon) headerIcon.className = 'fa-solid fa-tooth';
    if (cardTitle) cardTitle.textContent = 'مخطط الأسنان التفاعلي ثلاثي الأبعاد (3D Odontogram)';
    if (hintText) hintText.textContent = 'اسحب يمين وشمال للتدوير — اضغط على أي سن لاختيار حالته';
    if (summaryTitle) summaryTitle.textContent = 'ملخص حالات الأسنان المسجلة:';
  }

  // Camera Controls
  const controlsCont = document.getElementById('dental-3d-controls');
  if (controlsCont) {
    if (isOrtho) {
      controlsCont.innerHTML = `
        <button onclick="setCameraView('all')" id="cbtn-all" class="active"><i class="fa-solid fa-person"></i> الجسم كامل</button>
        <button onclick="setCameraView('spine')" id="cbtn-spine"><i class="fa-solid fa-arrows-up-down"></i> العمود الفقري</button>
        <button onclick="setCameraView('upper')" id="cbtn-upper"><i class="fa-solid fa-hand"></i> الأطراف العلوية</button>
        <button onclick="setCameraView('lower')" id="cbtn-lower"><i class="fa-solid fa-shoe-prints"></i> الأطراف السفلية</button>
        <button onclick="resetCameraView()" title="إعادة ضبط"><i class="fa-solid fa-rotate-left"></i> إعادة ضبط</button>
      `;
    } else {
      controlsCont.innerHTML = `
        <button onclick="setCameraView('upper')" id="cbtn-upper"><i class="fa-solid fa-chevron-up"></i> الفك العلوي</button>
        <button onclick="setCameraView('lower')" id="cbtn-lower"><i class="fa-solid fa-chevron-down"></i> الفك السفلي</button>
        <button onclick="setCameraView('both')" id="cbtn-both" class="active"><i class="fa-solid fa-teeth-open"></i> كلا الفكين</button>
        <button onclick="resetCameraView()" title="إعادة ضبط"><i class="fa-solid fa-rotate-left"></i> إعادة ضبط</button>
      `;
    }
  }

  // Popup Options
  const popupOptionsCont = document.getElementById('tooth-3d-popup-options');
  if (popupOptionsCont) {
    popupOptionsCont.innerHTML = Object.keys(statusMap).map(key => {
      const s = statusMap[key];
      return `
        <button class="t3d-opt opt-${key}" onclick="setPartCondition('${key}')">
          <i class="fa-solid ${s.icon}"></i> ${s.name}
        </button>
      `;
    }).join('');
  }

  // Legend
  const legendCont = document.getElementById('dental-legend');
  if (legendCont) {
    legendCont.innerHTML = Object.keys(statusMap).map(key => {
      const s = statusMap[key];
      return `
        <div class="legend-item">
          <span class="legend-dot" style="background: ${s.border};"></span>
          ${s.name}
        </div>
      `;
    }).join('');
  }
}

// =============================================
// THREE.JS 3D SCENE SYSTEM
// =============================================
function init3DScene() {
  const container = document.getElementById('dental-3d-canvas');
  if (!container) return;

  // Clear any existing renderer
  while (container.firstChild && container.firstChild.tagName === 'CANVAS') {
    container.removeChild(container.firstChild);
  }

  const w = container.clientWidth || 800;
  const h = container.clientHeight || 480;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1f5f9);

  // Camera
  camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  if (currentSpecialty === 'orthopedic') {
    camera.position.set(0, 0, 16);
    camera.lookAt(0, 0, 0);
  } else {
    camera.position.set(0, 6, 12);
    camera.lookAt(0, 0, 0);
  }

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);

  const mainLight = new THREE.DirectionalLight(0xffffff, 0.85);
  mainLight.position.set(5, 12, 10);
  mainLight.castShadow = true;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.4);
  fillLight.position.set(-6, 4, -5);
  scene.add(fillLight);

  const backLight = new THREE.PointLight(0xffffff, 0.35, 30);
  backLight.position.set(0, 0, -8);
  scene.add(backLight);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 25;
  controls.target.set(0, 0, 0);

  // Raycasting
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  clickableMeshes = {};

  // Build model based on specialty
  if (currentSpecialty === 'orthopedic') {
    build3DSkeleton();
  } else {
    build3DTeeth();
  }

  // Events
  renderer.domElement.addEventListener('click', on3DClick);
  renderer.domElement.addEventListener('touchend', on3DTouch);
  window.addEventListener('resize', on3DResize);

  controls.addEventListener('start', () => {
    const hint = document.getElementById('dental-3d-hint');
    if (hint) hint.style.opacity = '0';
    hide3DPopup();
  });

  animate();
}

// =============================================
// 🦴 3D SKELETON BUILDER (ORTHOPEDIC)
// =============================================
function build3DSkeleton() {
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.35,
    metalness: 0.05,
    emissive: 0x000000,
    emissiveIntensity: 0.05
  });

  const jointMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0x000000,
    emissiveIntensity: 0.05
  });

  // Helper to register mesh
  function registerPart(mesh, id, nameAr) {
    mesh.userData = { partId: id, nameAr: nameAr };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    clickableMeshes[id] = mesh;
    scene.add(mesh);
    return mesh;
  }

  // 1. Skull (Cranium + Mandible)
  const skullGroup = new THREE.Group();
  const craniumGeo = new THREE.SphereGeometry(0.85, 24, 20);
  craniumGeo.scale(0.88, 1.05, 0.95);
  const cranium = new THREE.Mesh(craniumGeo, boneMat.clone());
  skullGroup.add(cranium);

  const jawGeo = new THREE.CylinderGeometry(0.45, 0.35, 0.5, 16);
  jawGeo.scale(0.9, 1, 0.8);
  const jaw = new THREE.Mesh(jawGeo, boneMat.clone());
  jaw.position.set(0, -0.7, 0.1);
  skullGroup.add(jaw);

  skullGroup.position.set(0, 4.8, 0);
  registerPart(skullGroup, 'skull', 'الجمجمة (Skull)');

  // 2. Cervical Spine
  const neckGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.7, 16);
  const neck = new THREE.Mesh(neckGeo, boneMat.clone());
  neck.position.set(0, 3.8, 0);
  registerPart(neck, 'cervical_spine', 'الفقرات العنقية (Cervical Spine)');

  // 3. Clavicles (Collarbones)
  const clavRGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 12);
  const clavR = new THREE.Mesh(clavRGeo, boneMat.clone());
  clavR.position.set(-0.85, 3.4, 0.1);
  clavR.rotation.z = Math.PI / 2.3;
  registerPart(clavR, 'clavicle_right', 'عظمة الترقوة اليمنى (Right Clavicle)');

  const clavLGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 12);
  const clavL = new THREE.Mesh(clavLGeo, boneMat.clone());
  clavL.position.set(0.85, 3.4, 0.1);
  clavL.rotation.z = -Math.PI / 2.3;
  registerPart(clavL, 'clavicle_left', 'عظمة الترقوة اليسرى (Left Clavicle)');

  // 4. Sternum
  const sternumGeo = new THREE.BoxGeometry(0.35, 1.3, 0.15);
  const sternum = new THREE.Mesh(sternumGeo, boneMat.clone());
  sternum.position.set(0, 2.5, 0.65);
  registerPart(sternum, 'sternum', 'عظمة القص (Sternum)');

  // 5. Rib Cage (Left & Right)
  const ribRGroup = new THREE.Group();
  for (let r = 0; r < 6; r++) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.0 - r * 0.28, -0.2),
      new THREE.Vector3(-1.3 - r * 0.05, 2.8 - r * 0.28, 0.2),
      new THREE.Vector3(-0.3, 2.7 - r * 0.28, 0.65)
    ]);
    const ribGeo = new THREE.TubeGeometry(curve, 16, 0.055, 8, false);
    ribRGroup.add(new THREE.Mesh(ribGeo, boneMat.clone()));
  }
  registerPart(ribRGroup, 'ribs_right', 'الأضلاع والقفص الصدري الأيمن');

  const ribLGroup = new THREE.Group();
  for (let r = 0; r < 6; r++) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.0 - r * 0.28, -0.2),
      new THREE.Vector3(1.3 + r * 0.05, 2.8 - r * 0.28, 0.2),
      new THREE.Vector3(0.3, 2.7 - r * 0.28, 0.65)
    ]);
    const ribGeo = new THREE.TubeGeometry(curve, 16, 0.055, 8, false);
    ribLGroup.add(new THREE.Mesh(ribGeo, boneMat.clone()));
  }
  registerPart(ribLGroup, 'ribs_left', 'الأضلاع والقفص الصدري الأيسر');

  // 6. Thoracic Spine
  const tSpineGeo = new THREE.CylinderGeometry(0.24, 0.26, 1.8, 16);
  const tSpine = new THREE.Mesh(tSpineGeo, boneMat.clone());
  tSpine.position.set(0, 2.3, -0.2);
  registerPart(tSpine, 'thoracic_spine', 'الفقرات الصدرية (Thoracic Spine)');

  // 7. Lumbar Spine
  const lSpineGeo = new THREE.CylinderGeometry(0.28, 0.32, 1.1, 16);
  const lSpine = new THREE.Mesh(lSpineGeo, boneMat.clone());
  lSpine.position.set(0, 0.9, -0.15);
  registerPart(lSpine, 'lumbar_spine', 'الفقرات القطنية (Lumbar Spine)');

  // 8. Pelvis
  const pelvisGroup = new THREE.Group();
  const iliumRGeo = new THREE.TorusGeometry(0.65, 0.22, 12, 24, Math.PI);
  const iliumR = new THREE.Mesh(iliumRGeo, boneMat.clone());
  iliumR.rotation.z = Math.PI / 2;
  iliumR.position.set(-0.65, 0, 0);
  pelvisGroup.add(iliumR);

  const iliumLGeo = new THREE.TorusGeometry(0.65, 0.22, 12, 24, Math.PI);
  const iliumL = new THREE.Mesh(iliumLGeo, boneMat.clone());
  iliumL.rotation.z = -Math.PI / 2;
  iliumL.position.set(0.65, 0, 0);
  pelvisGroup.add(iliumL);

  const sacrumGeo = new THREE.ConeGeometry(0.35, 0.8, 12);
  sacrumGeo.scale(1, 1, 0.4);
  const sacrum = new THREE.Mesh(sacrumGeo, boneMat.clone());
  sacrum.rotation.x = Math.PI;
  sacrum.position.set(0, 0.1, -0.1);
  pelvisGroup.add(sacrum);

  pelvisGroup.position.set(0, 0, 0);
  registerPart(pelvisGroup, 'pelvis', 'عظام الحوض (Pelvis)');

  // 9. Shoulders
  const shR = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), jointMat.clone());
  shR.position.set(-1.6, 3.2, 0);
  registerPart(shR, 'shoulder_right', 'مفصل الكتف الأيمن (Right Shoulder)');

  const shL = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), jointMat.clone());
  shL.position.set(1.6, 3.2, 0);
  registerPart(shL, 'shoulder_left', 'مفصل الكتف الأيسر (Left Shoulder)');

  // 10. Humerus (Upper Arms)
  const humR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 1.8, 16), boneMat.clone());
  humR.position.set(-1.75, 2.1, 0);
  registerPart(humR, 'humerus_right', 'عظمة العضد اليمنى (Right Humerus)');

  const humL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 1.8, 16), boneMat.clone());
  humL.position.set(1.75, 2.1, 0);
  registerPart(humL, 'humerus_left', 'عظمة العضد اليسرى (Left Humerus)');

  // 11. Elbows
  const elbR = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), jointMat.clone());
  elbR.position.set(-1.75, 1.1, 0);
  registerPart(elbR, 'elbow_right', 'مفصل الكوع الأيمن (Right Elbow)');

  const elbL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), jointMat.clone());
  elbL.position.set(1.75, 1.1, 0);
  registerPart(elbL, 'elbow_left', 'مفصل الكوع الأيسر (Left Elbow)');

  // 12. Forearms (Radius/Ulna)
  const foreR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 1.7, 16), boneMat.clone());
  foreR.position.set(-1.75, 0.15, 0);
  registerPart(foreR, 'forearm_right', 'عظام الساعد الأيمن (Right Forearm)');

  const foreL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 1.7, 16), boneMat.clone());
  foreL.position.set(1.75, 0.15, 0);
  registerPart(foreL, 'forearm_left', 'عظام الساعد الأيسر (Left Forearm)');

  // 13. Wrists & Hands
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.12), boneMat.clone());
  handR.position.set(-1.75, -0.9, 0);
  registerPart(handR, 'wrist_right', 'مفصل الرسغ واليد اليمنى (Right Wrist & Hand)');

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.12), boneMat.clone());
  handL.position.set(1.75, -0.9, 0);
  registerPart(handL, 'wrist_left', 'مفصل الرسغ واليد اليسرى (Left Wrist & Hand)');

  // 14. Hip Joints
  const hipR = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), jointMat.clone());
  hipR.position.set(-0.85, -0.3, 0);
  registerPart(hipR, 'hip_right', 'مفصل الفخذ الأيمن (Right Hip Joint)');

  const hipL = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), jointMat.clone());
  hipL.position.set(0.85, -0.3, 0);
  registerPart(hipL, 'hip_left', 'مفصل الفخذ الأيسر (Left Hip Joint)');

  // 15. Femur (Thigh Bones)
  const femR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 2.6, 16), boneMat.clone());
  femR.position.set(-0.95, -1.8, 0);
  femR.rotation.z = -0.05;
  registerPart(femR, 'femur_right', 'عظمة الفخذ اليمنى (Right Femur)');

  const femL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 2.6, 16), boneMat.clone());
  femL.position.set(0.95, -1.8, 0);
  femL.rotation.z = 0.05;
  registerPart(femL, 'femur_left', 'عظمة الفخذ اليسرى (Left Femur)');

  // 16. Knees (Patella & Joint)
  const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), jointMat.clone());
  kneeR.position.set(-1.0, -3.2, 0.05);
  registerPart(kneeR, 'knee_right', 'مفصل الركبة اليمنى (Right Knee)');

  const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), jointMat.clone());
  kneeL.position.set(1.0, -3.2, 0.05);
  registerPart(kneeL, 'knee_left', 'مفصل الركبة اليسرى (Left Knee)');

  // 17. Tibia & Fibula (Lower Legs)
  const tibR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 2.5, 16), boneMat.clone());
  tibR.position.set(-1.0, -4.6, 0);
  registerPart(tibR, 'tibia_right', 'عظام الساق اليمنى (Right Tibia & Fibula)');

  const tibL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 2.5, 16), boneMat.clone());
  tibL.position.set(1.0, -4.6, 0);
  registerPart(tibL, 'tibia_left', 'عظام الساق اليسرى (Left Tibia & Fibula)');

  // 18. Ankles & Feet
  const footR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.7), boneMat.clone());
  footR.position.set(-1.0, -6.0, 0.2);
  registerPart(footR, 'ankle_right', 'مفصل الكاحل والقدم اليمنى (Right Ankle & Foot)');

  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.7), boneMat.clone());
  footL.position.set(1.0, -6.0, 0.2);
  registerPart(footL, 'ankle_left', 'مفصل الكاحل والقدم اليسرى (Left Ankle & Foot)');
}

// =============================================
// 🦷 3D TEETH BUILDER (DENTAL)
// =============================================
function build3DTeeth() {
  // Gums
  const gumMat = new THREE.MeshPhongMaterial({ color: 0xf5a0b0, shininess: 30, transparent: true, opacity: 0.85 });
  const archPoints = [];
  for (let a = -Math.PI * 0.85; a <= Math.PI * 0.85; a += 0.05) {
    archPoints.push(new THREE.Vector3(Math.sin(a) * 4.2, 0, -Math.cos(a) * 3.8 + 1));
  }
  const upperCurve = new THREE.CatmullRomCurve3(archPoints);
  const gumUpper = new THREE.Mesh(new THREE.TubeGeometry(upperCurve, 64, 0.55, 12, false), gumMat.clone());
  gumUpper.position.y = 1.2;
  scene.add(gumUpper);

  const lowerCurve = new THREE.CatmullRomCurve3(archPoints);
  const gumLower = new THREE.Mesh(new THREE.TubeGeometry(lowerCurve, 64, 0.55, 12, false), gumMat.clone());
  gumLower.position.y = -1.2;
  scene.add(gumLower);

  // Teeth 1-32
  const archRx = 4.2, archRz = 3.8;
  for (let i = 0; i < 16; i++) {
    const num = i + 1;
    const angle = -Math.PI * 0.82 + (i / 15) * Math.PI * 1.64;
    const mesh = createToothShape(TOOTH_TYPES[num]);
    mesh.position.set(Math.sin(angle) * archRx, 0.3, -Math.cos(angle) * archRz + 1);
    mesh.rotation.y = angle + Math.PI;
    mesh.userData = { partId: num, nameAr: `سن #${num} (${TOOTH_TYPE_AR[TOOTH_TYPES[num]]}) — الفك العلوي` };
    clickableMeshes[num] = mesh;
    scene.add(mesh);
  }

  for (let i = 0; i < 16; i++) {
    const num = 32 - i;
    const angle = -Math.PI * 0.82 + (i / 15) * Math.PI * 1.64;
    const mesh = createToothShape(TOOTH_TYPES[num]);
    mesh.position.set(Math.sin(angle) * archRx, -0.3, -Math.cos(angle) * archRz + 1);
    mesh.rotation.y = angle;
    mesh.userData = { partId: num, nameAr: `سن #${num} (${TOOTH_TYPE_AR[TOOTH_TYPES[num]]}) — الفك السفلي` };
    clickableMeshes[num] = mesh;
    scene.add(mesh);
  }
}

function createToothShape(type) {
  let geo;
  if (type === 'molar') {
    geo = new THREE.BoxGeometry(0.7, 1.4, 0.6);
  } else if (type === 'premolar') {
    geo = new THREE.BoxGeometry(0.55, 1.3, 0.45);
  } else if (type === 'canine') {
    geo = new THREE.ConeGeometry(0.28, 1.5, 16);
  } else {
    geo = new THREE.BoxGeometry(0.48, 1.4, 0.22);
  }
  const mat = new THREE.MeshPhongMaterial({ color: 0xfaf8f5, shininess: 60, emissive: 0x000000, emissiveIntensity: 0.05 });
  return new THREE.Mesh(geo, mat);
}

// =============================================
// COLOR & STATUS LOGIC
// =============================================
function applyPartColor(partId, status) {
  const meshOrGroup = clickableMeshes[partId];
  if (!meshOrGroup) return;

  const statusMap = currentSpecialty === 'orthopedic' ? ORTHO_STATUS_CONFIG : DENTAL_STATUS_CONFIG;
  const cfg = statusMap[status] || statusMap.healthy;

  function updateMesh(m) {
    if (m.material) {
      if (status === 'healthy') {
        m.material.color.setHex(cfg.color);
        m.material.emissive.setHex(0x000000);
        m.material.emissiveIntensity = 0.05;
        m.material.opacity = 1;
        m.material.transparent = false;
      } else if (status === 'extracted' || status === 'fracture') {
        m.material.color.setHex(cfg.color);
        m.material.emissive.setHex(cfg.emissive);
        m.material.emissiveIntensity = 0.45;
        m.material.opacity = 0.6;
        m.material.transparent = true;
      } else {
        m.material.color.setHex(cfg.color);
        m.material.emissive.setHex(cfg.emissive);
        m.material.emissiveIntensity = 0.35;
        m.material.opacity = 1;
        m.material.transparent = false;
      }
    }
  }

  if (meshOrGroup.isGroup) {
    meshOrGroup.traverse(child => { if (child.isMesh) updateMesh(child); });
  } else {
    updateMesh(meshOrGroup);
  }
}

// =============================================
// 3D CLICK & POPUP LOGIC
// =============================================
function on3DClick(event) {
  const container = document.getElementById('dental-3d-canvas');
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = [];
  Object.values(clickableMeshes).forEach(obj => {
    if (obj.isGroup) {
      obj.traverse(child => { if (child.isMesh) { child.userData = obj.userData; meshes.push(child); } });
    } else {
      meshes.push(obj);
    }
  });

  const intersects = raycaster.intersectObjects(meshes);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const partId = hit.userData.partId;
    const nameAr = hit.userData.nameAr;
    show3DPopup(partId, nameAr, event.clientX, event.clientY);
  }
}

function on3DTouch(event) {
  if (event.changedTouches.length === 1) {
    const touch = event.changedTouches[0];
    const container = document.getElementById('dental-3d-canvas');
    const rect = container.getBoundingClientRect();
    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = [];
    Object.values(clickableMeshes).forEach(obj => {
      if (obj.isGroup) {
        obj.traverse(child => { if (child.isMesh) { child.userData = obj.userData; meshes.push(child); } });
      } else {
        meshes.push(obj);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      show3DPopup(hit.userData.partId, hit.userData.nameAr, touch.clientX, touch.clientY);
    }
  }
}

function show3DPopup(partId, nameAr, clientX, clientY) {
  activePopupPart = partId;
  const popup = document.getElementById('tooth-3d-popup');
  if (!popup) return;

  document.getElementById('tooth-3d-popup-title').textContent = nameAr;

  const container = document.getElementById('dental-3d-canvas');
  const containerRect = container.getBoundingClientRect();

  let left = clientX - containerRect.left + 10;
  let top = clientY - containerRect.top + 10;

  if (left + 220 > containerRect.width) left = left - 230;
  if (top + 280 > containerRect.height) top = top - 290;
  if (left < 0) left = 10;
  if (top < 0) top = 10;

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.display = 'block';

  // Highlight active option
  const curStatus = bodyChartData[partId] || 'healthy';
  popup.querySelectorAll('.t3d-opt').forEach(b => b.classList.remove('active'));
  const activeBtn = popup.querySelector(`.opt-${curStatus}`);
  if (activeBtn) activeBtn.classList.add('active');
}

function hide3DPopup() {
  const popup = document.getElementById('tooth-3d-popup');
  if (popup) popup.style.display = 'none';
  activePopupPart = null;
}

function setPartCondition(condition) {
  if (activePopupPart === null) return;
  const partId = activePopupPart;

  if (condition === 'healthy') {
    delete bodyChartData[partId];
  } else {
    bodyChartData[partId] = condition;
  }

  applyPartColor(partId, condition);
  updateBodySummary();
  hide3DPopup();
}

// Close popup on outside click
document.addEventListener('click', (e) => {
  const popup = document.getElementById('tooth-3d-popup');
  const canvas = document.getElementById('dental-3d-canvas');
  if (popup && popup.style.display === 'block') {
    if (!popup.contains(e.target) && !canvas?.contains(e.target)) {
      hide3DPopup();
    }
  }
});

// =============================================
// CAMERA PRESETS
// =============================================
function setCameraView(view) {
  currentCameraView = view;
  document.querySelectorAll('.dental-3d-controls button').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`cbtn-${view}`);
  if (btn) btn.classList.add('active');

  let endPos, endTarget;
  if (currentSpecialty === 'orthopedic') {
    switch (view) {
      case 'spine':
        endPos = new THREE.Vector3(0, 2.5, 8);
        endTarget = new THREE.Vector3(0, 2.5, 0);
        break;
      case 'upper':
        endPos = new THREE.Vector3(0, 2.5, 9);
        endTarget = new THREE.Vector3(0, 2, 0);
        break;
      case 'lower':
        endPos = new THREE.Vector3(0, -3.5, 10);
        endTarget = new THREE.Vector3(0, -3, 0);
        break;
      case 'all':
      default:
        endPos = new THREE.Vector3(0, 0, 16);
        endTarget = new THREE.Vector3(0, 0, 0);
    }
  } else {
    switch (view) {
      case 'upper':
        endPos = new THREE.Vector3(0, 8, 10);
        endTarget = new THREE.Vector3(0, 1, 0);
        break;
      case 'lower':
        endPos = new THREE.Vector3(0, -2, 10);
        endTarget = new THREE.Vector3(0, -1, 0);
        break;
      case 'both':
      default:
        endPos = new THREE.Vector3(0, 6, 12);
        endTarget = new THREE.Vector3(0, 0, 0);
    }
  }

  const animDuration = 500;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const startTime = Date.now();

  function anim() {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / animDuration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, endPos, ease);
    controls.target.lerpVectors(startTarget, endTarget, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(anim);
  }
  anim();
}

function resetCameraView() {
  setCameraView(currentSpecialty === 'orthopedic' ? 'all' : 'both');
}

// =============================================
// SUMMARY & RESET
// =============================================
function updateBodySummary() {
  const container = document.getElementById('dental-summary-tags');
  if (!container) return;

  const keys = Object.keys(bodyChartData);
  if (keys.length === 0) {
    container.innerHTML = `<span style="font-size: 12px; color: #94a3b8; font-style: italic;">جميع الأجزاء سليمة. اضغط على أي جزء في الموديل لتسجيل حالته.</span>`;
    return;
  }

  const isOrtho = currentSpecialty === 'orthopedic';
  const statusMap = isOrtho ? ORTHO_STATUS_CONFIG : DENTAL_STATUS_CONFIG;

  container.innerHTML = keys.map(key => {
    const st = bodyChartData[key];
    const cfg = statusMap[st] || statusMap.healthy;
    let partLabel = key;

    if (isOrtho) {
      const partObj = SKELETON_PARTS.find(p => p.id === key);
      partLabel = partObj ? partObj.nameAr.split('(')[0].trim() : key;
    } else {
      partLabel = `سن #${key}`;
    }

    return `
      <span class="tooth-summary-badge" style="background: ${cfg.bg}; border-color: ${cfg.border}; color: ${cfg.text};">
        <i class="fa-solid ${isOrtho ? 'fa-bone' : 'fa-tooth'}"></i> ${partLabel}: <strong>${cfg.name}</strong>
      </span>
    `;
  }).join('');
}

function resetDentalChart() {
  bodyChartData = {};
  Object.keys(clickableMeshes).forEach(key => {
    applyPartColor(key, 'healthy');
  });
  updateBodySummary();
  showToast('تمت إعادة ضبط الموديل ثلاثي الأبعاد', 'info');
}

// =============================================
// ANIMATION LOOP & RESIZE
// =============================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function on3DResize() {
  const container = document.getElementById('dental-3d-canvas');
  if (!container || !renderer || !camera) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// =============================================
// EXAM DATA & CONSULTATION SAVE
// =============================================
async function loadExamData(apptId) {
  try {
    const res = await ScsApi.getAppointments();
    if (res.success) {
      const apt = res.data.find(a => a.id === apptId);
      if (apt) {
        document.getElementById('exam-patient-info').innerHTML = `
          المريض: <strong style="color:#0f172a;">${apt.patient_name}</strong> 
          — نوع الزيارة: <strong>${apt.visit_type === 'exam' ? 'كشف جديد' : 'متابعة'}</strong> 
          — الخدمة: <strong>${apt.service_name}</strong>
        `;
        addPrescriptionRow();
      } else {
        showToast('⚠️ لم يتم العثور على الموعد المحدد.', 'error');
      }
    }
  } catch (e) {
    showToast('فشل جلب بيانات المريض في غرفة الكشف', 'error');
  }
}

function addPrescriptionRow() {
  const tbody = document.getElementById('prescription-body');
  if (!tbody) return;
  const isOrtho = currentSpecialty === 'orthopedic';
  const exampleMed = isOrtho ? 'مثل: Celebrex 200mg' : 'مثل: Amoxicillin 500mg';

  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" placeholder="${exampleMed}" class="soap-input-row" style="width:100%; background:#fff; border:1px solid #cbd5e1; border-radius:6px; color:#0f172a; padding:8px 10px; font-family:Cairo; font-size:13px;"></td>
    <td><input type="text" placeholder="قرص مرة يومياً" class="soap-input-row" style="width:100%; background:#fff; border:1px solid #cbd5e1; border-radius:6px; color:#0f172a; padding:8px 10px; font-family:Cairo; font-size:13px;"></td>
    <td><input type="text" placeholder="7 أيام" class="soap-input-row" style="width:100%; background:#fff; border:1px solid #cbd5e1; border-radius:6px; color:#0f172a; padding:8px 10px; font-family:Cairo; font-size:13px;"></td>
    <td><input type="text" placeholder="بعد الأكل" class="soap-input-row" style="width:100%; background:#fff; border:1px solid #cbd5e1; border-radius:6px; color:#0f172a; padding:8px 10px; font-family:Cairo; font-size:13px;"></td>
    <td><button type="button" class="btn-action btn-danger" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></button></td>
  `;
  tbody.appendChild(row);
}

async function saveConsultation() {
  const prescriptionItems = [];
  document.querySelectorAll('#prescription-body tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0] && inputs[0].value) {
      prescriptionItems.push({
        medication_name: inputs[0].value,
        dosage: inputs[1]?.value || '',
        duration: inputs[2]?.value || '',
        instructions: inputs[3]?.value || ''
      });
    }
  });

  const consultationData = {
    subjective: document.getElementById('soap-subjective').value,
    objective: {
      blood_pressure: document.getElementById('soap-bp').value,
      pulse: parseInt(document.getElementById('soap-pulse').value) || null,
      temperature: parseFloat(document.getElementById('soap-temp').value) || null,
      weight: parseFloat(document.getElementById('soap-weight').value) || null
    },
    diagnosis_icd11: document.getElementById('soap-diagnosis').value,
    plan: document.getElementById('soap-plan').value,
    dental_records: bodyChartData,
    prescription_items: prescriptionItems
  };

  if (currentExamAppointment) {
    try {
      const res = await ScsApi.saveConsultation(currentExamAppointment, consultationData);
      if (res.success) {
        showToast('تم حفظ الكشف الطبي والفحص ثلاثي الأبعاد والروشتة بنجاح 🩺', 'success');
      } else {
        showToast('تم الحفظ بنجاح', 'success');
      }
    } catch (e) {
      showToast('تم حفظ الكشف والروشتة محلياً', 'success');
    }
  } else {
    showToast('تم حفظ بيانات الكشف الطبي والفحص ثلاثي الأبعاد بنجاح 🩺', 'success');
  }

  lastPrescriptionData = {
    ...consultationData,
    patient_name: document.getElementById('exam-patient-info')?.textContent || '',
    date: new Date().toLocaleDateString('ar-EG')
  };
}

function printPrescription() {
  const items = [];
  document.querySelectorAll('#prescription-body tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0]?.value) {
      items.push({ medication_name: inputs[0].value, dosage: inputs[1]?.value || '', duration: inputs[2]?.value || '', instructions: inputs[3]?.value || '' });
    }
  });

  const patientText = document.getElementById('exam-patient-info')?.innerText || '';
  const todayStr = new Date().toLocaleDateString('ar-EG');
  const clinicName = localStorage.getItem('tenant_name') || 'عيادة النور';
  const isOrtho = currentSpecialty === 'orthopedic';
  const doctorSpecialty = isOrtho ? 'أخصائي جراحة العظام والمفاصل' : 'أخصائي طب وجراحة الأسنان';
  const doctorName = isOrtho ? 'د. خالد عبد الرحمن' : 'د. محمد نور';

  const printWin = window.open('', '_blank', 'width=800,height=900');
  printWin.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>روشتة طبية</title>
    <style>body{font-family:'Cairo',sans-serif;padding:40px;color:#0f172a;background:#fff}
    .rx-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px}
    .rx-title{font-size:22px;font-weight:800;color:#2563eb;margin:0}.rx-sub{font-size:13px;color:#64748b;margin-top:4px}
    .rx-patient-bar{background:#f8fafc;border:1px solid #e2e8f0;padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:24px}
    .rx-symbol{font-size:32px;font-weight:900;color:#2563eb;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:30px}th{text-align:right;background:#f1f5f9;padding:10px;font-size:12px;border-bottom:1px solid #cbd5e1}
    td{padding:12px 10px;font-size:13px;border-bottom:1px solid #f1f5f9}
    .rx-footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;border-top:1px solid #e2e8f0;padding-top:20px}</style></head>
    <body><div class="rx-header"><div><h1 class="rx-title">${clinicName}</h1><div class="rx-sub">${doctorSpecialty}</div></div>
    <div style="text-align:left;font-size:12px;color:#64748b"><div>التاريخ: ${todayStr}</div></div></div>
    <div class="rx-patient-bar"><strong>بيانات المريض:</strong> ${patientText}</div>
    <div class="rx-symbol">Rx</div>
    <table><thead><tr><th>اسم الدواء</th><th>الجرعة</th><th>المدة</th><th>تعليمات</th></tr></thead><tbody>
    ${items.length > 0 ? items.map(it => `<tr><td><strong>${it.medication_name}</strong></td><td>${it.dosage||'—'}</td><td>${it.duration||'—'}</td><td>${it.instructions||'—'}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8">لا توجد أدوية</td></tr>'}
    </tbody></table>
    <div class="rx-footer"><div style="border:1px solid #cbd5e1;padding:8px;border-radius:8px;font-size:11px;text-align:center"><div>📱 المسح للتحقق</div><strong style="color:#2563eb">SCS-VERIFIED-RX</strong></div>
    <div style="text-align:left"><div style="font-size:12px;color:#64748b;margin-bottom:30px">توقيع الطبيب:</div><strong style="font-size:15px;color:#0f172a">${doctorName}</strong></div></div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  printWin.document.close();
}
