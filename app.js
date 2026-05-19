import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "./firebase-client.js";

const STORAGE_KEY = "tecnostore_empresas_v2";
const FIRESTORE_STATE_REF = ["appState", "main"];
const PERSISTED_KEYS = [
  "plans",
  "salesZones",
  "salesVisits",
  "users",
  "companies",
  "equipment",
  "tickets",
  "ticketUpdates",
  "repairs",
  "serviceLogs",
  "planRequests",
];

let isBootstrapping = true;
let saveTimer = null;
let filterTimer = null;

const ticketStatuses = [
  "Recibido",
  "En revisión",
  "Programado",
  "En proceso",
  "Esperando respuesta del cliente",
  "Resuelto",
  "Cerrado",
  "Cancelado",
];

const repairStatuses = [
  "Recibido",
  "Diagnóstico pendiente",
  "Diagnosticado",
  "Esperando aprobación",
  "En reparación",
  "Esperando repuesto",
  "Listo para retirar",
  "Entregado",
  "Cancelado",
];

const equipmentStatuses = ["Activo", "En revisión", "En reparación", "Inactivo"];
const subscriptionStatuses = ["Activa", "Pendiente de pago", "Vencida", "Suspendida"];
const internalRoles = ["Administrador", "Asistente comercial", "Vendedor", "Técnico"];
const closedTicketStatuses = ["Resuelto", "Cerrado", "Cancelado"];
const closedRepairStatuses = ["Entregado", "Cancelado"];
const visitStatuses = ["Pendiente", "Visitado", "No visitado", "Interesado", "Contrató"];

const equipmentRecordTypes = ["Equipo principal", "Recurso / Periferico"];
const primaryEquipmentTypes = ["PC de escritorio", "Notebook", "Servidor basico", "Celular", "Tablet"];
const peripheralEquipmentTypes = ["Impresora", "Router", "Access Point", "Modem", "Switch", "Camara IP", "Lector / scanner", "Otro periferico"];
const networkResourceTypes = ["Router", "Access Point", "Modem", "Switch"];

const planCatalog = [
  {
    id: "start",
    name: "Plan Start",
    shortName: "Start",
    price: "$80.000 / mes",
    description: "Ideal para 1 a 3 PCs.",
    maxEquipment: 3,
    includedAssistances: 4,
    includedOnsiteVisits: 1,
    features: [
      "soporte remoto",
      "mantenimiento preventivo",
      "optimización básica",
      "asistencia técnica básica",
    ],
  },
  {
    id: "pyme",
    name: "Plan Pyme",
    shortName: "Pyme",
    price: "$150.000 / mes",
    description: "Ideal para 4 a 10 PCs.",
    maxEquipment: 10,
    includedAssistances: 10,
    includedOnsiteVisits: 2,
    features: [
      "soporte remoto y presencial",
      "mantenimiento mensual",
      "optimización general",
      "asistencia prioritaria",
      "revisión de red y conectividad",
    ],
  },
  {
    id: "full",
    name: "Plan Full Support",
    shortName: "Full Support",
    price: "$280.000 / mes",
    description: "Para empresas con mayor dependencia tecnológica.",
    maxEquipment: 30,
    includedAssistances: 20,
    includedOnsiteVisits: 4,
    features: [
      "soporte integral",
      "mantenimiento completo",
      "asistencia prioritaria",
      "monitoreo general",
      "soporte continuo",
    ],
  },
];

const defaultState = {
  loggedIn: false,
  role: "client",
  currentUserId: "",
  currentCompanyId: "c1",
  selectedTicketId: "t1",
  clientView: "dashboard",
  adminView: "admin-dashboard",
  adminFocus: null,
  filters: {
    ticketStatus: "Todos",
    ticketUrgency: "Todas",
    ticketCompany: "Todas",
    ticketSearch: "",
    companyStatus: "Todas",
    companyPlan: "Todos",
    companySearch: "",
    equipmentCompany: "Todas",
    equipmentStatus: "Todos",
    equipmentType: "Todos",
    equipmentSearch: "",
    repairCompany: "Todas",
    repairStatus: "Todos",
    repairSearch: "",
    userRole: "Todos",
    userStatus: "Todos",
    userCompany: "Todas",
    userSearch: "",
  },
  plans: structuredClone(planCatalog),
  salesZones: [
    {
      id: "z1",
      name: "Zona Centro",
      description: "Comercios de atención al público en microcentro.",
      assignedSellerId: "u-sales-2",
      createdAt: "2026-05-18",
    },
    {
      id: "z2",
      name: "Zona Oeste",
      description: "Locales y oficinas sobre corredores comerciales.",
      assignedSellerId: "u-sales-1",
      createdAt: "2026-05-18",
    },
  ],
  salesVisits: [
    {
      id: "v1",
      zoneId: "z1",
      assignedSellerId: "u-sales-2",
      businessName: "Farmacia Avenida",
      contactName: "María Torres",
      phone: "266 410 2201",
      address: "Av. Illia 420, San Luis",
      notes: "Tiene 4 PCs, impresora en red y consulta por mantenimiento mensual.",
      status: "Pendiente",
      lastUpdate: "2026-05-18",
    },
    {
      id: "v2",
      zoneId: "z1",
      assignedSellerId: "u-sales-2",
      businessName: "Estética Centro",
      contactName: "Laura Ponce",
      phone: "266 455 1180",
      address: "Rivadavia 812, San Luis",
      notes: "Usan notebook e impresora. Preguntar por backup y antivirus.",
      status: "Interesado",
      lastUpdate: "2026-05-18",
    },
    {
      id: "v3",
      zoneId: "z2",
      assignedSellerId: "u-sales-1",
      businessName: "Ferretería Oeste",
      contactName: "Carlos Gómez",
      phone: "266 430 8890",
      address: "Justo Daract 1450, San Luis",
      notes: "Sistema de facturación lento. Buen candidato Plan Start.",
      status: "Pendiente",
      lastUpdate: "2026-05-18",
    },
  ],
  users: [
    {
      id: "u-client-1",
      name: "Marina Galván",
      email: "administracion@ecnorte.com",
      password: "demo1234",
      role: "Cliente empresa",
      companyId: "c1",
      phone: "266 432 8811",
      active: true,
      createdAt: "2026-02-01",
    },
    {
      id: "u-client-2",
      name: "Pablo Miranda",
      email: "sistemas@andina.com",
      password: "demo1234",
      role: "Cliente empresa",
      companyId: "c2",
      phone: "266 510 2299",
      active: true,
      createdAt: "2026-01-15",
    },
    {
      id: "u-admin-1",
      name: "Administrador TecnoStore",
      email: "admin@tecnostore.com",
      password: "demo1234",
      role: "Administrador",
      companyId: "",
      phone: "266 510 5694",
      active: true,
      createdAt: "2026-01-01",
    },
    {
      id: "u-sales-1",
      name: "Carla Sosa",
      email: "comercial@tecnostore.com",
      password: "demo1234",
      role: "Asistente comercial",
      companyId: "",
      phone: "266 510 5694",
      active: true,
      createdAt: "2026-03-01",
    },
    {
      id: "u-tech-1",
      name: "Lucas Pereyra",
      email: "lucas@tecnostore.com",
      password: "demo1234",
      role: "Técnico",
      companyId: "",
      phone: "266 500 1101",
      active: true,
      createdAt: "2026-01-10",
    },
    {
      id: "u-tech-2",
      name: "Sofía Brizuela",
      email: "sofia@tecnostore.com",
      password: "demo1234",
      role: "Técnico",
      companyId: "",
      phone: "266 500 1102",
      active: true,
      createdAt: "2026-01-10",
    },
    {
      id: "u-sales-2",
      name: "Matías Quiroga",
      email: "ventas@tecnostore.com",
      password: "demo1234",
      role: "Vendedor",
      companyId: "",
      phone: "266 500 1103",
      active: true,
      createdAt: "2026-03-15",
    },
  ],
  companies: [
    {
      id: "c1",
      name: "Estudio Contable Norte",
      cuit: "30-71824591-6",
      contactName: "Marina Galván",
      phone: "266 432 8811",
      email: "administracion@ecnorte.com",
      address: "Rivadavia 550, San Luis",
      planId: "pyme",
      subscriptionStatus: "Activa",
      startDate: "2026-02-01",
      renewalDate: "2026-06-01",
      includedAssistances: 10,
      usedAssistances: 5,
      maxEquipment: 10,
      notes: "Prefiere visitas por la mañana. Router principal en administración.",
      createdAt: "2026-02-01",
    },
    {
      id: "c2",
      name: "Distribuidora Andina",
      cuit: "30-65740312-9",
      contactName: "Pablo Miranda",
      phone: "266 510 2299",
      email: "sistemas@andina.com",
      address: "Ruta 3, Parque Industrial",
      planId: "full",
      subscriptionStatus: "Activa",
      startDate: "2026-01-15",
      renewalDate: "2026-05-25",
      includedAssistances: 20,
      usedAssistances: 13,
      maxEquipment: 30,
      notes: "Operación crítica de lunes a sábado.",
      createdAt: "2026-01-15",
    },
  ],
  equipment: [
    {
      id: "e1",
      companyId: "c1",
      name: "PC Administración 1",
      type: "PC",
      brand: "Dell",
      model: "OptiPlex 3080",
      serialNumber: "DL-98341",
      userOrSector: "Administración",
      operatingSystem: "Windows 11 Pro",
      status: "Activo",
      notes: "Equipo principal de facturación.",
      lastServiceDate: "2026-05-08",
      createdAt: "2026-02-03",
    },
    {
      id: "e2",
      companyId: "c1",
      name: "Notebook Ventas",
      type: "notebook",
      brand: "Lenovo",
      model: "ThinkPad E14",
      serialNumber: "LN-44129",
      userOrSector: "Ventas",
      operatingSystem: "Windows 11 Pro",
      status: "En revisión",
      notes: "Se revisa lentitud al iniciar.",
      lastServiceDate: "2026-05-14",
      createdAt: "2026-02-05",
    },
    {
      id: "e3",
      companyId: "c1",
      name: "Impresora Recepción",
      type: "impresora",
      brand: "HP",
      model: "LaserJet Pro M404",
      serialNumber: "HP-77820",
      userOrSector: "Recepción",
      operatingSystem: "Red",
      status: "Activo",
      notes: "Configurada por IP fija.",
      lastServiceDate: "2026-04-20",
      createdAt: "2026-02-10",
    },
    {
      id: "e4",
      companyId: "c1",
      name: "Servidor Principal",
      type: "servidor",
      brand: "HPE",
      model: "ProLiant ML30",
      serialNumber: "SV-99201",
      userOrSector: "Archivo central",
      operatingSystem: "Windows Server",
      status: "Activo",
      notes: "Backup diario configurado.",
      lastServiceDate: "2026-05-10",
      createdAt: "2026-03-01",
    },
    {
      id: "e5",
      companyId: "c2",
      name: "PC Logística 2",
      type: "PC",
      brand: "HP",
      model: "ProDesk 400",
      serialNumber: "HP-44887",
      userOrSector: "Logística",
      operatingSystem: "Windows 10 Pro",
      status: "En reparación",
      notes: "Orden activa por fuente dañada.",
      lastServiceDate: "2026-05-12",
      createdAt: "2026-01-18",
    },
  ],
  tickets: [
    {
      id: "t1",
      companyId: "c1",
      equipmentId: "e2",
      ticketNumber: "TK-2026-0018",
      problemType: "rendimiento lento",
      urgency: "normal",
      modality: "remoto",
      description: "La notebook demora demasiado al iniciar sesión y abrir el sistema de gestión.",
      status: "En revisión",
      assignedTechnician: "Lucas Pereyra",
      customerComments: ["Adjuntamos captura del error al iniciar."],
      internalNotes: "Revisar programas de inicio y estado de disco.",
      createdAt: "2026-05-14",
      updatedAt: "2026-05-15",
    },
    {
      id: "t2",
      companyId: "c1",
      equipmentId: "e3",
      ticketNumber: "TK-2026-0019",
      problemType: "impresora no funciona",
      urgency: "alta",
      modality: "presencial",
      description: "No imprime desde dos puestos de recepción. El equipo figura sin conexión.",
      status: "Programado",
      assignedTechnician: "Sofía Brizuela",
      customerComments: [],
      internalNotes: "Visita coordinada para mañana 10:30.",
      createdAt: "2026-05-16",
      updatedAt: "2026-05-17",
    },
    {
      id: "t3",
      companyId: "c2",
      equipmentId: "e5",
      ticketNumber: "TK-2026-0020",
      problemType: "equipo no enciende",
      urgency: "crítica",
      modality: "presencial",
      description: "PC de logística dejó de encender luego de un corte de energía.",
      status: "En proceso",
      assignedTechnician: "Martín Agüero",
      customerComments: [],
      internalNotes: "Se retira equipo para diagnóstico de fuente.",
      createdAt: "2026-05-17",
      updatedAt: "2026-05-18",
    },
  ],
  ticketUpdates: [
    {
      id: "u1",
      ticketId: "t1",
      status: "Recibido",
      message: "Ticket creado por el cliente.",
      author: "Cliente",
      visibleToClient: true,
      createdAt: "2026-05-14",
    },
    {
      id: "u2",
      ticketId: "t1",
      status: "En revisión",
      message: "Nuestro equipo técnico está revisando la información.",
      author: "TecnoStore",
      visibleToClient: true,
      createdAt: "2026-05-15",
    },
    {
      id: "u3",
      ticketId: "t2",
      status: "Programado",
      message: "Visita técnica programada para revisar conectividad de impresora.",
      author: "TecnoStore",
      visibleToClient: true,
      createdAt: "2026-05-17",
    },
  ],
  repairs: [
    {
      id: "r1",
      companyId: "c2",
      equipmentId: "e5",
      orderNumber: "OR-2026-0042",
      status: "En reparación",
      diagnosis: "Fuente dañada por variación eléctrica.",
      budget: "$42.000",
      approved: true,
      assignedTechnician: "Martín Agüero",
      notes: "Repuesto disponible. Pruebas finales pendientes.",
      entryDate: "2026-05-17",
      estimatedFinishDate: "2026-05-20",
      deliveredDate: "",
      createdAt: "2026-05-17",
    },
    {
      id: "r2",
      companyId: "c1",
      equipmentId: "e2",
      orderNumber: "OR-2026-0041",
      status: "Diagnosticado",
      diagnosis: "Disco con sectores lentos. Se recomienda reemplazo por SSD.",
      budget: "$65.000",
      approved: false,
      assignedTechnician: "Lucas Pereyra",
      notes: "Pendiente de aprobación del cliente.",
      entryDate: "2026-05-15",
      estimatedFinishDate: "2026-05-22",
      deliveredDate: "",
      createdAt: "2026-05-15",
    },
  ],
  serviceLogs: [
    {
      id: "s1",
      companyId: "c1",
      equipmentId: "e1",
      ticketId: "",
      repairId: "",
      serviceType: "mantenimiento preventivo",
      description: "Limpieza de temporales, revisión de antivirus y optimización de inicio.",
      technician: "Sofía Brizuela",
      status: "Finalizado",
      createdAt: "2026-05-08",
    },
    {
      id: "s2",
      companyId: "c1",
      equipmentId: "e4",
      ticketId: "",
      repairId: "",
      serviceType: "backup",
      description: "Verificación de backup diario y restauración de prueba.",
      technician: "Lucas Pereyra",
      status: "Finalizado",
      createdAt: "2026-05-10",
    },
    {
      id: "s3",
      companyId: "c1",
      equipmentId: "e3",
      ticketId: "t2",
      repairId: "",
      serviceType: "visita técnica",
      description: "Visita programada para revisar impresora de recepción.",
      technician: "Sofía Brizuela",
      status: "Programado",
      createdAt: "2026-05-17",
    },
  ],
};

function cleanInitialState() {
  return {
    loggedIn: false,
    role: "admin",
    currentUserId: "",
    currentCompanyId: "",
    selectedTicketId: "",
    clientView: "dashboard",
    adminView: "admin-dashboard",
    adminFocus: null,
    filters: {
      ticketStatus: "Todos",
      ticketUrgency: "Todas",
      ticketCompany: "Todas",
      salesSeller: "Todos",
      salesZone: "Todas",
      salesStatus: "Todos",
    },
    plans: structuredClone(planCatalog),
    salesZones: [],
    salesVisits: [],
    users: [
      {
        id: "u-admin-main",
        name: "Gustavo Ariel Rivero",
        email: "admin@tecnostore.com",
        password: "Tecno2026!",
        role: "Administrador",
        companyId: "",
        phone: "266 510 5694",
        active: true,
        createdAt: "2026-05-19",
      },
    ],
    companies: [],
    equipment: [],
    tickets: [],
    ticketUpdates: [],
    repairs: [],
  serviceLogs: [],
  planRequests: [],
};
}

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return cleanInitialState();
  try {
    return { ...cleanInitialState(), ...JSON.parse(saved) };
  } catch {
    return cleanInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudSave();
}

function resetAppData() {
  state = cleanInitialState();
  saveState();
  render();
}

function persistentState() {
  return PERSISTED_KEYS.reduce((data, key) => {
    data[key] = state[key] ?? cleanInitialState()[key];
    return data;
  }, {});
}

function applyPersistentState(data) {
  const base = cleanInitialState();
  PERSISTED_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(data || {}, key)) {
      base[key] = data[key];
    }
  });
  state = {
    ...base,
    loggedIn: state?.loggedIn || false,
    role: state?.role || base.role,
    currentUserId: state?.currentUserId || "",
    currentCompanyId: state?.currentCompanyId || base.companies[0]?.id || "",
    selectedTicketId: state?.selectedTicketId || "",
    clientView: state?.clientView || "dashboard",
    adminView: state?.adminView || "admin-dashboard",
    adminFocus: state?.adminFocus || null,
    filters: {
      ...base.filters,
      ...(state?.filters || {}),
    },
  };
}

async function loadCloudState() {
  if (!firebaseReady || !db) return;
  try {
    const ref = doc(db, ...FIRESTORE_STATE_REF);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      applyPersistentState(snapshot.data().state || {});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return;
    }
    await setDoc(ref, {
      state: persistentState(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("No se pudo cargar Firestore. La app seguirá en modo local.", error);
  }
}

function scheduleCloudSave() {
  if (isBootstrapping || !firebaseReady || !db) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await setDoc(doc(db, ...FIRESTORE_STATE_REF), {
        state: persistentState(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.warn("No se pudo guardar en Firestore. Se conserva copia local.", error);
    }
  }, 350);
}

function $(selector) {
  return document.querySelector(selector);
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function getCompany(id = state.currentCompanyId) {
  return state.companies.find((company) => company.id === id) || state.companies[0] || null;
}

function companyName(id) {
  return getCompany(id)?.name || "Empresa sin asignar";
}

function cleanText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function textMatches(search, values) {
  const query = cleanText(search).trim();
  if (!query) return true;
  return values.some((value) => cleanText(value).includes(query));
}

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getPlan(id) {
  return state.plans.find((plan) => plan.id === id) || state.plans[1] || planCatalog[1];
}

function includedOnsiteVisitsFor(companyOrPlan = {}) {
  if (companyOrPlan.includedOnsiteVisits !== undefined) return Number(companyOrPlan.includedOnsiteVisits);
  const plan = companyOrPlan.planId ? getPlan(companyOrPlan.planId) : companyOrPlan;
  if (plan?.includedOnsiteVisits !== undefined) return Number(plan.includedOnsiteVisits);
  if (plan?.id === "full") return 4;
  if (plan?.id === "pyme") return 2;
  return 1;
}

function usedOnsiteVisitsFor(company = {}) {
  return Number(company.usedOnsiteVisits || 0);
}

function availableOnsiteVisitsFor(company = {}) {
  return Math.max(0, includedOnsiteVisitsFor(company) - usedOnsiteVisitsFor(company));
}

function planThemeClass(planId) {
  return `plan-${planId || "start"}`;
}

function currentPlanThemeClass() {
  if (state.role !== "client") return "plan-start";
  return planThemeClass(getCompany()?.planId || "start");
}

function getEquipment(id) {
  if (id === "other") {
    return {
      id: "other",
      name: "Otro / consulta general",
      type: "otro",
      companyId: state.currentCompanyId,
      status: "Activo",
      userOrSector: "Consulta general",
    };
  }
  return state.equipment.find((item) => item.id === id);
}

function normalizedEquipmentType(type = "") {
  const text = cleanText(type);
  if (text === "pc") return "PC de escritorio";
  if (text === "servidor" || text === "servidor basico") return "Servidor basico";
  if (text === "red") return "Router";
  if (text === "otro") return "Otro periferico";
  if (text === "modem") return "Modem";
  if (text === "camara ip") return "Camara IP";
  return type || "PC de escritorio";
}

function equipmentRecordType(item = {}) {
  if (item.recordType) return item.recordType;
  const type = normalizedEquipmentType(item.type);
  return primaryEquipmentTypes.includes(type) ? "Equipo principal" : "Recurso / Periferico";
}

function isPrimaryEquipment(item = {}) {
  return equipmentRecordType(item) === "Equipo principal";
}

function primaryEquipment(companyId = state.currentCompanyId) {
  return companyEquipment(companyId).filter(isPrimaryEquipment);
}

function peripheralEquipment(companyId = state.currentCompanyId) {
  return companyEquipment(companyId).filter((item) => !isPrimaryEquipment(item));
}

function equipmentScopeText(item = {}) {
  const type = normalizedEquipmentType(item.type);
  if (["Celular", "Tablet"].includes(type)) {
    return "Este equipo puede recibir soporte de configuracion, software, cuentas, backup basico y diagnostico inicial. Las reparaciones fisicas, cambios de modulo, bateria, pin de carga u otros repuestos se cotizan aparte.";
  }
  if (type === "Impresora") {
    return "Las impresoras se registran como recursos/perifericos. El soporte incluido contempla configuracion, drivers, conexion en red y revision basica. No incluye reparacion fisica, mecanica o electronica de la impresora.";
  }
  if (networkResourceTypes.includes(type)) {
    return "Los equipos de red se registran como recursos/perifericos. El soporte incluido contempla configuracion y conectividad. No incluye reparacion fisica de routers, modems, switches o access points.";
  }
  if (isPrimaryEquipment(item)) {
    return "Este equipo esta incluido dentro del soporte tecnico del plan. Las intervenciones se realizaran segun el alcance contratado y la disponibilidad de asistencias.";
  }
  return "Los recursos y perifericos se registran para facilitar configuraciones, soporte basico y documentacion tecnica. No cuentan como equipos principales del plan y no incluyen reparacion fisica del dispositivo.";
}

function ticketScopeNotice(equipmentId) {
  const item = getEquipment(equipmentId);
  if (!item || item.id === "other") return "";
  if (isPrimaryEquipment(item) && !["Celular", "Tablet"].includes(normalizedEquipmentType(item.type))) return "";
  return `<div class="scope-note ticket-scope">${equipmentScopeText(item)}</div>`;
}

function defaultDiscountsAssistance(equipmentId) {
  const item = getEquipment(equipmentId);
  return item && item.id !== "other" && isPrimaryEquipment(item);
}

function currentUser() {
  return state.users.find((user) => user.id === state.currentUserId) || null;
}

function userDisplayName(id) {
  return state.users.find((user) => user.id === id)?.name || "Sin asignar";
}

function getCompanyUser(companyId) {
  return state.users.find((user) => user.companyId === companyId && user.role === "Cliente empresa");
}

function internalUsers(role) {
  return state.users.filter((user) => user.active && (!role || user.role === role));
}

function technicianOptions(selected = "") {
  const technicians = internalUsers("Técnico");
  const options = technicians.length ? technicians.map((user) => user.name) : ["Lucas Pereyra", "Sofía Brizuela"];
  return [`<option value="">Pendiente</option>`, ...options.map((name) => `<option value="${name}" ${selected === name ? "selected" : ""}>${name}</option>`)].join("");
}

function isOpenTicket(ticket) {
  return !closedTicketStatuses.includes(ticket.status);
}

function isUrgentTicket(ticket) {
  return ticket.urgency === "alta" || ticket.urgency.includes("cr");
}

function isActiveRepair(repair) {
  return !closedRepairStatuses.includes(repair.status);
}

function isSalesUser(user = currentUser()) {
  return user && ["Vendedor", "Asistente comercial"].includes(user.role);
}

function canManageSales(user = currentUser()) {
  return user && ["Administrador", "Asistente comercial"].includes(user.role);
}

function canDeleteSalesVisits(user = currentUser()) {
  return user?.role === "Administrador";
}

function canCreateCustomer(user = currentUser()) {
  return user && ["Administrador", "Asistente comercial", "Vendedor"].includes(user.role);
}

function canManageEquipment(user = currentUser()) {
  return user && ["Administrador", "Asistente comercial", "Técnico"].includes(user.role);
}

function sellerOptions(selected = "") {
  const sellers = state.users.filter((user) => user.active && ["Vendedor", "Asistente comercial"].includes(user.role));
  return sellers.map((user) => `<option value="${user.id}" ${selected === user.id ? "selected" : ""}>${user.name} · ${user.role}</option>`).join("");
}

function zoneName(zoneId) {
  return state.salesZones.find((zone) => zone.id === zoneId)?.name || "Sin zona";
}

function salesVisitsForCurrentUser() {
  return state.salesVisits;
}

function sellerNameOrOpen(id) {
  return id ? userDisplayName(id) : "Abierta para vendedores";
}

function companyEquipment(companyId = state.currentCompanyId) {
  return state.equipment.filter((item) => item.companyId === companyId);
}

function equipmentOptionsForCompany(companyId, selected = "", includeOther = true) {
  const assigned = companyEquipment(companyId);
  const options = includeOther
    ? [`<option value="other" ${selected === "other" || !selected ? "selected" : ""}>Otro / consulta general</option>`]
    : assigned.length === 0
      ? [`<option value="">Sin equipos asignados</option>`]
    : [];
  return [
    ...options,
    ...assigned.map((item) => `<option value="${item.id}" ${selected === item.id ? "selected" : ""}>${equipmentRecordType(item)} - ${item.name}</option>`),
  ].join("");
}

function equipmentTypeOptions(recordType, selected = "") {
  const types = recordType === "Equipo principal" ? primaryEquipmentTypes : peripheralEquipmentTypes;
  return types.map((type) => `<option value="${type}" ${normalizedEquipmentType(selected) === type ? "selected" : ""}>${type}</option>`).join("");
}

function companyTickets(companyId = state.currentCompanyId) {
  return state.tickets.filter((ticket) => ticket.companyId === companyId);
}

function companyRepairs(companyId = state.currentCompanyId) {
  return state.repairs.filter((repair) => repair.companyId === companyId);
}

function companyLogs(companyId = state.currentCompanyId) {
  return state.serviceLogs.filter((log) => log.companyId === companyId);
}

function statusClass(status) {
  const text = status.toLowerCase();
  if (["activa", "activo", "resuelto", "cerrado", "entregado", "listo para retirar"].some((word) => text.includes(word))) {
    return "success";
  }
  if (["contrató", "contrato", "visitado"].some((word) => text.includes(word))) {
    return "success";
  }
  if (["alta", "crítica", "vencida", "suspendida", "cancelado", "no visitado"].some((word) => text.includes(word))) {
    return "danger";
  }
  if (["pendiente", "esperando", "programado", "diagnosticado", "en revisión", "en reparación", "en proceso", "interesado"].some((word) => text.includes(word))) {
    return "warning";
  }
  return "";
}

function whatsappUrl(message = "Hola TecnoStore, necesito asistencia tecnica.") {
  return `https://wa.me/542665105694?text=${encodeURIComponent(message)}`;
}

function whatsappTicketMessage(ticket) {
  const company = getCompany(ticket.companyId);
  const equipment = getEquipment(ticket.equipmentId);
  return [
    "Hola TecnoStore, necesito enviar informacion adicional para una solicitud.",
    `Empresa: ${company.name}`,
    `Ticket: ${ticket.ticketNumber}`,
    `Equipo: ${equipment?.name || "Otro / consulta general"}`,
    `Problema: ${ticket.problemType}`,
    `Urgencia: ${ticket.urgency}`,
  ].join("\n");
}

function whatsappPlanMessage(plan) {
  return [
    `Hola, te comparto ${plan.name} de TecnoStore Empresas.`,
    `${plan.description}`,
    `Precio: ${plan.price}`,
    `Incluye: ${plan.features.join(", ")}.`,
    "Nos ocupamos de la tecnología de tu negocio.",
  ].join("\n");
}

function planAudience(plan) {
  if (plan.id === "start") return "Ideal para pequeños negocios con hasta 3 equipos principales.";
  if (plan.id === "pyme") return "Ideal para empresas de 4 a 10 equipos principales.";
  if (plan.id === "full") return "Pensado para empresas con mayor dependencia tecnológica.";
  return plan.description;
}

function planBullets(items) {
  return items.map((item) => `• ${item}`).join("\n");
}

function planShareText(plan, version = "short") {
  if (version === "short") {
    return [
      "Hola, te comparto la propuesta de TecnoStore Empresas:",
      "",
      plan.name.toUpperCase(),
      plan.price,
      "",
      planAudience(plan),
      "",
      "Incluye:",
      planBullets(plan.features),
      "",
      "TecnoStore Empresas",
      "Nos ocupamos de la tecnología de tu negocio.",
      "",
      "WhatsApp: 266 510 5694",
      "Dirección: Pringles 772",
    ].join("\n");
  }
  return [
    "Hola, te comparto la propuesta extendida de TecnoStore Empresas:",
    "",
    plan.name.toUpperCase(),
    `Precio mensual: ${plan.price}`,
    "",
    "Este plan está pensado para empresas que necesitan soporte técnico organizado, mantenimiento IT y seguimiento de sus equipos.",
    "",
    "EQUIPOS PRINCIPALES",
    "El plan cubre equipos principales registrados, como:",
    "• PC de escritorio",
    "• notebooks",
    "• servidores básicos",
    "• celulares",
    "• tablets",
    "",
    "SERVICIOS INCLUIDOS",
    "• soporte remoto",
    "• soporte presencial según plan",
    "• mantenimiento preventivo",
    "• optimización de equipos",
    "• diagnóstico inicial",
    "• configuración de software",
    "• configuración básica de red",
    "• configuración de impresoras",
    "• seguimiento de tickets",
    "• historial tecnico",
    "",
    "RECURSOS / PERIFÉRICOS",
    "También pueden registrarse impresoras, routers, access points, módems, switches y otros dispositivos para documentar la infraestructura de la empresa.",
    "",
    "Estos recursos no cuentan como equipos principales y no incluyen reparación física. Su soporte se limita a configuración, conectividad, drivers y orientación técnica.",
    "",
    "VISITAS Y ASISTENCIAS",
    "Las visitas presenciales incluidas tienen una duración máxima de 1 hora por visita.",
    "Las asistencias corresponden al período mensual activo y no son acumulables.",
    "Si una tarea requiere más tiempo o queda fuera del alcance del plan, se informa y cotiza aparte.",
    "",
    "NO INCLUIDO",
    "• repuestos",
    "• licencias",
    "• insumos",
    "• reparación física de impresoras",
    "• reparación física de routers o módems",
    "• reparación electrónica compleja",
    "• recuperación avanzada de datos",
    "• trabajos eléctricos",
    "• cableado estructural avanzado",
    "• trabajos fuera de horario",
    "• equipos no registrados",
    "• reparaciones físicas de celulares sin cotización previa",
    "",
    "TecnoStore Empresas",
    "Nos ocupamos de la tecnología de tu negocio.",
    "",
    "WhatsApp: 266 510 5694",
    "Dirección: Pringles 772",
  ].join("\n");
}

function htmlList(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function coverageBlock(title, content, open = false) {
  return `
    <article class="coverage-block ${open ? "featured" : ""}">
      <div class="coverage-title">
        <strong>${title}</strong>
      </div>
      <div class="coverage-content">
        ${content}
      </div>
    </article>
  `;
}

function planCoverageHtml(plan) {
  const summary = `
    <div class="coverage-summary-card">
      <strong>${plan.name}</strong>
      <span>Precio: ${plan.price}</span>
      <span>Equipos principales permitidos: ${plan.maxEquipment}</span>
      <span>Asistencias incluidas: ${plan.includedAssistances}</span>
      <p>${planAudience(plan)}</p>
      <b>Incluye resumen:</b>
      ${htmlList(plan.features)}
    </div>
  `;
  return [
    coverageBlock("Resumen del plan", summary, true),
    coverageBlock("Equipos principales", `
      <p>Los equipos principales son los dispositivos incluidos dentro del soporte técnico del plan contratado.</p>
      <p>Pueden registrarse como equipos principales:</p>
      ${htmlList(["PC de escritorio", "Notebook", "Servidor básico", "Celular", "Tablet"])}
      <p>Estos equipos pueden recibir soporte técnico, mantenimiento, diagnóstico, optimización, asistencia de software y seguimiento dentro del portal.</p>
    `),
    coverageBlock("PC / Notebook / Servidor básico", `
      <p>El soporte puede incluir:</p>
      ${htmlList(["diagnóstico técnico", "optimización de sistema", "mantenimiento preventivo", "instalación y configuración de software", "soporte remoto", "soporte presencial según plan", "revisión de sistema operativo", "backup básico", "configuración de usuarios", "limpieza de sistema", "seguimiento técnico"])}
      <p>Si el equipo requiere repuestos, reparación avanzada, recuperación compleja de datos o trabajos fuera del alcance del plan, se informará y cotizará aparte.</p>
    `),
    coverageBlock("Celulares / Tablets", `
      <p>Los celulares y tablets pueden registrarse como equipos principales si la empresa desea incluirlos dentro del soporte.</p>
      ${htmlList(["diagnóstico inicial", "configuración de cuentas", "correo empresarial", "apps", "sincronización", "backup básico", "asistencia de software", "restablecimiento / formateo", "orientación técnica"])}
      <p>Las reparaciones físicas, cambios de módulo, batería, pin de carga u otros repuestos se cotizan aparte.</p>
    `),
    coverageBlock("Recursos / Periféricos", `
      <p>Además de los equipos principales, cada empresa puede registrar recursos y periféricos para documentar su infraestructura tecnológica.</p>
      ${htmlList(["impresoras", "routers", "módems", "access points", "switches", "cámaras IP", "lectores / scanners", "otros dispositivos de apoyo"])}
      <p>Estos recursos no cuentan como equipos principales del plan.</p>
      <p>Sirven para:</p>
      ${htmlList(["tener registro técnico", "guardar marca y modelo", "preparar drivers antes de una visita", "conocer la infraestructura de la empresa", "facilitar tareas de configuración", "agilizar el soporte", "documentar el entorno tecnológico del cliente"])}
      <p>Los recursos/periféricos no incluyen reparación física del dispositivo. Su soporte se limita a configuración, instalación, conectividad, drivers y orientación técnica según corresponda.</p>
    `),
    coverageBlock("Impresoras", `
      <p>Las impresoras se registran como recursos/periféricos.</p>
      ${htmlList(["instalación de drivers", "configuración por USB", "configuración en red", "configuración de impresión compartida", "revisión básica de conectividad", "orientación técnica"])}
      <p>El plan no incluye reparación física, mecánica o electrónica de impresoras. Si el equipo presenta una falla técnica, se informará al cliente y podrá derivarse a un servicio especializado.</p>
    `),
    coverageBlock("Routers / Access Points / Red", `
      <p>Los equipos de red se registran como recursos/periféricos.</p>
      ${htmlList(["configuración básica", "cambio de nombre de red", "cambio de contraseña WiFi", "revisión de conectividad", "configuración de red básica", "configuración de access point", "orientación técnica"])}
      <p>El plan no incluye reparación física de routers, módems, switches o access points. Si el dispositivo está dañado, se recomendará reemplazo o derivación técnica.</p>
    `),
    coverageBlock("Visitas y asistencias", `
      <p>Las visitas presenciales incluidas tienen una duración máxima de 1 hora por visita.</p>
      <p>Durante ese tiempo se podrán realizar tareas de diagnóstico, configuración, soporte, mantenimiento o resolución de problemas dentro del alcance del plan contratado.</p>
      <p>Si el trabajo requiere más tiempo, repuestos, licencias, recuperación de datos, reparación física o tareas adicionales, se informará previamente y podrá cotizarse como servicio adicional.</p>
      ${htmlList(["las asistencias incluidas corresponden al período mensual activo", "las asistencias no son acumulables de un mes a otro", "el soporte remoto y presencial está sujeto a disponibilidad y coordinación previa", "las urgencias fuera del horario habitual pueden tener costo adicional", "el administrador puede definir si un ticket descuenta o no una asistencia"])}
    `),
    coverageBlock("No incluido en el plan", htmlList(["repuestos", "licencias de software", "insumos", "reparación física de impresoras", "reparación física de routers, módems o access points", "reparación electrónica compleja", "recuperación avanzada de datos", "trabajos eléctricos", "cableado estructural avanzado", "trabajos fuera de horario", "equipos no registrados", "tareas que superen el tiempo incluido por visita", "reparaciones físicas de celulares sin presupuesto previo", "cambios de módulo, batería o pin de carga sin cotización previa"])),
    coverageBlock("Servicios adicionales", `
      <p>Los servicios fuera del alcance del plan pueden cotizarse por separado.</p>
      ${htmlList(["Visita técnica empresarial: $25.000", "Instalación PC corporativa completa: $45.000", "Configuración puestos de trabajo: $30.000", "Configuración impresoras/red: $35.000", "Instalación Windows corporativa: $42.000", "Soporte remoto empresarial: $15.000", "Optimización notebook empresarial: $30.000", "Auditoría inicial empresa: $45.000", "Formateo / restablecimiento celular: $20.000", "Backup y restauración celular: $15.000", "Cambio de módulo / pantalla: desde $28.000 + repuesto", "Cambio de batería: desde $15.000 + repuesto", "Cambio de pin de carga: desde $22.000 + repuesto"])}
      <p>Los precios pueden modificarse desde administración.</p>
    `),
    coverageBlock("Condiciones generales", `
      <p>Los servicios incluidos en cada plan se aplican sobre equipos principales registrados en el portal de TecnoStore Empresas.</p>
      <p>También pueden registrarse recursos/periféricos, como impresoras, routers, access points y otros dispositivos, con el objetivo de documentar la infraestructura de la empresa y facilitar tareas de configuración.</p>
      <p>Los recursos/periféricos no cuentan como equipos principales del plan y no incluyen reparación física.</p>
      <p>Las visitas presenciales tienen una duración máxima de 1 hora por visita.</p>
      <p>Si una tarea requiere más tiempo, repuestos, licencias, reparación física o trabajos fuera del alcance contratado, será informado y cotizado como servicio adicional.</p>
      <p>Las asistencias incluidas corresponden al período mensual activo y no son acumulables.</p>
    `),
  ].join("");
}

function whatsappVisitMessage(visit) {
  return [
    "Hola, soy de TecnoStore Empresas.",
    `Quería coordinar una visita o consulta para ${visit.businessName}.`,
    "Brindamos soporte técnico y mantenimiento IT para comercios y PYMES.",
  ].join("\n");
}

function normalizedPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("54")) return digits;
  return `54${digits.replace(/^0+/, "")}`;
}

function prospectWhatsappUrl(visit) {
  const phone = normalizedPhone(visit.phone);
  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(whatsappVisitMessage(visit))}`;
}

function mapAddress(visit) {
  return [visit.address, "San Luis", "Argentina"].filter(Boolean).join(", ");
}

function mapsDirectionsUrl(visit) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapAddress(visit))}&travelmode=driving`;
}

function mapsRouteUrl(visits) {
  const routeVisits = visits
    .filter((visit) => visit.address && !["ContratÃ³", "No visitado"].includes(visit.status))
    .slice(0, 8);
  if (!routeVisits.length) return "";
  if (routeVisits.length === 1) return mapsDirectionsUrl(routeVisits[0]);
  const destination = mapAddress(routeVisits[routeVisits.length - 1]);
  const waypoints = routeVisits.slice(0, -1).map(mapAddress).join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
}

function adminNotifications() {
  return [
    ...(state.planRequests || []).filter((request) => request.status === "Pendiente").map((request) => ({
      id: request.id,
      kind: "plan-request",
      urgency: "normal",
      status: "Pendiente",
      updatedAt: request.createdAt,
      label: `Ampliación de plan · ${companyName(request.companyId)}`,
      detail: request.message,
    })),
    ...state.tickets
    .filter((ticket) => isOpenTicket(ticket))
    .sort((a, b) => {
      const urgencyScore = { crítica: 4, critica: 4, alta: 3, normal: 2, baja: 1 };
      return (urgencyScore[b.urgency] || 0) - (urgencyScore[a.urgency] || 0) || b.updatedAt.localeCompare(a.updatedAt);
    })
    .map((ticket) => ({
      ...ticket,
      kind: "ticket",
      label: `${ticket.ticketNumber} · ${companyName(ticket.companyId)}`,
      detail: `${getEquipment(ticket.equipmentId)?.name || "Otro / consulta general"} · ${ticket.problemType}`,
    })),
  ].slice(0, 8);
}

function badge(text) {
  return `<span class="badge ${statusClass(text)}">${text}</span>`;
}

function navItems() {
  if (state.role === "admin") {
    const user = currentUser();
    if (user?.role === "Vendedor") {
      return [
        ["admin-sales", "Mis visitas", "◇"],
        ["admin-plans", "Planes", "◎"],
      ];
    }
    return [
      ["admin-dashboard", "Inicio", "◧"],
      ["admin-companies", "Empresas", "□"],
      ["admin-tickets", "Tickets", "≡"],
      ["admin-repairs", "Reparaciones", "◇"],
      ["admin-equipment", "Equipos", "▣"],
      ["admin-sales", "Ventas", "◌"],
      ["admin-users", "Usuarios", "♙"],
      ["admin-plans", "Planes", "◎"],
    ];
  }
  return [
    ["dashboard", "Inicio", "◧"],
    ["equipment", "Mis equipos", "▣"],
    ["support", "Solicitar soporte", "+"],
    ["tickets", "Tickets", "≡"],
    ["repairs", "Reparaciones", "◇"],
    ["plan", "Plan y facturación", "◎"],
    ["history", "Historial", "◷"],
    ["contact", "Contacto", "☎"],
  ];
}

function activeView() {
  return state.role === "admin" ? state.adminView : state.clientView;
}

function setView(view) {
  if (state.role === "admin") {
    state.adminView = view;
    state.adminFocus = null;
  } else state.clientView = view;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function login(email = "", password = "") {
  const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase() && item.active);
  if (email && !user) {
    alert("No encontramos un usuario activo con ese email. Revisá el dato o pedí ayuda a TecnoStore.");
    return;
  }
  if (!user || user.password !== password) {
    alert("Email o contraseña incorrectos.");
    return;
  }
  state.loggedIn = true;
  state.currentUserId = user?.id || "";
  if (user?.role === "Cliente empresa") {
    state.role = "client";
    state.currentCompanyId = user.companyId || state.currentCompanyId;
    state.clientView = "dashboard";
  } else {
    state.role = user ? "admin" : "client";
    if (state.role === "admin") state.adminView = user?.role === "Vendedor" ? "admin-sales" : "admin-dashboard";
    else state.clientView = "dashboard";
  }
  saveState();
  render();
}

function logout() {
  state.loggedIn = false;
  saveState();
  document.body.className = "";
  $("#app").innerHTML = loginTemplate();
  bindLoginEvents();
}

function render() {
  document.body.className = `${state.role} ${currentPlanThemeClass()}`;
  $("#app").innerHTML = shellTemplate();
  bindGlobalEvents();
  bindCurrentViewEvents();
}

function loginTemplate() {
  return `
    <main class="login-shell">
      <section class="login-visual">
        <div class="login-copy">
          <h1>Portal TecnoStore</h1>
          <p>Soporte IT organizado para que tu negocio no se frene cuando la tecnología decide hacerse la difícil.</p>
        </div>
      </section>
      <section class="login-panel">
        <form class="login-card" id="loginForm" autocomplete="off">
          <div class="brand">
            <img class="brand-logo" src="/assets/logo.png" alt="TecnoStore Empresas" />
            <div>
              <strong>TecnoStore Empresas</strong>
              <span>Portal privado de soporte IT</span>
            </div>
          </div>
          <h2>Ingresar</h2>
          <p>Portal de soporte técnico para empresas y PYMES.</p>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" placeholder="tuempresa@correo.com" autocomplete="off" required />
          </div>
          <div class="field">
            <label for="password">Contraseña</label>
            <input id="password" type="password" placeholder="Tu contraseÃ±a" autocomplete="current-password" required />
          </div>
          <div class="login-actions">
            <button class="button" type="submit">Ingresar</button>
            <button class="ghost-button" type="button" data-help>¿Necesitás ayuda?</button>
          </div>
          <p class="helper-text">Ingresá con tu email asignado por TecnoStore Empresas.</p>
        </form>
      </section>
    </main>
  `
    .replace(
      /placeholder="Tu .*?"/,
      'placeholder="Tu clave"'
    )
    .replace(
      /autocomplete="current-password"/,
      'autocomplete="new-password"'
    )
    .replace(
      /<p class="helper-text">.*?<\/p>/,
      '<p class="helper-text">Si no tenes acceso o necesitas recuperar tu clave, escribinos al WhatsApp 266 510 5694.</p>'
    );
}

function shellTemplate() {
  const company = getCompany();
  const user = currentUser();
  const items = navItems();
  const current = activeView();
  const notifications = adminNotifications();
  const sidebarNav = items
    .map(([id, label, icon]) => `<button class="${current === id ? "active" : ""}" data-view="${id}"><span>${icon}</span>${label}</button>`)
    .join("");
  const mobileItems = state.role === "admin"
    ? (currentUser()?.role === "Vendedor"
        ? items
        : [
            ["admin-dashboard", "Inicio", "◧"],
            ["admin-tickets", "Tickets", "≡"],
            ["admin-repairs", "Repar.", "◇"],
            ["admin-sales", "Ventas", "◌"],
            ["admin-plans", "Planes", "◎"],
          ])
    : [
        ["dashboard", "Inicio", "◧"],
        ["equipment", "Equipos", "▣"],
        ["tickets", "Tickets", "≡"],
        ["support", "Soporte", "+"],
        ["plan", "Plan", "◎"],
      ];
  const mobileNav = mobileItems
    .map(([id, label, icon]) => `<button class="${current === id ? "active" : ""}" data-view="${id}"><span>${icon}</span>${label}</button>`)
    .join("");

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <img class="brand-logo" src="/assets/logo.png" alt="TecnoStore Empresas" />
          <div>
            <strong>TecnoStore Empresas</strong>
            <span>Soporte IT organizado</span>
          </div>
        </div>
        <nav class="nav">${sidebarNav}</nav>
        <div class="sidebar-footer">
          <strong>Nos ocupamos de la tecnología de tu negocio.</strong><br />
          ${state.role === "admin" ? "Panel privado para gestión interna." : company.name}
        </div>
      </aside>
      <main>
        <header class="topbar">
          <div class="brand">
            <img class="brand-logo" src="/assets/logo.png" alt="TecnoStore Empresas" />
            <div>
              <strong>TecnoStore Empresas</strong>
              <span>Portal privado de soporte IT</span>
            </div>
          </div>
          <div class="topbar-actions">
            <span class="role-pill">${state.role === "admin" ? `${user?.role || "Administrador"} · ${user?.name || "TecnoStore"}` : company.name}</span>
            ${state.role === "admin" ? `<button class="notification-button" type="button" data-open-notifications title="Notificaciones"><span>!</span>${notifications.length ? `<strong>${notifications.length}</strong>` : ""}</button>` : ""}
            <button class="icon-button" type="button" data-logout title="Salir">×</button>
          </div>
        </header>
        <section class="content">${contentTemplate()}</section>
      </main>
      <nav class="mobile-nav">${mobileNav}</nav>
      <dialog id="modal"></dialog>
    </div>
  `;
}

function contentTemplate() {
  if (state.role === "admin") {
    return {
      "admin-dashboard": adminDashboardTemplate,
      "admin-companies": adminCompaniesTemplate,
      "admin-tickets": adminTicketsTemplate,
      "admin-repairs": adminRepairsTemplate,
      "admin-equipment": adminEquipmentTemplate,
      "admin-sales": adminSalesTemplate,
      "admin-users": adminUsersTemplate,
      "admin-plans": adminPlansTemplate,
    }[state.adminView]();
  }
  return {
    dashboard: dashboardTemplate,
    equipment: equipmentTemplate,
    support: supportTemplate,
    tickets: ticketsTemplate,
    "ticket-detail": ticketDetailTemplate,
    repairs: repairsTemplate,
    plan: planTemplate,
    history: historyTemplate,
    contact: contactTemplate,
  }[state.clientView]();
}

function dashboardTemplate() {
  const company = getCompany();
  const plan = getPlan(company.planId);
  const tickets = companyTickets();
  const equipment = companyEquipment();
  const mainEquipment = equipment.filter(isPrimaryEquipment);
  const resources = equipment.filter((item) => !isPrimaryEquipment(item));
  const onsiteIncluded = includedOnsiteVisitsFor(company);
  const onsiteUsed = usedOnsiteVisitsFor(company);
  const repairs = companyRepairs();
  const openTickets = tickets.filter((ticket) => !["Resuelto", "Cerrado", "Cancelado"].includes(ticket.status));
  const recent = [
    ...tickets.map((ticket) => ({
      date: ticket.updatedAt,
      type: "ticket creado",
      status: ticket.status,
      description: `${ticket.ticketNumber} sobre ${getEquipment(ticket.equipmentId)?.name || "equipo"}`,
    })),
    ...companyLogs().map((log) => ({
      date: log.createdAt,
      type: log.serviceType,
      status: log.status,
      description: log.description,
    })),
    ...repairs.map((repair) => ({
      date: repair.entryDate,
      type: "equipo recibido",
      status: repair.status,
      description: `${repair.orderNumber} - ${getEquipment(repair.equipmentId)?.name || "Equipo"}`,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return `
    <div class="section-head">
      <div>
        <h1>Hola, ${company.name}</h1>
        <p>Tu soporte técnico está activo.</p>
      </div>
      <button class="button" data-view="support">Solicitar asistencia</button>
    </div>
    <div class="grid stats-grid">
      ${statCard("Plan activo", plan.shortName, plan.price)}
      ${statCard("Asistencias disponibles", `${company.includedAssistances - company.usedAssistances} de ${company.includedAssistances}`, "Consumo mensual del servicio")}
      ${statCard("Visitas a domicilio", `${Math.max(0, onsiteIncluded - onsiteUsed)} de ${onsiteIncluded}`, "Presenciales de hasta 1 hora")}
      ${statCard("Tickets abiertos", openTickets.length, "Solicitudes en seguimiento")}
      ${statCard("Equipos principales", `${mainEquipment.length} / ${company.maxEquipment}`, "Incluidos dentro del plan")}
      ${statCard("Recursos / Perifericos", resources.length, "Registrados para configuracion")}
      ${statCard("Próximo vencimiento", formatDate(company.renewalDate), company.subscriptionStatus)}
    </div>
    <div class="grid two-col" style="margin-top: 18px;">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Actividad reciente</h2>
            <p>Historial técnico organizado para tu empresa.</p>
          </div>
        </div>
        <div class="activity-list">
          ${recent.map((item) => activityRow(item)).join("")}
        </div>
      </section>
      <section class="panel">
        <h2>Estado del servicio</h2>
        <div class="meta-grid">
          ${meta("Suscripción", badge(company.subscriptionStatus))}
          ${meta("Contacto", company.contactName)}
          ${meta("Equipos principales activos", mainEquipment.filter((item) => item.status === "Activo").length)}
          ${meta("Recursos registrados", resources.length)}
          ${meta("Urgencias", tickets.filter((ticket) => ["alta", "crítica"].includes(ticket.urgency)).length)}
        </div>
      </section>
    </div>
  `;
}

function statCard(label, value, note, action = "") {
  const tone = label.toLowerCase().includes("urgente") ? "tone-danger"
    : label.toLowerCase().includes("vencer") || label.toLowerCase().includes("reparación") || label.toLowerCase().includes("reparaciones") ? "tone-warning"
    : label.toLowerCase().includes("disponibles") || label.toLowerCase().includes("activo") || label.toLowerCase().includes("activas") ? "tone-success"
    : label.toLowerCase().includes("ticket") ? "tone-blue"
    : "tone-neutral";
  if (action) {
    return `<button class="stat-card stat-action ${tone}" type="button" data-admin-shortcut="${action}"><span>${label}</span><strong>${value}</strong><small>${note}</small></button>`;
  }
  return `<article class="stat-card ${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

function meta(label, value) {
  return `<div class="meta"><span>${label}</span><strong>${value}</strong></div>`;
}

function activityRow(item) {
  return `
    <div class="activity-row">
      <div class="item-head">
        <strong>${item.type}</strong>
        ${badge(item.status)}
      </div>
      <span>${formatDate(item.date)} · ${item.description}</span>
    </div>
  `;
}

function equipmentTemplate() {
  const items = companyEquipment();
  const mainItems = items.filter(isPrimaryEquipment);
  const resourceItems = items.filter((item) => !isPrimaryEquipment(item));
  return `
    <div class="section-head">
      <div>
        <h1>Activos de la empresa</h1>
        <p>Consultá el estado de tus equipos en tiempo real.</p>
      </div>
      ${state.role === "client" || canManageEquipment() ? `<button class="button" data-open-equipment>Agregar equipo</button>` : ""}
    </div>
    <section class="scope-panel">
      <strong>Equipos principales</strong>
      <span>Los equipos principales son los dispositivos incluidos dentro del soporte tecnico del plan contratado.</span>
    </section>
    <div class="grid cards-grid">${mainItems.map(equipmentCard).join("") || `<div class="empty-state">Todavia no hay equipos principales registrados.</div>`}</div>
    <section class="scope-panel peripheral">
      <strong>Recursos / Perifericos</strong>
      <span>Los recursos y perifericos se registran para facilitar configuraciones, soporte basico y documentacion tecnica. No cuentan como equipos principales del plan y no incluyen reparacion fisica del dispositivo.</span>
    </section>
    <div class="grid cards-grid">${resourceItems.map(equipmentCard).join("") || `<div class="empty-state">Todavia no hay recursos/perifericos registrados.</div>`}</div>
  `;
}

function equipmentCard(item) {
  return `
    <article class="card status-card ${statusClass(item.status)}">
      <div class="item-head">
        <div>
          <h2 class="item-title">${item.name}</h2>
          <p class="item-subtitle">${equipmentRecordType(item)} - ${normalizedEquipmentType(item.type)}</p>
          <p class="item-subtitle">${item.type} · ${item.brand} ${item.model}</p>
        </div>
        ${badge(item.status)}
      </div>
      <div class="meta-grid">
        ${meta("Serie", item.serialNumber)}
        ${meta("Sector", item.userOrSector)}
        ${meta("Sistema", item.operatingSystem)}
        ${meta("Último servicio", formatDate(item.lastServiceDate))}
      </div>
      <p class="item-subtitle">${item.notes}</p>
      <div class="scope-note">${equipmentScopeText(item)}</div>
      <div class="toolbar" style="margin: 14px 0 0;">
        <button class="soft-button" data-open-equipment="${item.id}">Editar</button>
        <button class="ghost-button" data-equipment-history="${item.id}">Ver historial</button>
        <button class="button" data-support-equipment="${item.id}">Solicitar soporte</button>
      </div>
    </article>
  `;
}

function supportTemplate(selectedEquipmentId = "") {
  const equipmentOptions = equipmentOptionsForCompany(state.currentCompanyId, selectedEquipmentId, true);
  return `
    <div class="section-head">
      <div>
        <h1>Solicitar asistencia técnica</h1>
        <p>Solicitá asistencia en pocos pasos.</p>
      </div>
    </div>
    <div id="supportNotice" class="notice"></div>
    <section class="panel">
      <form id="ticketForm" class="form-grid">
        <div class="field">
          <label>Equipo principal o recurso/periferico relacionado</label>
          <select name="equipmentId" required>${equipmentOptions}</select>
        </div>
        <div class="wide" id="ticketScopeNotice"></div>
        <div class="field">
          <label>Tipo de problema</label>
          <select name="problemType" required>
            <option>rendimiento lento</option>
            <option>problema de internet/red</option>
            <option>impresora no funciona</option>
            <option>error de Windows</option>
            <option>virus o malware</option>
            <option>problema de software</option>
            <option>equipo no enciende</option>
            <option>backup / archivos</option>
            <option>otro</option>
          </select>
        </div>
        <div class="field">
          <label>Urgencia</label>
          <select name="urgency" required>
            <option>baja</option>
            <option selected>normal</option>
            <option>alta</option>
            <option>crítica</option>
          </select>
        </div>
        <div class="field">
          <label>Modalidad preferida</label>
          <select name="modality" required>
            <option>remoto</option>
            <option>presencial</option>
            <option>indiferente</option>
          </select>
        </div>
        <div class="field wide">
          <label>Descripción del problema</label>
          <textarea name="description" required placeholder="Contanos qué ocurre, cuándo empezó y qué tarea está afectando."></textarea>
        </div>
        <div class="field">
          <label>Horario disponible</label>
          <input name="availability" placeholder="Ej: lunes a viernes de 9 a 13" />
        </div>
        <div class="whatsapp-card">
          <strong>¿Tenés capturas o fotos?</strong>
          <span>Después de enviar la solicitud abriremos WhatsApp para que puedas mandarlas directo al equipo técnico.</span>
        </div>
        <div class="wide">
          <button class="button" type="submit">Enviar solicitud</button>
        </div>
      </form>
    </section>
  `;
}

function ticketsTemplate() {
  const tickets = companyTickets().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `
    <div class="section-head">
      <div>
        <h1>Tickets</h1>
        <p>Consultá el estado de tus solicitudes de soporte.</p>
      </div>
      <button class="button" data-view="support">Nuevo ticket</button>
    </div>
    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Equipo</th>
              <th>Problema</th>
              <th>Fecha</th>
              <th>Urgencia</th>
              <th>Modalidad</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${tickets.map(ticketRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function ticketRow(ticket) {
  return `
    <tr class="status-row ${statusClass(ticket.status)}">
      <td><strong>${ticket.ticketNumber}</strong></td>
      <td>${getEquipment(ticket.equipmentId)?.name || "Sin equipo"}</td>
      <td>${ticket.problemType}</td>
      <td>${formatDate(ticket.createdAt)}</td>
      <td>${badge(ticket.urgency)}</td>
      <td>${ticket.modality}</td>
      <td>${badge(ticket.status)}</td>
      <td><button class="soft-button" data-ticket-detail="${ticket.id}">Ver</button></td>
    </tr>
  `;
}

function ticketDetailTemplate() {
  const ticket = state.tickets.find((item) => item.id === state.selectedTicketId) || companyTickets()[0];
  if (!ticket) return `<div class="empty-state">No hay tickets para mostrar.</div>`;
  const equipment = getEquipment(ticket.equipmentId);
  const steps = ["Ticket creado", "En revisión", "En proceso", "Resuelto", "Cerrado"];
  const statusIndex = Math.max(0, steps.findIndex((step) => step.includes(ticket.status) || ticket.status.includes(step.replace("Ticket creado", "Recibido"))));
  const updates = state.ticketUpdates.filter((update) => update.ticketId === ticket.id && update.visibleToClient);

  return `
    <div class="section-head">
      <div>
        <h1>${ticket.ticketNumber}</h1>
        <p>${equipment?.name || "Equipo"} · ${ticket.problemType}</p>
      </div>
      <button class="soft-button" data-view="tickets">Volver a tickets</button>
    </div>
    <div class="grid two-col">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Detalle del ticket</h2>
            <p>Última actualización: ${formatDate(ticket.updatedAt)}</p>
          </div>
          ${badge(ticket.status)}
        </div>
        <div class="meta-grid">
          ${meta("Equipo", equipment?.name || "Sin equipo")}
          ${meta("Tipo de activo", equipment ? equipmentRecordType(equipment) : "Consulta general")}
          ${meta("Urgencia", badge(ticket.urgency))}
          ${meta("Modalidad", ticket.modality)}
          ${meta("Técnico asignado", ticket.assignedTechnician || "Pendiente")}
          ${meta("Descuenta asistencia", ticket.descuentaAsistencia === false ? "No" : "Si")}
          ${meta("Descuenta visita a domicilio", ticket.descuentaVisitaDomicilio ? "Si" : "No")}
          ${meta("Creado", formatDate(ticket.createdAt))}
          ${meta("Actualizado", formatDate(ticket.updatedAt))}
        </div>
        ${ticketScopeNotice(ticket.equipmentId)}
        <p class="item-subtitle" style="margin-top: 18px;">${ticket.description}</p>
      </section>
      <section class="panel">
        <h2>Línea de tiempo</h2>
        <div class="timeline" style="margin-top: 16px;">
          ${steps.map((step, index) => `
            <div class="timeline-item ${index <= statusIndex ? "done" : ""}">
              <div class="timeline-dot"></div>
              <div><strong>${step}</strong><span>${index <= statusIndex ? "Completado o en curso" : "Pendiente"}</span></div>
            </div>
          `).join("")}
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top: 16px;">
      <div class="panel-head">
        <div>
          <h2>Comentarios e información adicional</h2>
          <p>Agregá datos que ayuden a resolver la solicitud.</p>
        </div>
      </div>
      <div class="activity-list">
        ${updates.map((update) => activityRow({ date: update.createdAt, type: update.author, status: update.status, description: update.message })).join("")}
      </div>
      <form id="commentForm" class="form-grid" style="margin-top: 16px;">
        <div class="field wide">
          <label>Comentario</label>
          <textarea name="message" required placeholder="Escribí una aclaración o información adicional."></textarea>
        </div>
        <div class="wide">
          <button class="button" type="submit">Agregar comentario</button>
          <a class="soft-button inline-action" href="${whatsappUrl(whatsappTicketMessage(ticket))}" target="_blank" rel="noreferrer">Enviar captura por WhatsApp</a>
        </div>
      </form>
    </section>
  `;
}

function repairsTemplate() {
  const repairs = companyRepairs();
  return `
    <div class="section-head">
      <div>
        <h1>Reparaciones</h1>
        <p>Equipos dejados físicamente en el local.</p>
      </div>
    </div>
    <div class="grid cards-grid">
      ${repairs.map(repairCard).join("") || `<div class="empty-state">No hay reparaciones activas.</div>`}
    </div>
  `;
}

function repairCard(repair) {
  return `
    <article class="card status-card ${statusClass(repair.status)}">
      <div class="item-head">
        <div>
          <h2 class="item-title">${repair.orderNumber}</h2>
          <p class="item-subtitle">${getEquipment(repair.equipmentId)?.name || "Equipo"} · Ingreso ${formatDate(repair.entryDate)}</p>
        </div>
        ${badge(repair.status)}
      </div>
      <div class="meta-grid">
        ${meta("Diagnóstico", repair.diagnosis)}
        ${meta("Presupuesto", repair.budget || "No informado")}
        ${meta("Técnico", repair.assignedTechnician)}
        ${meta("Estimada", formatDate(repair.estimatedFinishDate))}
      </div>
      <p class="item-subtitle">${repair.notes}</p>
    </article>
  `;
}

function planTemplate() {
  const company = getCompany();
  if (!company) return `<div class="empty-state">No hay empresa seleccionada.</div>`;
  const plan = getPlan(company.planId);
  const available = company.includedAssistances - company.usedAssistances;
  const onsiteIncluded = includedOnsiteVisitsFor(company);
  const onsiteUsed = usedOnsiteVisitsFor(company);
  const onsiteAvailable = availableOnsiteVisitsFor(company);
  const progress = Math.round((company.usedAssistances / company.includedAssistances) * 100);
  const onsiteProgress = onsiteIncluded ? Math.round((onsiteUsed / onsiteIncluded) * 100) : 0;
  return `
    <div class="section-head">
      <div>
        <h1>Plan y suscripción</h1>
        <p>Estado del plan, asistencias y servicios incluidos.</p>
      </div>
      <button class="button" data-plan-upgrade>Solicitar ampliación de plan</button>
    </div>
    <section class="plan-band">
      <div>
        <h2>${plan.name}</h2>
        <p>${plan.description} · ${plan.price}</p>
      </div>
      <div>
        <strong>${company.usedAssistances} asistencias usadas de ${company.includedAssistances}</strong>
        <div class="progress-track"><div class="progress-bar" style="width: ${progress}%"></div></div>
        <small>${onsiteAvailable} visitas a domicilio disponibles de ${onsiteIncluded}</small>
      </div>
    </section>
    <div class="grid two-col" style="margin-top: 16px;">
      <section class="panel">
        <h2>Resumen</h2>
        <div class="meta-grid">
          ${meta("Estado del plan", badge(company.subscriptionStatus))}
          ${meta("Inicio", formatDate(company.startDate))}
          ${meta("Próximo vencimiento", formatDate(company.renewalDate))}
          ${meta("Asistencias incluidas", company.includedAssistances)}
          ${meta("Asistencias usadas", company.usedAssistances)}
          ${meta("Asistencias disponibles", available)}
          ${meta("Visitas a domicilio incluidas", onsiteIncluded)}
          ${meta("Visitas a domicilio usadas", onsiteUsed)}
          ${meta("Visitas a domicilio disponibles", onsiteAvailable)}
          ${meta("Equipos principales permitidos", company.maxEquipment)}
          ${meta("Equipos principales registrados", primaryEquipment().length)}
          ${meta("Recursos / Perifericos", peripheralEquipment().length)}
        </div>
        <div class="scope-note" style="margin-top: 14px;">Tu plan contempla soporte sobre equipos principales registrados. Los recursos/perifericos se registran para configuracion, documentacion y soporte basico, pero no cuentan como equipos principales ni incluyen reparacion fisica.</div>
        <div class="onsite-quota-card">
          <span>Cupo presencial independiente</span>
          <strong>${onsiteAvailable} de ${onsiteIncluded}</strong>
          <small>visitas a domicilio disponibles. Cada visita incluida contempla hasta 1 hora.</small>
          <div class="progress-track"><div class="progress-bar" style="width: ${onsiteProgress}%"></div></div>
        </div>
      </section>
      <section class="panel included-panel">
        <div class="included-head">
          <div>
            <span>Incluido en tu plan</span>
            <h2>Servicios incluidos</h2>
          </div>
          <strong>${plan.shortName}</strong>
        </div>
        <div class="visit-limit-card">
          <span>Visitas presenciales disponibles</span>
          <strong>${onsiteAvailable} de ${onsiteIncluded}</strong>
          <small>Cada visita a domicilio incluida dura hasta 1 hora. No se descuenta del soporte general salvo que administracion lo marque.</small>
        </div>
        <div class="included-grid">
          ${plan.features.map((feature, index) => `
            <div class="included-service">
              <span>${index + 1}</span>
              <strong>${feature}</strong>
            </div>
          `).join("")}
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top: 16px;">
      <h2>Alcance del servicio</h2>
      <p class="item-subtitle" style="margin-top: 12px;">Los planes de TecnoStore Empresas incluyen soporte tecnico sobre equipos principales registrados, como PCs, notebooks, servidores basicos, celulares y tablets.</p>
      <p class="item-subtitle">Tambien pueden registrarse recursos y perifericos, como impresoras, routers, access points y otros dispositivos, con el objetivo de documentar la infraestructura de la empresa y facilitar tareas de configuracion.</p>
      <p class="item-subtitle">Los recursos/perifericos no cuentan como equipos principales del plan y no incluyen reparacion fisica. Su soporte se limita a configuracion, instalacion, conectividad, drivers y orientacion tecnica, segun corresponda.</p>
      <p class="item-subtitle">Las visitas presenciales incluidas tienen una duracion maxima de 1 hora por visita. Si una tarea requiere mas tiempo, repuestos, licencias, reparacion fisica o trabajos fuera del alcance contratado, sera informado y cotizado como servicio adicional.</p>
    </section>
  `;
}

function historyTemplate() {
  const logs = companyLogs().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `
    <div class="section-head">
      <div>
        <h1>Historial técnico</h1>
        <p>Historial técnico organizado para tu empresa.</p>
      </div>
    </div>
    <section class="panel">
      <div class="service-list">
        ${logs.map((log) => `
          <div class="service-row">
            <div class="item-head">
              <strong>${formatDate(log.createdAt)} · ${log.serviceType}</strong>
              ${badge(log.status)}
            </div>
            <span>${getEquipment(log.equipmentId)?.name || "Empresa"} · ${log.description}</span>
            <span>Técnico: ${log.technician}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function contactTemplate() {
  return `
    <div class="section-head">
      <div>
        <h1>Contacto</h1>
        <p>Soporte técnico y mantenimiento IT para empresas y PYMES.</p>
      </div>
    </div>
    <section class="panel contact-panel">
      <div class="contact-heading">
        <div class="contact-mark">TS</div>
        <div>
          <h2>TecnoStore Empresas</h2>
          <p>Nos ocupamos de la tecnologia de tu negocio.</p>
        </div>
      </div>
      <div class="meta-grid" style="margin-top: 16px;">
        ${meta("WhatsApp", "266 510 5694")}
        ${meta("Dirección", "Pringles 772, San Luis")}
        ${meta("Instagram", "@tecnostore.sanluis")}
        ${meta("Mensaje", "Nos ocupamos de la tecnología de tu negocio.")}
      </div>
      <div class="contact-actions">
        <a class="contact-action primary" href="https://wa.me/542665105694" target="_blank" rel="noreferrer"><span>☎</span><strong>Enviar WhatsApp</strong></a>
        <button class="contact-action" data-view="support" type="button"><span>＋</span><strong>Solicitar asistencia</strong></button>
        <a class="contact-action" href="https://www.google.com/maps/search/?api=1&query=Pringles%20772%2C%20San%20Luis" target="_blank" rel="noreferrer"><span>⌖</span><strong>Ver ubicacion</strong></a>
      </div>
    </section>
  `;
}

function adminFocusNotice() {
  if (!state.adminFocus) return "";
  return `
    <div class="notice show">
      Mostrando: ${state.adminFocus.label}
      <button class="ghost-button" type="button" data-clear-admin-focus style="min-height: 30px; margin-left: 8px;">Quitar filtro</button>
    </div>
  `;
}

function adminDashboardTemplate() {
  const activeCompanies = state.companies.filter((company) => company.subscriptionStatus === "Activa").length;
  const openTickets = state.tickets.filter(isOpenTicket);
  const urgentTickets = state.tickets.filter(isUrgentTicket);
  const activeRepairs = state.repairs.filter(isActiveRepair);
  const expiring = state.companies.filter((company) => company.renewalDate <= "2026-06-05");
  const usedAssistances = state.companies.reduce((sum, company) => sum + Number(company.usedAssistances), 0);
  const activeUsers = state.users.filter((user) => user.active).length;
  const interestedVisits = state.salesVisits.filter((visit) => ["Interesado", "Contrató"].includes(visit.status)).length;

  return `
    <div class="section-head">
      <div>
        <h1>Panel administrador</h1>
        <p>Vista privada para TecnoStore.</p>
      </div>
      <button class="button" data-admin-new-ticket>Crear ticket</button>
    </div>
    <div class="grid stats-grid">
      ${statCard("Empresas activas", activeCompanies, "Ver clientes con suscripción activa", "companies-active")}
      ${statCard("Tickets abiertos", openTickets.length, "Ver solicitudes en gestión", "tickets-open")}
      ${statCard("Tickets urgentes", urgentTickets.length, "Ver alta o crítica", "tickets-urgent")}
      ${statCard("Reparaciones en curso", activeRepairs.length, "Ver órdenes abiertas", "repairs-active")}
      ${statCard("Planes próximos a vencer", expiring.length, "Ver vencimientos cercanos", "companies-expiring")}
      ${statCard("Asistencias usadas este mes", usedAssistances, "Ver consumo por empresa", "companies-assistances")}
      ${statCard("Usuarios activos", activeUsers, "Clientes, técnicos y ventas", "users-active")}
      ${statCard("Oportunidades comerciales", interestedVisits, "Interesados o contratados", "sales-opportunities")}
    </div>
    ${(state.planRequests || []).filter((request) => request.status === "Pendiente").length ? `
      <section class="panel" style="margin-top: 18px;">
        <div class="panel-head">
          <div>
            <h2>Solicitudes de plan</h2>
            <p>Pedidos enviados por clientes desde su portal.</p>
          </div>
        </div>
        <div class="activity-list">
          ${(state.planRequests || []).filter((request) => request.status === "Pendiente").map((request) => `
            <div class="activity-row">
              <div class="item-head">
                <strong>${companyName(request.companyId)}</strong>
                ${badge(request.status)}
              </div>
              <span>${formatDate(request.createdAt)} · ${request.message}</span>
            </div>
          `).join("")}
        </div>
      </section>
    ` : ""}
    <section class="alert-strip ${urgentTickets.length ? "is-hot" : ""}">
      <div>
        <strong>${urgentTickets.length ? "Atención técnica prioritaria" : "Operación bajo control"}</strong>
        <span>${urgentTickets.length ? `Hay ${urgentTickets.length} ticket(s) de alta prioridad para revisar.` : "No hay urgencias críticas en este momento."}</span>
      </div>
      <button class="soft-button" data-admin-shortcut="${urgentTickets.length ? "tickets-urgent" : "tickets-open"}">${urgentTickets.length ? "Ver urgentes" : "Ver tickets"}</button>
    </section>
    <section class="panel" style="margin-top: 18px;">
      <div class="panel-head">
        <div>
          <h2>Acciones rápidas</h2>
          <p>Alta comercial, usuarios y planes desde el mismo panel.</p>
        </div>
      </div>
      <div class="toolbar" style="margin: 0;">
        <button class="button" data-open-company>Nueva empresa + login</button>
        <button class="soft-button" data-open-user>Agregar técnico o vendedor</button>
        <button class="soft-button" data-open-plan>Crear plan</button>
      </div>
    </section>
    <section class="panel" style="margin-top: 18px;">
      <div class="panel-head">
        <div>
          <h2>Últimos movimientos</h2>
          <p>Actividad reciente de tickets, reparaciones e historial.</p>
        </div>
      </div>
      <div class="activity-list">
        ${[
          ...state.tickets.map((ticket) => ({ date: ticket.updatedAt, type: companyName(ticket.companyId), status: ticket.status, description: `${ticket.ticketNumber} · ${ticket.problemType}` })),
          ...state.repairs.map((repair) => ({ date: repair.entryDate, type: companyName(repair.companyId), status: repair.status, description: `${repair.orderNumber} · ${getEquipment(repair.equipmentId)?.name || "Equipo"}` })),
        ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map(activityRow).join("")}
      </div>
    </section>
  `;
}

function adminCompaniesTemplate() {
  let companies = [...state.companies];
  const filters = {
    companyStatus: state.filters.companyStatus || "Todas",
    companyPlan: state.filters.companyPlan || "Todos",
    companySearch: state.filters.companySearch || "",
  };
  if (state.adminFocus?.type === "companies-active") {
    companies = companies.filter((company) => company.subscriptionStatus === "Activa");
  }
  if (state.adminFocus?.type === "companies-expiring") {
    companies = companies.filter((company) => company.renewalDate <= "2026-06-05");
  }
  if (state.adminFocus?.type === "companies-assistances") {
    companies = companies.filter((company) => Number(company.usedAssistances) > 0);
    companies.sort((a, b) => Number(b.usedAssistances) - Number(a.usedAssistances));
  }
  companies = companies.filter((company) => {
    const statusOk = filters.companyStatus === "Todas" || company.subscriptionStatus === filters.companyStatus;
    const planOk = filters.companyPlan === "Todos" || company.planId === filters.companyPlan;
    const searchOk = textMatches(filters.companySearch, [
      company.name,
      company.contactName,
      company.email,
      company.phone,
      company.address,
      getPlan(company.planId).shortName,
    ]);
    return statusOk && planOk && searchOk;
  });

  return `
    <div class="section-head">
      <div>
        <h1>Empresas</h1>
        <p>Crear, editar y revisar clientes empresariales.</p>
      </div>
      <button class="button" data-open-company>Nueva empresa</button>
    </div>
    ${adminFocusNotice()}
    <section class="panel filter-panel">
      <div class="toolbar" style="margin-bottom: 0;">
        <div class="filters">
          <input data-filter="companySearch" placeholder="Buscar empresa, contacto o email" value="${escapeAttr(filters.companySearch)}" />
          <select data-filter="companyStatus">
            <option value="Todas">Todas las suscripciones</option>
            ${subscriptionStatuses.map((status) => `<option value="${status}" ${filters.companyStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <select data-filter="companyPlan">
            <option value="Todos">Todos los planes</option>
            ${state.plans.map((plan) => `<option value="${plan.id}" ${filters.companyPlan === plan.id ? "selected" : ""}>${plan.shortName}</option>`).join("")}
          </select>
        </div>
        <span class="filter-count">Mostrando ${companies.length} de ${state.companies.length}</span>
      </div>
    </section>
    <div class="grid cards-grid">
      ${companies.map((company) => {
        const plan = getPlan(company.planId);
        const loginUser = getCompanyUser(company.id);
        return `
          <article class="card status-card ${statusClass(company.subscriptionStatus)}">
            <div class="item-head">
              <div>
                <h2 class="item-title">${company.name}</h2>
                <p class="item-subtitle">${company.contactName} · ${company.email}</p>
              </div>
              ${badge(company.subscriptionStatus)}
            </div>
            <div class="meta-grid">
              ${meta("Plan", plan.shortName)}
              ${meta("Vencimiento", formatDate(company.renewalDate))}
              ${meta("Asistencias", `${company.usedAssistances}/${company.includedAssistances}`)}
              ${meta("Visitas domicilio", `${usedOnsiteVisitsFor(company)}/${includedOnsiteVisitsFor(company)}`)}
              ${meta("Equipos principales", `${primaryEquipment(company.id).length}/${company.maxEquipment}`)}
              ${meta("Recursos", peripheralEquipment(company.id).length)}
              ${meta("Login cliente", loginUser ? loginUser.email : "Sin usuario")}
            </div>
            <p class="item-subtitle">${company.notes}</p>
            <div class="toolbar" style="margin: 14px 0 0;">
              <button class="soft-button" data-open-company="${company.id}">Editar</button>
              <button class="ghost-button" data-open-user="${loginUser?.id || ""}" data-user-company="${company.id}">Login</button>
              <button class="ghost-button" data-select-company="${company.id}">Ver como cliente</button>
              <button class="danger-button" data-delete-company="${company.id}">Eliminar</button>
            </div>
          </article>
        `;
      }).join("") || `<div class="empty-state">Todavía no hay empresas cargadas. Usá “Nueva empresa” para empezar.</div>`}
    </div>
  `;
}

function adminTicketsTemplate() {
  const filtered = state.tickets.filter((ticket) => {
    const companyOk = state.filters.ticketCompany === "Todas" || ticket.companyId === state.filters.ticketCompany;
    const statusOk = state.filters.ticketStatus === "Todos" || ticket.status === state.filters.ticketStatus;
    const urgencyOk = state.filters.ticketUrgency === "Todas" || ticket.urgency === state.filters.ticketUrgency;
    const searchOk = textMatches(state.filters.ticketSearch || "", [
      ticket.ticketNumber,
      ticket.problemType,
      ticket.description,
      ticket.assignedTechnician,
      companyName(ticket.companyId),
      getEquipment(ticket.equipmentId)?.name,
    ]);
    const focusOpenOk = state.adminFocus?.type !== "tickets-open" || isOpenTicket(ticket);
    const focusUrgentOk = state.adminFocus?.type !== "tickets-urgent" || isUrgentTicket(ticket);
    return companyOk && statusOk && urgencyOk && searchOk && focusOpenOk && focusUrgentOk;
  });

  return `
    <div class="section-head">
      <div>
        <h1>Gestión de tickets</h1>
        <p>Asignar técnicos, responder y cambiar estados.</p>
      </div>
      <button class="button" data-admin-new-ticket>Crear ticket</button>
    </div>
    ${adminFocusNotice()}
    <section class="panel">
      <div class="toolbar">
        <div class="filters">
          <input data-filter="ticketSearch" placeholder="Buscar ticket, equipo o problema" value="${escapeAttr(state.filters.ticketSearch || "")}" />
          <select data-filter="ticketCompany">
            <option value="Todas">Todas las empresas</option>
            ${state.companies.map((company) => `<option value="${company.id}" ${state.filters.ticketCompany === company.id ? "selected" : ""}>${company.name}</option>`).join("")}
          </select>
          <select data-filter="ticketStatus">
            <option>Todos</option>
            ${ticketStatuses.map((status) => `<option ${state.filters.ticketStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <select data-filter="ticketUrgency">
            <option>Todas</option>
            ${["baja", "normal", "alta", "crítica"].map((urgency) => `<option ${state.filters.ticketUrgency === urgency ? "selected" : ""}>${urgency}</option>`).join("")}
          </select>
        </div>
        <span class="filter-count">Mostrando ${filtered.length} de ${state.tickets.length}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Empresa</th>
              <th>Equipo</th>
              <th>Urgencia</th>
              <th>Estado</th>
              <th>Técnico</th>
              <th>Actualizar</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((ticket) => `
              <tr class="status-row ${statusClass(ticket.status)}">
                <td><strong>${ticket.ticketNumber}</strong><br />${ticket.problemType}</td>
                <td>${companyName(ticket.companyId)}</td>
                <td>${getEquipment(ticket.equipmentId)?.name || "Sin equipo"}</td>
                <td>${badge(ticket.urgency)}</td>
                <td>${badge(ticket.status)}</td>
                <td>${ticket.assignedTechnician || "Pendiente"}</td>
                <td><button class="soft-button" data-admin-ticket="${ticket.id}">Gestionar</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function adminRepairsTemplate() {
  const filters = {
    repairCompany: state.filters.repairCompany || "Todas",
    repairStatus: state.filters.repairStatus || "Todos",
    repairSearch: state.filters.repairSearch || "",
  };
  const baseRepairs = state.adminFocus?.type === "repairs-active" ? state.repairs.filter(isActiveRepair) : state.repairs;
  const repairs = baseRepairs.filter((repair) => {
    const companyOk = filters.repairCompany === "Todas" || repair.companyId === filters.repairCompany;
    const statusOk = filters.repairStatus === "Todos" || repair.status === filters.repairStatus;
    const searchOk = textMatches(filters.repairSearch, [
      repair.orderNumber,
      companyName(repair.companyId),
      getEquipment(repair.equipmentId)?.name,
      repair.diagnosis,
      repair.assignedTechnician,
    ]);
    return companyOk && statusOk && searchOk;
  });
  return `
    <div class="section-head">
      <div>
        <h1>Gestión de reparaciones</h1>
        <p>Crear órdenes, cargar diagnóstico y actualizar estados.</p>
      </div>
      <button class="button" data-open-repair>Crear reparación</button>
    </div>
    ${adminFocusNotice()}
    <section class="panel filter-panel">
      <div class="toolbar" style="margin-bottom: 0;">
        <div class="filters">
          <input data-filter="repairSearch" placeholder="Buscar orden, equipo o tecnico" value="${escapeAttr(filters.repairSearch)}" />
          <select data-filter="repairCompany">
            <option value="Todas">Todas las empresas</option>
            ${state.companies.map((company) => `<option value="${company.id}" ${filters.repairCompany === company.id ? "selected" : ""}>${company.name}</option>`).join("")}
          </select>
          <select data-filter="repairStatus">
            <option value="Todos">Todos los estados</option>
            ${repairStatuses.map((status) => `<option value="${status}" ${filters.repairStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
        <span class="filter-count">Mostrando ${repairs.length} de ${baseRepairs.length}</span>
      </div>
    </section>
    <div class="grid cards-grid">
      ${repairs.map((repair) => `
        <article class="card status-card ${statusClass(repair.status)}">
          <div class="item-head">
            <div>
              <h2 class="item-title">${repair.orderNumber}</h2>
              <p class="item-subtitle">${companyName(repair.companyId)} · ${getEquipment(repair.equipmentId)?.name || "Equipo"}</p>
            </div>
            ${badge(repair.status)}
          </div>
          <div class="meta-grid">
            ${meta("Diagnóstico", repair.diagnosis)}
            ${meta("Presupuesto", repair.budget || "No informado")}
            ${meta("Técnico", repair.assignedTechnician)}
            ${meta("Entrega estimada", formatDate(repair.estimatedFinishDate))}
          </div>
          <div class="toolbar" style="margin: 14px 0 0;">
            <button class="soft-button" data-open-repair="${repair.id}">Gestionar</button>
          </div>
        </article>
      `).join("") || `<div class="empty-state">Todavía no hay reparaciones cargadas.</div>`}
    </div>
  `;
}

function adminEquipmentTemplate() {
  const filters = {
    equipmentCompany: state.filters.equipmentCompany || "Todas",
    equipmentStatus: state.filters.equipmentStatus || "Todos",
    equipmentType: state.filters.equipmentType || "Todos",
    equipmentSearch: state.filters.equipmentSearch || "",
  };
  const equipmentTypes = [...new Set(state.equipment.map((item) => item.type).filter(Boolean))].sort();
  const equipment = state.equipment.filter((item) => {
    const companyOk = filters.equipmentCompany === "Todas" || item.companyId === filters.equipmentCompany;
    const statusOk = filters.equipmentStatus === "Todos" || item.status === filters.equipmentStatus;
    const typeOk = filters.equipmentType === "Todos" || item.type === filters.equipmentType;
    const searchOk = textMatches(filters.equipmentSearch, [
      item.name,
      item.brand,
      item.model,
      item.serialNumber,
      item.userOrSector,
      item.operatingSystem,
      companyName(item.companyId),
    ]);
    return companyOk && statusOk && typeOk && searchOk;
  });
  return `
    <div class="section-head">
      <div>
        <h1>Gestión de equipos</h1>
        <p>Ver equipos por empresa, editar estados y consultar historial.</p>
      </div>
      ${canManageEquipment() ? `<button class="button" data-open-equipment>Agregar equipo</button>` : ""}
    </div>
    <section class="panel filter-panel">
      <div class="toolbar" style="margin-bottom: 0;">
        <div class="filters">
          <input data-filter="equipmentSearch" placeholder="Buscar equipo, serie, sector o marca" value="${escapeAttr(filters.equipmentSearch)}" />
          <select data-filter="equipmentCompany">
            <option value="Todas">Todas las empresas</option>
            ${state.companies.map((company) => `<option value="${company.id}" ${filters.equipmentCompany === company.id ? "selected" : ""}>${company.name}</option>`).join("")}
          </select>
          <select data-filter="equipmentStatus">
            <option value="Todos">Todos los estados</option>
            ${equipmentStatuses.map((status) => `<option value="${status}" ${filters.equipmentStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <select data-filter="equipmentType">
            <option value="Todos">Todos los tipos</option>
            ${equipmentTypes.map((type) => `<option value="${type}" ${filters.equipmentType === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </div>
        <span class="filter-count">Mostrando ${equipment.length} de ${state.equipment.length}</span>
      </div>
    </section>
    <div class="grid cards-grid">
      ${equipment.map((item) => `
        <article class="card status-card ${statusClass(item.status)}">
          <div class="item-head">
            <div>
              <h2 class="item-title">${item.name}</h2>
              <p class="item-subtitle">${companyName(item.companyId)} · ${item.type} · ${item.brand} ${item.model}</p>
            </div>
            ${badge(item.status)}
          </div>
          <div class="meta-grid">
            ${meta("Serie", item.serialNumber)}
            ${meta("Sector", item.userOrSector)}
            ${meta("Sistema", item.operatingSystem)}
            ${meta("Último servicio", formatDate(item.lastServiceDate))}
          </div>
          <div class="toolbar" style="margin: 14px 0 0;">
            <button class="soft-button" data-open-equipment="${item.id}">Editar</button>
          </div>
        </article>
      `).join("") || `<div class="empty-state">Todavía no hay equipos cargados.</div>`}
    </div>
  `;
}

function adminSalesTemplate() {
  const user = currentUser();
  let visits = salesVisitsForCurrentUser();
  if (state.adminFocus?.type === "sales-opportunities") {
    visits = visits.filter((visit) => ["Interesado", "Contrató"].includes(visit.status));
  }
  const filters = {
    salesSeller: state.filters.salesSeller || "Todos",
    salesZone: state.filters.salesZone || "Todas",
    salesStatus: state.filters.salesStatus || "Todos",
  };
  if (filters.salesSeller !== "Todos") {
    visits = visits.filter((visit) => (visit.updatedBySellerId || visit.assignedSellerId || "") === filters.salesSeller);
  }
  if (filters.salesZone !== "Todas") {
    visits = visits.filter((visit) => visit.zoneId === filters.salesZone);
  }
  if (filters.salesStatus !== "Todos") {
    visits = visits.filter((visit) => visit.status === filters.salesStatus);
  }
  const zones = state.salesZones.filter((zone) => filters.salesZone === "Todas" || zone.id === filters.salesZone);
  const statusCounts = visitStatuses.map((status) => ({
    status,
    count: visits.filter((visit) => visit.status === status).length,
  }));
  const sellers = state.users.filter((seller) => seller.active && ["Vendedor", "Asistente comercial"].includes(seller.role));
  const sellerSummary = sellers.map((seller) => {
    const owned = state.salesVisits.filter((visit) => (visit.updatedBySellerId || visit.assignedSellerId) === seller.id);
    return {
      seller,
      visited: owned.filter((visit) => ["Visitado", "Interesado", "Contrató"].includes(visit.status)).length,
      interested: owned.filter((visit) => visit.status === "Interesado").length,
      hired: owned.filter((visit) => visit.status === "Contrató").length,
      notVisited: owned.filter((visit) => visit.status === "No visitado").length,
    };
  });

  return `
    <div class="section-head">
      <div>
        <h1>${user?.role === "Vendedor" ? "Mis visitas comerciales" : "Ventas y recorridos"}</h1>
        <p>Organizá zonas, prospectos y seguimiento comercial sin perder el pulso de la calle.</p>
      </div>
      <div class="toolbar" style="margin: 0;">
        ${canManageSales(user) ? `<button class="button" data-open-sales-import>Cargar zona o listado</button>` : ""}
        ${canCreateCustomer(user) ? `<button class="soft-button" data-open-company>Nueva empresa</button>` : ""}
      </div>
    </div>
    ${adminFocusNotice()}
    <section class="panel">
      <div class="toolbar" style="margin-bottom: 0;">
        <div class="filters">
          <select data-filter="salesSeller">
            <option value="Todos">Todos los vendedores</option>
            ${sellers.map((seller) => `<option value="${seller.id}" ${filters.salesSeller === seller.id ? "selected" : ""}>${seller.name}</option>`).join("")}
          </select>
          <select data-filter="salesZone">
            <option value="Todas">Todas las zonas</option>
            ${state.salesZones.map((zone) => `<option value="${zone.id}" ${filters.salesZone === zone.id ? "selected" : ""}>${zone.name}</option>`).join("")}
          </select>
          <select data-filter="salesStatus">
            <option value="Todos">Todos los estados</option>
            ${visitStatuses.map((status) => `<option ${filters.salesStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
      </div>
    </section>
    <div class="grid stats-grid">
      ${statusCounts.map((item) => statCard(item.status, item.count, "Prospectos en este estado")).join("")}
    </div>
    ${canManageSales(user) ? `
      <section class="panel" style="margin-top: 16px;">
        <div class="panel-head">
          <div>
            <h2>Resumen por vendedor</h2>
            <p>Seguimiento de visitas, interesados y contrataciones.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Visitados</th>
                <th>Interesados</th>
                <th>Contrataron</th>
                <th>No visitados</th>
              </tr>
            </thead>
            <tbody>
              ${sellerSummary.map((row) => `
                <tr>
                  <td><strong>${row.seller.name}</strong><br />${row.seller.role}</td>
                  <td>${row.visited}</td>
                  <td>${row.interested}</td>
                  <td>${row.hired}</td>
                  <td>${row.notVisited}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    ` : ""}
    <div class="sales-board">
      ${zones.map((zone) => {
        const zoneVisits = visits.filter((visit) => visit.zoneId === zone.id);
        const routeUrl = mapsRouteUrl(zoneVisits);
        return `
          <section class="zone-panel">
            <div class="zone-head">
              <div>
                <h2>${zone.name}</h2>
                <p>${zone.description || "Recorrido comercial asignado."}</p>
              </div>
              <div class="zone-actions">
                <div class="zone-badges">
                  <span class="badge">${zoneVisits.length} visitas</span>
                  <span class="badge neutral">${sellerNameOrOpen(zone.assignedSellerId)}</span>
                </div>
                ${routeUrl ? `<a class="route-button" href="${routeUrl}" target="_blank" rel="noreferrer">Ruta sugerida</a>` : ""}
              </div>
            </div>
            <div class="visit-list">
              ${zoneVisits.length ? zoneVisits.map(visitCard).join("") : `<div class="empty-state">No hay visitas cargadas en esta zona.</div>`}
            </div>
          </section>
        `;
      }).join("") || `<div class="empty-state">Todavía no hay zonas cargadas.</div>`}
    </div>
  `;
}

function visitCard(visit) {
  const whatsappLink = prospectWhatsappUrl(visit);
  return `
    <article class="visit-card status-card ${statusClass(visit.status)}">
      <div class="visit-card-head">
        <div class="visit-title-block">
          <h3>${visit.businessName}</h3>
          <p><span>⌖</span>${visit.address || "Sin direccion cargada"}</p>
        </div>
        ${badge(visit.status)}
      </div>
      <div class="visit-meta">
        <span><small>Contacto</small>${visit.contactName || "Sin contacto"}</span>
        <span><small>Telefono</small>${visit.phone || "Sin telefono"}</span>
        <span><small>Asignacion</small>${sellerNameOrOpen(visit.assignedSellerId)}</span>
        ${visit.updatedBySellerId ? `<span><small>Seguimiento</small>${userDisplayName(visit.updatedBySellerId)}</span>` : ""}
      </div>
      <p class="visit-note">${visit.notes || "Sin observaciones."}</p>
      <div class="visit-actions">
        <select data-visit-status="${visit.id}">
          ${visitStatuses.map((status) => `<option ${visit.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <a class="visit-action map" href="${mapsDirectionsUrl(visit)}" target="_blank" rel="noreferrer">Ir</a>
        ${whatsappLink ? `<a class="visit-action whatsapp" href="${whatsappLink}" target="_blank" rel="noreferrer">WhatsApp</a>` : ""}
        ${canDeleteSalesVisits() ? `<button class="visit-action danger" type="button" data-delete-visit="${visit.id}">Eliminar</button>` : ""}
      </div>
    </article>
  `;
}

function adminUsersTemplate() {
  const filters = {
    userRole: state.filters.userRole || "Todos",
    userStatus: state.filters.userStatus || "Todos",
    userCompany: state.filters.userCompany || "Todas",
    userSearch: state.filters.userSearch || "",
  };
  const baseUsers = state.adminFocus?.type === "users-active" ? state.users.filter((user) => user.active) : state.users;
  const userRoles = [...new Set(["Cliente empresa", ...internalRoles, ...state.users.map((user) => user.role)])].filter(Boolean);
  const users = baseUsers.filter((user) => {
    const roleOk = filters.userRole === "Todos" || user.role === filters.userRole;
    const statusOk = filters.userStatus === "Todos" || (filters.userStatus === "Activos" ? user.active : !user.active);
    const companyOk = filters.userCompany === "Todas" || (filters.userCompany === "TecnoStore" ? !user.companyId : user.companyId === filters.userCompany);
    const searchOk = textMatches(filters.userSearch, [
      user.name,
      user.email,
      user.phone,
      user.role,
      user.companyId ? companyName(user.companyId) : "TecnoStore",
    ]);
    return roleOk && statusOk && companyOk && searchOk;
  });
  return `
    <div class="section-head">
      <div>
        <h1>Usuarios y equipo</h1>
        <p>Alta de clientes, técnicos, vendedores y asistentes comerciales.</p>
      </div>
      <button class="button" data-open-user>Nuevo usuario</button>
    </div>
    ${adminFocusNotice()}
    <section class="panel filter-panel">
      <div class="toolbar" style="margin-bottom: 0;">
        <div class="filters">
          <input data-filter="userSearch" placeholder="Buscar nombre, email, telefono o rol" value="${escapeAttr(filters.userSearch)}" />
          <select data-filter="userRole">
            <option value="Todos">Todos los roles</option>
            ${userRoles.map((role) => `<option value="${role}" ${filters.userRole === role ? "selected" : ""}>${role}</option>`).join("")}
          </select>
          <select data-filter="userStatus">
            <option value="Todos">Todos los estados</option>
            <option value="Activos" ${filters.userStatus === "Activos" ? "selected" : ""}>Activos</option>
            <option value="Inactivos" ${filters.userStatus === "Inactivos" ? "selected" : ""}>Inactivos</option>
          </select>
          <select data-filter="userCompany">
            <option value="Todas">Todas las empresas</option>
            <option value="TecnoStore" ${filters.userCompany === "TecnoStore" ? "selected" : ""}>TecnoStore</option>
            ${state.companies.map((company) => `<option value="${company.id}" ${filters.userCompany === company.id ? "selected" : ""}>${company.name}</option>`).join("")}
          </select>
        </div>
        <span class="filter-count">Mostrando ${users.length} de ${baseUsers.length}</span>
      </div>
    </section>
    <div class="grid cards-grid">
      ${users.map((user) => `
        <article class="card status-card ${statusClass(user.active ? "Activo" : "Inactivo")}">
          <div class="item-head">
            <div>
              <h2 class="item-title">${user.name}</h2>
              <p class="item-subtitle">${user.email} · ${user.role}</p>
            </div>
            ${badge(user.active ? "Activo" : "Inactivo")}
          </div>
          <div class="meta-grid">
            ${meta("Empresa", user.companyId ? companyName(user.companyId) : "TecnoStore")}
            ${meta("Teléfono", user.phone || "Sin teléfono")}
            ${meta("Clave provisoria", user.password || "No definida")}
            ${meta("Alta", formatDate(user.createdAt))}
          </div>
          <div class="toolbar" style="margin: 14px 0 0;">
            <button class="soft-button" data-open-user="${user.id}">Editar usuario</button>
          </div>
        </article>
      `).join("") || `<div class="empty-state">No hay usuarios que coincidan con los filtros aplicados.</div>`}
    </div>
  `;
}

function adminPlansTemplate() {
  const user = currentUser();
  return `
    <div class="section-head">
      <div>
        <h1>Planes</h1>
        <p>Planes base y propuestas comerciales para cerrar altas en una visita.</p>
      </div>
      ${canManageSales(user) ? `<button class="button" data-open-plan>Crear plan</button>` : ""}
    </div>
    <div class="grid cards-grid">
      ${state.plans.map((plan) => `
        <article class="card plan-card ${plan.id}">
          <div class="item-head">
            <div>
              <h2 class="item-title">${plan.name}</h2>
              <p class="item-subtitle">${plan.description}</p>
            </div>
            <span class="plan-price">${plan.price}</span>
          </div>
          <div class="meta-grid">
            ${meta("Equipos permitidos", plan.maxEquipment)}
            ${meta("Asistencias", plan.includedAssistances)}
          </div>
          <ul class="feature-list" style="margin-top: 16px;">
            ${plan.features.map((feature) => `<li>${feature}</li>`).join("")}
          </ul>
          <div class="toolbar plan-actions" style="margin: 14px 0 0;">
            ${canManageSales(user) ? `<button class="soft-button plan-secondary" data-open-plan="${plan.id}">Editar plan</button>` : ""}
            <button class="button plan-primary" type="button" data-share-plan="${plan.id}">Compartir</button>
            <button class="soft-button plan-secondary" type="button" data-plan-coverage="${plan.id}">Ver cobertura completa</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function bindGlobalEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  $("[data-logout]")?.addEventListener("click", logout);
  $("[data-open-notifications]")?.addEventListener("click", openNotificationsModal);
}

function bindLoginEvents() {
  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    login($("#email").value, $("#password").value);
  });
  $("[data-help]").addEventListener("click", () => {
    return alert("Para recuperar tu acceso o pedir el alta de usuario, escribinos por WhatsApp al 266 510 5694.");
  });
}

function bindCurrentViewEvents() {
  document.querySelectorAll("[data-open-equipment]").forEach((button) => {
    button.addEventListener("click", () => openEquipmentModal(button.dataset.openEquipment || ""));
  });
  document.querySelectorAll("[data-support-equipment]").forEach((button) => {
    state.clientView = "support";
    saveState();
    render();
    const select = document.querySelector("[name='equipmentId']");
    if (select) select.value = button.dataset.supportEquipment;
  });
  document.querySelectorAll("[data-ticket-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTicketId = button.dataset.ticketDetail;
      state.clientView = "ticket-detail";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-equipment-history]").forEach((button) => {
    button.addEventListener("click", () => showEquipmentHistory(button.dataset.equipmentHistory));
  });
  $("#ticketForm")?.addEventListener("submit", createTicket);
  const ticketEquipmentSelect = $("#ticketForm [name='equipmentId']");
  if (ticketEquipmentSelect) {
    const updateTicketScope = () => {
      const target = $("#ticketScopeNotice");
      if (target) target.innerHTML = ticketScopeNotice(ticketEquipmentSelect.value);
    };
    ticketEquipmentSelect.addEventListener("change", updateTicketScope);
    updateTicketScope();
  }
  $("#commentForm")?.addEventListener("submit", addTicketComment);
  $("[data-plan-upgrade]")?.addEventListener("click", () => {
    createPlanUpgradeRequest();
  });
  document.querySelectorAll("[data-open-company]").forEach((button) => {
    button.addEventListener("click", () => openCompanyModal(button.dataset.openCompany || ""));
  });
  document.querySelectorAll("[data-open-user]").forEach((button) => {
    button.addEventListener("click", () => openUserModal(button.dataset.openUser || "", button.dataset.userCompany || ""));
  });
  document.querySelectorAll("[data-open-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canManageSales()) {
        alert("Los planes son definidos por administración. Podés elegir un plan existente para cada cliente.");
        return;
      }
      openPlanModal(button.dataset.openPlan || "");
    });
  });
  document.querySelectorAll("[data-plan-coverage]").forEach((button) => {
    button.addEventListener("click", () => openPlanCoverageModal(button.dataset.planCoverage));
  });
  document.querySelectorAll("[data-share-plan]").forEach((button) => {
    button.addEventListener("click", () => openPlanShareModal(button.dataset.sharePlan));
  });
  document.querySelectorAll("[data-open-sales-import]").forEach((button) => {
    button.addEventListener("click", openSalesImportModal);
  });
  document.querySelectorAll("[data-visit-status]").forEach((select) => {
    select.addEventListener("change", () => updateVisitStatus(select.dataset.visitStatus, select.value));
  });
  document.querySelectorAll("[data-delete-visit]").forEach((button) => {
    button.addEventListener("click", () => deleteSalesVisit(button.dataset.deleteVisit));
  });
  document.querySelectorAll("[data-admin-shortcut]").forEach((button) => {
    button.addEventListener("click", () => applyAdminShortcut(button.dataset.adminShortcut));
  });
  $("[data-clear-admin-focus]")?.addEventListener("click", () => {
    state.adminFocus = null;
    saveState();
    render();
  });
  document.querySelectorAll("[data-select-company]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentCompanyId = button.dataset.selectCompany;
      state.role = "client";
      state.clientView = "dashboard";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-delete-company]").forEach((button) => {
    button.addEventListener("click", () => deleteCompany(button.dataset.deleteCompany));
  });
  document.querySelectorAll("[data-filter]").forEach((filter) => {
    const updateFilter = () => {
      state.filters[filter.dataset.filter] = filter.value;
      saveState();
      render();
    };
    if (filter.tagName === "INPUT") {
      filter.addEventListener("input", () => {
        state.filters[filter.dataset.filter] = filter.value;
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
          saveState();
          render();
        }, 450);
      });
      filter.addEventListener("change", updateFilter);
    } else {
      filter.addEventListener("change", updateFilter);
    }
  });
  document.querySelectorAll("[data-admin-ticket]").forEach((button) => {
    button.addEventListener("click", () => openTicketAdminModal(button.dataset.adminTicket));
  });
  document.querySelectorAll("[data-admin-new-ticket]").forEach((button) => {
    button.addEventListener("click", () => openTicketAdminModal(""));
  });
  document.querySelectorAll("[data-open-repair]").forEach((button) => {
    button.addEventListener("click", () => openRepairModal(button.dataset.openRepair || ""));
  });
}

function applyAdminShortcut(shortcut) {
  const shortcuts = {
    "companies-active": {
      view: "admin-companies",
      focus: { type: "companies-active", label: "empresas activas" },
    },
    "companies-expiring": {
      view: "admin-companies",
      focus: { type: "companies-expiring", label: "planes próximos a vencer" },
    },
    "companies-assistances": {
      view: "admin-companies",
      focus: { type: "companies-assistances", label: "consumo mensual de asistencias" },
    },
    "tickets-open": {
      view: "admin-tickets",
      focus: { type: "tickets-open", label: "tickets abiertos" },
    },
    "tickets-urgent": {
      view: "admin-tickets",
      focus: { type: "tickets-urgent", label: "tickets urgentes" },
    },
    "repairs-active": {
      view: "admin-repairs",
      focus: { type: "repairs-active", label: "reparaciones en curso" },
    },
    "users-active": {
      view: "admin-users",
      focus: { type: "users-active", label: "usuarios activos" },
    },
    "sales-opportunities": {
      view: "admin-sales",
      focus: { type: "sales-opportunities", label: "oportunidades comerciales" },
    },
  };
  const next = shortcuts[shortcut];
  if (!next) return;
  state.adminView = next.view;
  state.adminFocus = next.focus;
  saveState();
  render();
}

function createTicket(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const ticketNumber = `TK-2026-${String(state.tickets.length + 21).padStart(4, "0")}`;
  const today = "2026-05-18";
  const ticket = {
    id: uid("t"),
    companyId: state.currentCompanyId,
    equipmentId: form.get("equipmentId"),
    ticketNumber,
    problemType: form.get("problemType"),
    urgency: form.get("urgency"),
    modality: form.get("modality"),
    description: form.get("description"),
    status: "Recibido",
    assignedTechnician: "Pendiente",
    descuentaAsistencia: defaultDiscountsAssistance(form.get("equipmentId")),
    customerComments: form.get("availability") ? [`Horario disponible: ${form.get("availability")}`] : [],
    internalNotes: "",
    createdAt: today,
    updatedAt: today,
  };
  state.tickets.unshift(ticket);
  state.ticketUpdates.push({
    id: uid("u"),
    ticketId: ticket.id,
    status: "Recibido",
    message: "Ticket creado por el cliente.",
    author: "Cliente",
    visibleToClient: true,
    createdAt: today,
  });
  saveState();
  event.target.reset();
  const notice = $("#supportNotice");
  notice.innerHTML = `
    <div>
      <strong>Tu solicitud fue enviada correctamente.</strong>
      <span>Nuestro equipo técnico la revisará a la brevedad. Si querés sumar una captura o foto, podés enviarla por WhatsApp.</span>
    </div>
    <a class="button" href="${whatsappUrl(whatsappTicketMessage(ticket))}" target="_blank" rel="noreferrer">Enviar captura por WhatsApp</a>
  `;
  notice.classList.add("show", "notice-action");
}

function addTicketComment(event) {
  event.preventDefault();
  const ticket = state.tickets.find((item) => item.id === state.selectedTicketId);
  const message = new FormData(event.target).get("message");
  if (!ticket || !message) return;
  state.ticketUpdates.push({
    id: uid("u"),
    ticketId: ticket.id,
    status: ticket.status,
    message,
    author: "Cliente",
    visibleToClient: true,
    createdAt: "2026-05-18",
  });
  ticket.updatedAt = "2026-05-18";
  saveState();
  render();
}

function createPlanUpgradeRequest() {
  const company = getCompany();
  if (!company) return;
  const existing = (state.planRequests || []).find((request) => request.companyId === company.id && request.status === "Pendiente");
  if (existing) {
    const button = document.querySelector("[data-plan-upgrade]");
    if (button) {
      button.textContent = "Solicitud pendiente";
      button.disabled = true;
    }
    return;
  }
  const plan = getPlan(company.planId);
  if (!state.planRequests) state.planRequests = [];
  state.planRequests.unshift({
    id: uid("pr"),
    companyId: company.id,
    currentPlanId: company.planId,
    status: "Pendiente",
    message: `${company.name} solicita revisar o ampliar el plan actual (${plan.name}).`,
    createdAt: "2026-05-19",
  });
  saveState();
  const button = document.querySelector("[data-plan-upgrade]");
  if (button) {
    button.textContent = "Solicitud enviada";
    button.disabled = true;
  }
}

function openPlanCoverageModal(planId) {
  const plan = getPlan(planId);
  openModal(`
    <div class="modal coverage-modal">
      <div class="modal-head">
        <div>
          <h2>Cobertura completa - ${plan.name}</h2>
          <p>Detalle de servicios incluidos, condiciones y alcance del plan.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>Ã—</button>
      </div>
      <div class="coverage-scroll">
        ${planCoverageHtml(plan)}
      </div>
    </div>
  `);
}

function openPlanShareModal(planId) {
  const plan = getPlan(planId);
  const initialText = planShareText(plan, "short");
  openModal(`
    <div class="modal share-modal">
      <div class="modal-head">
        <div>
          <h2>Compartir oferta</h2>
          <p>ElegÃ­ quÃ© versiÃ³n querÃ©s enviar.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>Ã—</button>
      </div>
      <div class="share-options" role="group" aria-label="Version de propuesta">
        <button class="soft-button active" type="button" data-share-version="short">VersiÃ³n corta</button>
        <button class="soft-button" type="button" data-share-version="extended">VersiÃ³n extendida</button>
      </div>
      <textarea class="share-text" id="shareText" readonly>${escapeHtml(initialText)}</textarea>
      <div class="share-feedback" id="shareFeedback" aria-live="polite"></div>
      <div class="toolbar share-actions">
        <button class="soft-button" type="button" data-copy-share>Copiar texto</button>
        <a class="button" id="shareWhatsApp" href="https://wa.me/?text=${encodeURIComponent(initialText)}" target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
      </div>
    </div>
  `);

  const textArea = $("#shareText");
  const whatsApp = $("#shareWhatsApp");
  const feedback = $("#shareFeedback");
  const setVersion = (version) => {
    const text = planShareText(plan, version);
    textArea.value = text;
    whatsApp.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    feedback.textContent = "";
    document.querySelectorAll("[data-share-version]").forEach((button) => {
      button.classList.toggle("active", button.dataset.shareVersion === version);
    });
  };

  document.querySelectorAll("[data-share-version]").forEach((button) => {
    button.addEventListener("click", () => setVersion(button.dataset.shareVersion));
  });

  $("[data-copy-share]")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textArea.value);
    } catch (error) {
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
    }
    feedback.textContent = "Propuesta copiada correctamente";
  });
}

function openModal(html) {
  const dialog = $("#modal");
  dialog.className = "";
  if (html.includes("coverage-modal")) dialog.classList.add("wide-dialog");
  if (html.includes("share-modal")) dialog.classList.add("share-dialog");
  dialog.innerHTML = html;
  dialog.showModal();
  dialog.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => dialog.close()));
}

function openNotificationsModal() {
  const notifications = adminNotifications();
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2>Notificaciones</h2>
          <p>Tickets y solicitudes internas que requieren seguimiento.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <div class="activity-list">
        ${notifications.length ? notifications.map((item) => `
          <button class="notification-row" type="button" data-notification-ticket="${item.id}" data-notification-kind="${item.kind}">
            <span>${badge(item.urgency || item.status)}</span>
            <strong>${item.label}</strong>
            <small>${item.detail}</small>
          </button>
        `).join("") : `<div class="empty-state">No hay notificaciones pendientes.</div>`}
      </div>
    </div>
  `);
  document.querySelectorAll("[data-notification-ticket]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#modal").close();
      state.adminView = button.dataset.notificationKind === "ticket" ? "admin-tickets" : "admin-dashboard";
      state.adminFocus = button.dataset.notificationKind === "ticket" ? { type: "tickets-open", label: "tickets abiertos" } : null;
      saveState();
      render();
      if (button.dataset.notificationKind === "ticket") {
        setTimeout(() => openTicketAdminModal(button.dataset.notificationTicket), 80);
      }
    });
  });
}

function openEquipmentModal(id) {
  if (state.role === "admin" && !canManageEquipment()) {
    alert("Tu usuario puede crear clientes y registrar ventas, pero la carga técnica de equipos queda para administración o técnicos.");
    return;
  }
  const item = state.equipment.find((equipment) => equipment.id === id);
  const companies = state.role === "admin" ? state.companies : [getCompany()];
  if (!item && !companies.length) {
    alert("Primero creá una empresa para poder cargar sus equipos.");
    return;
  }
  openModal(`
    <form class="modal" id="equipmentForm">
      <div class="modal-head">
        <div>
          <h2>${item ? "Editar equipo" : "Agregar equipo"}</h2>
          <p>Datos básicos del activo de la empresa.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <input type="hidden" name="id" value="${item?.id || ""}" />
      <div class="form-grid">
        <div class="field">
          <label>Empresa</label>
          <select name="companyId">${companies.map((company) => `<option value="${company.id}" ${item?.companyId === company.id ? "selected" : ""}>${company.name}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Nombre</label><input name="name" required value="${item?.name || ""}" /></div>
        <div class="field"><label>Tipo de registro</label><select name="recordType">${equipmentRecordTypes.map((type) => `<option value="${type}" ${equipmentRecordType(item || {}) === type ? "selected" : ""}>${type}</option>`).join("")}</select></div>
        <div class="field"><label>Tipo</label><select name="type">${equipmentTypeOptions(equipmentRecordType(item || {}), item?.type)}</select></div>
        <div class="field"><label>Marca</label><input name="brand" value="${item?.brand || ""}" /></div>
        <div class="field"><label>Modelo</label><input name="model" value="${item?.model || ""}" /></div>
        <div class="field"><label>Número de serie</label><input name="serialNumber" value="${item?.serialNumber || ""}" /></div>
        <div class="field"><label>Sector o área</label><input name="userOrSector" value="${item?.userOrSector || ""}" /></div>
        <div class="field"><label>Sistema operativo</label><input name="operatingSystem" value="${item?.operatingSystem || ""}" /></div>
        <div class="field"><label>Estado</label><select name="status">${equipmentStatuses.map((status) => `<option ${item?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
        <div class="field"><label>Último servicio</label><input type="date" name="lastServiceDate" value="${item?.lastServiceDate || "2026-05-18"}" /></div>
        <div class="field"><label>Conexion / driver</label><input name="connectionType" placeholder="USB / WiFi / Ethernet / driver" value="${item?.connectionType || item?.driverRequired || ""}" /></div>
        <div class="field"><label>IP / SSID / cuenta</label><input name="ipAddress" placeholder="IP, SSID o cuenta principal" value="${item?.ipAddress || item?.ssid || item?.mainAccount || ""}" /></div>
        <div class="field"><label>Linea / proveedor</label><input name="assignedLine" placeholder="Linea celular o proveedor de internet" value="${item?.assignedLine || item?.internetProvider || ""}" /></div>
        <div class="field wide"><label>Observaciones</label><textarea name="notes">${item?.notes || ""}</textarea></div>
      </div>
      <div class="toolbar" style="margin: 12px 0 0;">
        <button class="button" type="submit">Guardar equipo</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    </form>
  `);
  $("#equipmentForm [name='recordType']")?.addEventListener("change", (event) => {
    $("#equipmentForm [name='type']").innerHTML = equipmentTypeOptions(event.target.value);
  });
  $("#equipmentForm").addEventListener("submit", saveEquipment);
}

function saveEquipment(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  const existing = state.equipment.find((item) => item.id === form.id);
  const payload = {
    ...form,
    id: form.id || uid("e"),
    type: normalizedEquipmentType(form.type),
    recordType: form.recordType || (primaryEquipmentTypes.includes(normalizedEquipmentType(form.type)) ? "Equipo principal" : "Recurso / Periferico"),
    createdAt: existing?.createdAt || "2026-05-18",
  };
  if (existing) Object.assign(existing, payload);
  else state.equipment.push(payload);
  saveState();
  $("#modal").close();
  render();
}

function showEquipmentHistory(equipmentId) {
  const item = getEquipment(equipmentId);
  const logs = state.serviceLogs.filter((log) => log.equipmentId === equipmentId);
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2>${item?.name || "Equipo"}</h2>
          <p>Historial del equipo.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <div class="service-list">
        ${logs.length ? logs.map((log) => `
          <div class="service-row">
            <strong>${formatDate(log.createdAt)} · ${log.serviceType}</strong>
            <span>${log.description}</span>
            <span>Técnico: ${log.technician}</span>
          </div>
        `).join("") : `<div class="empty-state">Todavía no hay historial para este equipo.</div>`}
      </div>
    </div>
  `);
}

function openCompanyModal(id) {
  const company = state.companies.find((item) => item.id === id);
  const loginUser = company ? getCompanyUser(company.id) : null;
  const defaultPlan = getPlan(company?.planId || "start");
  openModal(`
    <form class="modal" id="companyForm">
      <div class="modal-head">
        <div>
          <h2>${company ? "Editar empresa" : "Nueva empresa"}</h2>
          <p>Datos comerciales y del plan contratado.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <input type="hidden" name="id" value="${company?.id || ""}" />
      <div class="form-grid">
        <div class="field"><label>Nombre empresa</label><input name="name" required value="${company?.name || ""}" /></div>
        <div class="field"><label>CUIT opcional</label><input name="cuit" value="${company?.cuit || ""}" /></div>
        <div class="field"><label>Contacto principal</label><input name="contactName" value="${company?.contactName || ""}" /></div>
        <div class="field"><label>Teléfono</label><input name="phone" value="${company?.phone || ""}" /></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${company?.email || ""}" /></div>
        <div class="field"><label>Dirección</label><input name="address" value="${company?.address || ""}" /></div>
        <div class="field"><label>Plan contratado</label><select name="planId" data-company-plan-select>${state.plans.map((plan) => `<option value="${plan.id}" ${(company?.planId || defaultPlan.id) === plan.id ? "selected" : ""}>${plan.name} · ${plan.price}</option>`).join("")}</select></div>
        <div class="field"><label>Estado de suscripción</label><select name="subscriptionStatus">${subscriptionStatuses.map((status) => `<option ${company?.subscriptionStatus === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
        <div class="field"><label>Fecha de inicio</label><input type="date" name="startDate" value="${company?.startDate || "2026-05-18"}" /></div>
        <div class="field"><label>Fecha de vencimiento</label><input type="date" name="renewalDate" value="${company?.renewalDate || "2026-06-18"}" /></div>
        <div class="field"><label>Asistencias incluidas</label><input type="number" name="includedAssistances" value="${company?.includedAssistances || defaultPlan.includedAssistances}" readonly /></div>
        <div class="field"><label>Asistencias usadas</label><input type="number" name="usedAssistances" value="${company?.usedAssistances || 0}" /></div>
        <div class="field"><label>Visitas a domicilio incluidas</label><input type="number" name="includedOnsiteVisits" value="${company?.includedOnsiteVisits ?? includedOnsiteVisitsFor(defaultPlan)}" readonly /></div>
        <div class="field"><label>Visitas a domicilio usadas</label><input type="number" name="usedOnsiteVisits" value="${company?.usedOnsiteVisits || 0}" /></div>
        <div class="field"><label>Equipos permitidos</label><input type="number" name="maxEquipment" value="${company?.maxEquipment || defaultPlan.maxEquipment}" readonly /></div>
        <div class="field"><label>Login cliente</label><input name="loginEmail" type="email" value="${loginUser?.email || company?.email || ""}" /></div>
        <div class="field"><label>Clave provisoria</label><input name="loginPassword" value="${loginUser?.password || "Cliente2026!"}" /></div>
        <div class="field wide"><label>Notas internas</label><textarea name="notes">${company?.notes || ""}</textarea></div>
      </div>
      <div class="toolbar" style="margin: 12px 0 0;">
        <button class="button" type="submit">Guardar empresa</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    </form>
  `);
  $("[data-company-plan-select]").addEventListener("change", (event) => {
    const selectedPlan = getPlan(event.target.value);
    $("#companyForm [name='includedAssistances']").value = selectedPlan.includedAssistances;
    $("#companyForm [name='includedOnsiteVisits']").value = includedOnsiteVisitsFor(selectedPlan);
    $("#companyForm [name='maxEquipment']").value = selectedPlan.maxEquipment;
  });
  $("#companyForm").addEventListener("submit", saveCompany);
}

function saveCompany(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  const existing = state.companies.find((company) => company.id === form.id);
  const plan = getPlan(form.planId);
  const payload = {
    id: form.id || uid("c"),
    name: form.name,
    cuit: form.cuit,
    contactName: form.contactName,
    phone: form.phone,
    email: form.email,
    address: form.address,
    planId: form.planId,
    subscriptionStatus: form.subscriptionStatus,
    startDate: form.startDate,
    renewalDate: form.renewalDate,
    includedAssistances: Number(plan?.includedAssistances || form.includedAssistances),
    usedAssistances: Number(form.usedAssistances),
    includedOnsiteVisits: Number(plan?.includedOnsiteVisits ?? form.includedOnsiteVisits ?? includedOnsiteVisitsFor(plan)),
    usedOnsiteVisits: Number(form.usedOnsiteVisits || 0),
    maxEquipment: Number(plan?.maxEquipment || form.maxEquipment),
    notes: form.notes,
    createdAt: existing?.createdAt || "2026-05-18",
  };
  if (existing) Object.assign(existing, payload);
  else state.companies.push(payload);
  let loginUser = getCompanyUser(payload.id);
  if (!loginUser) {
    loginUser = {
      id: uid("u"),
      role: "Cliente empresa",
      companyId: payload.id,
      active: true,
      createdAt: "2026-05-18",
    };
    state.users.push(loginUser);
  }
  Object.assign(loginUser, {
    name: form.contactName || form.name,
    email: form.loginEmail || form.email,
    password: form.loginPassword || "Cliente2026!",
    phone: form.phone,
  });
  state.currentCompanyId = payload.id;
  saveState();
  $("#modal").close();
  render();
}

function deleteCompany(companyId) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) return;
  const ok = confirm(`Vas a eliminar ${company.name} y sus equipos, tickets, reparaciones, historial y login cliente. Esta acción no se puede deshacer.`);
  if (!ok) return;
  const ticketIds = state.tickets.filter((ticket) => ticket.companyId === companyId).map((ticket) => ticket.id);
  const repairIds = state.repairs.filter((repair) => repair.companyId === companyId).map((repair) => repair.id);
  state.companies = state.companies.filter((item) => item.id !== companyId);
  state.users = state.users.filter((user) => user.companyId !== companyId);
  state.equipment = state.equipment.filter((item) => item.companyId !== companyId);
  state.tickets = state.tickets.filter((ticket) => ticket.companyId !== companyId);
  state.ticketUpdates = state.ticketUpdates.filter((update) => !ticketIds.includes(update.ticketId));
  state.repairs = state.repairs.filter((repair) => repair.companyId !== companyId);
  state.serviceLogs = state.serviceLogs.filter((log) => log.companyId !== companyId && !ticketIds.includes(log.ticketId) && !repairIds.includes(log.repairId));
  state.planRequests = (state.planRequests || []).filter((request) => request.companyId !== companyId);
  if (state.currentCompanyId === companyId) {
    state.currentCompanyId = state.companies[0]?.id || "";
  }
  saveState();
  render();
}

function openUserModal(id, presetCompanyId = "") {
  const user = state.users.find((item) => item.id === id);
  const companyId = user?.companyId || presetCompanyId || "";
  openModal(`
    <form class="modal" id="userForm">
      <div class="modal-head">
        <div>
          <h2>${user ? "Editar usuario" : "Nuevo usuario"}</h2>
          <p>Acceso para clientes, técnicos, vendedores y asistentes comerciales.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <input type="hidden" name="id" value="${user?.id || ""}" />
      <div class="form-grid">
        <div class="field"><label>Nombre</label><input name="name" required value="${user?.name || ""}" /></div>
        <div class="field"><label>Email de acceso</label><input name="email" type="email" required value="${user?.email || ""}" /></div>
        <div class="field"><label>Clave provisoria</label><input name="password" value="${user?.password || "Temporal2026!"}" /></div>
        <div class="field"><label>Teléfono</label><input name="phone" value="${user?.phone || ""}" /></div>
        <div class="field">
          <label>Rol</label>
          <select name="role">
            ${["Cliente empresa", ...internalRoles].map((role) => `<option ${user?.role === role ? "selected" : ""}>${role}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Empresa asociada</label>
          <select name="companyId">
            <option value="">TecnoStore / interno</option>
            ${state.companies.map((company) => `<option value="${company.id}" ${companyId === company.id ? "selected" : ""}>${company.name}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Estado</label><select name="active"><option value="true" ${user?.active !== false ? "selected" : ""}>Activo</option><option value="false" ${user?.active === false ? "selected" : ""}>Inactivo</option></select></div>
      </div>
      <div class="toolbar" style="margin: 12px 0 0;">
        <button class="button" type="submit">Guardar usuario</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    </form>
  `);
  $("#userForm").addEventListener("submit", saveUser);
}

function saveUser(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  let user = state.users.find((item) => item.id === form.id);
  if (!user) {
    user = {
      id: uid("u"),
      createdAt: "2026-05-18",
    };
    state.users.push(user);
  }
  Object.assign(user, {
    name: form.name,
    email: form.email,
    password: form.password || "Temporal2026!",
    phone: form.phone,
    role: form.role,
    companyId: form.role === "Cliente empresa" ? form.companyId : "",
    active: form.active === "true",
  });
  saveState();
  $("#modal").close();
  render();
}

function openPlanModal(id) {
  const plan = state.plans.find((item) => item.id === id);
  openModal(`
    <form class="modal" id="planForm">
      <div class="modal-head">
        <div>
          <h2>${plan ? "Editar plan" : "Crear plan"}</h2>
          <p>El asistente comercial puede cargar una propuesta y usarla al alta del cliente.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <input type="hidden" name="id" value="${plan?.id || ""}" />
      <div class="form-grid">
        <div class="field"><label>Nombre del plan</label><input name="name" required value="${plan?.name || ""}" /></div>
        <div class="field"><label>Nombre corto</label><input name="shortName" required value="${plan?.shortName || ""}" /></div>
        <div class="field"><label>Precio</label><input name="price" required value="${plan?.price || ""}" /></div>
        <div class="field"><label>Equipos permitidos</label><input type="number" name="maxEquipment" value="${plan?.maxEquipment || 5}" /></div>
        <div class="field"><label>Asistencias incluidas</label><input type="number" name="includedAssistances" value="${plan?.includedAssistances || 5}" /></div>
        <div class="field"><label>Visitas a domicilio incluidas</label><input type="number" name="includedOnsiteVisits" value="${plan?.includedOnsiteVisits ?? includedOnsiteVisitsFor(plan || {})}" /></div>
        <div class="field wide"><label>Descripción</label><textarea name="description">${plan?.description || ""}</textarea></div>
        <div class="field wide"><label>Servicios incluidos</label><textarea name="features" placeholder="Un servicio por línea">${plan?.features?.join("\n") || ""}</textarea></div>
      </div>
      <div class="toolbar" style="margin: 12px 0 0;">
        <button class="button" type="submit">Guardar plan</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    </form>
  `);
  $("#planForm").addEventListener("submit", savePlan);
}

function openSalesImportModal() {
  openModal(`
    <form class="modal" id="salesImportForm">
      <div class="modal-head">
        <div>
          <h2>Cargar zona o listado</h2>
          <p>Pegá una lista simple. Una visita por línea, separando datos con coma o punto y coma.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Zona</label>
          <input name="zoneName" required placeholder="Ej: Zona Centro" />
        </div>
        <div class="field">
          <label>Prioridad para vendedor</label>
          <select name="assignedSellerId">
            <option value="">Abierta para todos</option>
            ${sellerOptions(currentUser()?.role === "Asistente comercial" ? currentUser().id : "")}
          </select>
        </div>
        <div class="field wide">
          <label>Descripción de zona</label>
          <input name="description" placeholder="Ej: comercios sobre Av. Illia y alrededores" />
        </div>
        <div class="field wide">
          <label>Listado</label>
          <textarea name="rows" placeholder="Nombre, dirección, contacto, teléfono, nota&#10;Farmacia Avenida, Av. Illia 420, María, 2664102201, preguntar por mantenimiento&#10;Kiosco Norte, San Martín 1220, Diego, 2664551122, tiene 2 PCs"></textarea>
        </div>
      </div>
      <div class="whatsapp-card" style="margin-top: 12px;">
        <strong>Formato recomendado</strong>
        <span>Podés crear solo la zona y cargar visitas después. Si pegás listado: Nombre, dirección, contacto, teléfono, observación.</span>
      </div>
      <div class="toolbar" style="margin: 14px 0 0;">
        <button class="button" type="submit">Crear visitas</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    </form>
  `);
  $("#salesImportForm").addEventListener("submit", saveSalesImport);
}

function parseSalesRows(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;,]/).map((part) => part.trim());
      return {
        businessName: parts[0] || "Comercio sin nombre",
        address: parts[1] || "Dirección pendiente",
        contactName: parts[2] || "",
        phone: parts[3] || "",
        notes: parts.slice(4).join(", "),
      };
    });
}

function saveSalesImport(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  const existingZone = state.salesZones.find((zone) => zone.name.toLowerCase() === form.zoneName.toLowerCase());
  const zone = existingZone || {
    id: uid("z"),
    name: form.zoneName,
    description: form.description,
    assignedSellerId: form.assignedSellerId,
    createdAt: "2026-05-18",
  };
  if (!existingZone) state.salesZones.push(zone);
  else Object.assign(zone, {
    description: form.description || zone.description,
    assignedSellerId: form.assignedSellerId,
  });
  const visits = parseSalesRows(form.rows || "").map((visit) => ({
    id: uid("v"),
    zoneId: zone.id,
    assignedSellerId: form.assignedSellerId,
    ...visit,
    status: "Pendiente",
    lastUpdate: "2026-05-18",
  }));
  state.salesVisits.push(...visits);
  saveState();
  $("#modal").close();
  state.adminView = "admin-sales";
  render();
}

function updateVisitStatus(id, status) {
  const visit = state.salesVisits.find((item) => item.id === id);
  if (!visit) return;
  visit.status = status;
  if (isSalesUser(currentUser())) {
    visit.updatedBySellerId = currentUser().id;
  }
  visit.lastUpdate = "2026-05-18";
  saveState();
  render();
}

function deleteSalesVisit(id) {
  if (!canDeleteSalesVisits()) {
    alert("Solo el administrador puede eliminar prospectos del listado comercial.");
    return;
  }
  const visit = state.salesVisits.find((item) => item.id === id);
  if (!visit) return;
  const ok = confirm(`Vas a eliminar "${visit.businessName}" del listado comercial. Esta accion no borra ninguna empresa cliente real.`);
  if (!ok) return;
  state.salesVisits = state.salesVisits.filter((item) => item.id !== id);
  saveState();
  render();
}

function savePlan(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  let plan = state.plans.find((item) => item.id === form.id);
  if (!plan) {
    plan = { id: uid("plan") };
    state.plans.push(plan);
  }
  Object.assign(plan, {
    name: form.name,
    shortName: form.shortName,
    price: form.price,
    description: form.description,
    maxEquipment: Number(form.maxEquipment),
    includedAssistances: Number(form.includedAssistances),
    includedOnsiteVisits: Number(form.includedOnsiteVisits || 0),
    features: form.features.split("\n").map((feature) => feature.trim()).filter(Boolean),
  });
  saveState();
  $("#modal").close();
  render();
}

function openTicketAdminModal(id) {
  if (!id && !state.companies.length) {
    alert("Primero creá una empresa para asociar el ticket.");
    return;
  }
  const ticket = state.tickets.find((item) => item.id === id);
  const companyId = ticket?.companyId || state.currentCompanyId;
  const equipmentOptions = equipmentOptionsForCompany(companyId, ticket?.equipmentId || "other", true);
  openModal(`
    <form class="modal" id="adminTicketForm">
      <div class="modal-head">
        <div>
          <h2>${ticket ? "Gestionar ticket" : "Crear ticket"}</h2>
          <p>Cambiar estado, técnico y respuesta al cliente.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <input type="hidden" name="id" value="${ticket?.id || ""}" />
      <div class="form-grid">
        <div class="field"><label>Empresa</label><select name="companyId" data-ticket-company-select>${state.companies.map((company) => `<option value="${company.id}" ${companyId === company.id ? "selected" : ""}>${company.name}</option>`).join("")}</select></div>
        <div class="field"><label>Equipo</label><select name="equipmentId">${equipmentOptions}</select></div>
        <div class="field"><label>Problema</label><input name="problemType" value="${ticket?.problemType || "otro"}" /></div>
        <div class="field"><label>Urgencia</label><select name="urgency">${["baja", "normal", "alta", "crítica"].map((urgency) => `<option ${ticket?.urgency === urgency ? "selected" : ""}>${urgency}</option>`).join("")}</select></div>
        <div class="field"><label>Modalidad</label><select name="modality">${["remoto", "presencial", "indiferente"].map((mode) => `<option ${ticket?.modality === mode ? "selected" : ""}>${mode}</option>`).join("")}</select></div>
        <div class="field"><label>Estado</label><select name="status">${ticketStatuses.map((status) => `<option ${ticket?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
        <div class="field"><label>Técnico asignado</label><select name="assignedTechnician">${technicianOptions(ticket?.assignedTechnician || "")}</select></div>
        <div class="field"><label>Descontar asistencia</label><select name="discount"><option value="no">No</option><option value="yes">Sí</option></select></div>
        <div class="field wide"><label>Descripción</label><textarea name="description">${ticket?.description || ""}</textarea></div>
        <div class="field wide"><label>Respuesta visible al cliente</label><textarea name="response" placeholder="Escribí una actualización para el cliente."></textarea></div>
        <div class="field"><label>Descuenta asistencia</label><select name="descuentaAsistencia"><option value="false" ${ticket?.descuentaAsistencia === false ? "selected" : ""}>No</option><option value="true" ${ticket?.descuentaAsistencia !== false ? "selected" : ""}>Si</option></select></div>
        <div class="field"><label>Descuenta visita a domicilio</label><select name="descuentaVisitaDomicilio"><option value="false" ${!ticket?.descuentaVisitaDomicilio ? "selected" : ""}>No</option><option value="true" ${ticket?.descuentaVisitaDomicilio ? "selected" : ""}>Si</option></select></div>
        <div class="field wide">${ticketScopeNotice(ticket?.equipmentId || "other")}</div>
        <div class="field wide"><label>Observaciones internas</label><textarea name="internalNotes">${ticket?.internalNotes || ""}</textarea></div>
      </div>
      <div class="toolbar" style="margin: 12px 0 0;">
        <button class="button" type="submit">Guardar ticket</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    </form>
  `);
  $("#adminTicketForm [name='discount']")?.closest(".field")?.remove();
  $("[data-ticket-company-select]").addEventListener("change", (event) => {
    $("#adminTicketForm [name='equipmentId']").innerHTML = equipmentOptionsForCompany(event.target.value, "other", true);
  });
  $("#adminTicketForm").addEventListener("submit", saveAdminTicket);
}

function saveAdminTicket(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  let ticket = state.tickets.find((item) => item.id === form.id);
  const today = "2026-05-18";
  const previousDiscount = ticket?.descuentaAsistencia === true;
  const previousOnsiteDiscount = ticket?.descuentaVisitaDomicilio === true;
  if (!ticket) {
    ticket = {
      id: uid("t"),
      ticketNumber: `TK-2026-${String(state.tickets.length + 21).padStart(4, "0")}`,
      customerComments: [],
      createdAt: today,
    };
    state.tickets.unshift(ticket);
  }
  Object.assign(ticket, {
    companyId: form.companyId,
    equipmentId: form.equipmentId,
    problemType: form.problemType,
    urgency: form.urgency,
    modality: form.modality,
    description: form.description,
    status: form.status,
    assignedTechnician: form.assignedTechnician,
    descuentaAsistencia: form.descuentaAsistencia === "true",
    descuentaVisitaDomicilio: form.descuentaVisitaDomicilio === "true",
    internalNotes: form.internalNotes,
    updatedAt: today,
  });
  if (form.response) {
    state.ticketUpdates.push({
      id: uid("u"),
      ticketId: ticket.id,
      status: ticket.status,
      message: form.response,
      author: "TecnoStore",
      visibleToClient: true,
      createdAt: today,
    });
  }
  const nextDiscount = form.descuentaAsistencia === "true";
  const nextOnsiteDiscount = form.descuentaVisitaDomicilio === "true";
  if (nextDiscount !== previousDiscount) {
    const company = getCompany(form.companyId);
    if (company) {
      company.usedAssistances = Math.max(0, Number(company.usedAssistances) + (nextDiscount ? 1 : -1));
    }
  } else if (form.discount === "yes") {
    const company = getCompany(form.companyId);
    if (company) company.usedAssistances = Number(company.usedAssistances) + 1;
  }
  if (nextOnsiteDiscount !== previousOnsiteDiscount) {
    const company = getCompany(form.companyId);
    if (company) {
      company.usedOnsiteVisits = Math.max(0, usedOnsiteVisitsFor(company) + (nextOnsiteDiscount ? 1 : -1));
    }
  }
  saveState();
  $("#modal").close();
  render();
}

function openRepairModal(id) {
  if (!id && !state.companies.length) {
    alert("Primero creá una empresa para asociar la reparación.");
    return;
  }
  const repair = state.repairs.find((item) => item.id === id);
  const repairCompanyId = repair?.companyId || state.currentCompanyId;
  openModal(`
    <form class="modal" id="repairForm">
      <div class="modal-head">
        <div>
          <h2>${repair ? "Gestionar reparación" : "Crear reparación"}</h2>
          <p>Orden, diagnóstico, presupuesto y estado.</p>
        </div>
        <button class="icon-button" type="button" data-close-modal>×</button>
      </div>
      <input type="hidden" name="id" value="${repair?.id || ""}" />
      <div class="form-grid">
        <div class="field"><label>Empresa</label><select name="companyId" data-repair-company-select>${state.companies.map((company) => `<option value="${company.id}" ${repairCompanyId === company.id ? "selected" : ""}>${company.name}</option>`).join("")}</select></div>
        <div class="field"><label>Equipo</label><select name="equipmentId">${equipmentOptionsForCompany(repairCompanyId, repair?.equipmentId || "", false)}</select></div>
        <div class="field"><label>Estado</label><select name="status">${repairStatuses.map((status) => `<option ${repair?.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
        <div class="field"><label>Técnico asignado</label><select name="assignedTechnician">${technicianOptions(repair?.assignedTechnician || "")}</select></div>
        <div class="field"><label>Presupuesto</label><input name="budget" value="${repair?.budget || ""}" /></div>
        <div class="field"><label>Aprobado</label><select name="approved"><option value="false">No</option><option value="true" ${repair?.approved ? "selected" : ""}>Sí</option></select></div>
        <div class="field"><label>Fecha de ingreso</label><input type="date" name="entryDate" value="${repair?.entryDate || "2026-05-18"}" /></div>
        <div class="field"><label>Finalización estimada</label><input type="date" name="estimatedFinishDate" value="${repair?.estimatedFinishDate || "2026-05-25"}" /></div>
        <div class="field wide"><label>Diagnóstico</label><textarea name="diagnosis">${repair?.diagnosis || ""}</textarea></div>
        <div class="field wide"><label>Observaciones</label><textarea name="notes">${repair?.notes || ""}</textarea></div>
      </div>
      <div class="toolbar" style="margin: 12px 0 0;">
        <button class="button" type="submit">Guardar reparación</button>
        <button class="ghost-button" type="button" data-close-modal>Cancelar</button>
      </div>
    </form>
  `);
  $("[data-repair-company-select]").addEventListener("change", (event) => {
    $("#repairForm [name='equipmentId']").innerHTML = equipmentOptionsForCompany(event.target.value, "", false);
  });
  $("#repairForm").addEventListener("submit", saveRepair);
}

function saveRepair(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  let repair = state.repairs.find((item) => item.id === form.id);
  if (!repair) {
    repair = {
      id: uid("r"),
      orderNumber: `OR-2026-${String(state.repairs.length + 43).padStart(4, "0")}`,
      deliveredDate: "",
      createdAt: "2026-05-18",
    };
    state.repairs.unshift(repair);
  }
  Object.assign(repair, {
    companyId: form.companyId,
    equipmentId: form.equipmentId,
    status: form.status,
    diagnosis: form.diagnosis,
    budget: form.budget,
    approved: form.approved === "true",
    assignedTechnician: form.assignedTechnician,
    notes: form.notes,
    entryDate: form.entryDate,
    estimatedFinishDate: form.estimatedFinishDate,
  });
  const equipment = getEquipment(form.equipmentId);
  if (equipment) equipment.status = ["Entregado", "Cancelado"].includes(form.status) ? "Activo" : "En reparación";
  saveState();
  $("#modal").close();
  render();
}

async function init() {
  await loadCloudState();
  isBootstrapping = false;
  if (!state.loggedIn) {
    $("#app").innerHTML = loginTemplate();
    bindLoginEvents();
    return;
  }
  render();
}

window.resetTecnoStoreData = resetAppData;

init();
