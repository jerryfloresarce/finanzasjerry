// Set de iconos propio, en SVG inline — sin depender de ninguna librería
// externa. Trazo fino, minimalista, coherente con la estética del resto.

const PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  movimientos: '<path d="M3 7h14M17 7l-3.5-3.5M17 7l-3.5 3.5"/><path d="M21 17H7M7 17l3.5-3.5M7 17l3.5 3.5"/>',
  cuentas: '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10.5h19"/><circle cx="16.5" cy="14.5" r="1"/>',
  categorias: '<path d="M12.5 3H5a2 2 0 0 0-2 2v7.5a2 2 0 0 0 .6 1.4l8.5 8.5a2 2 0 0 0 2.8 0l6.5-6.5a2 2 0 0 0 0-2.8l-8.5-8.5a2 2 0 0 0-.4-.1z"/><circle cx="8" cy="8" r="1.3"/>',
  prestamos: '<path d="M7 17 17 7M9 7h8v8"/>',
  suscripciones: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  corriente: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>',
  ahorro: '<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>',
  efectivo: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
  otra: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  fijo: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  variable: '<path d="M3 12h3l2-6 4 12 3-9 2 3h4"/>',
  ocio: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  prestamoDado: '<path d="M7 17 17 7M9 7h8v8"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  wifi: '<path d="M2 8.5a16 16 0 0 1 20 0"/><path d="M5 12a11 11 0 0 1 14 0"/><path d="M8.5 15.5a6 6 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
  droplet: '<path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z"/>',
  dumbbell: '<path d="M4 9v6M20 9v6M2 12h2M20 12h2M7 7v10M17 7v10M7 12h10"/>',
  bank: '<path d="M3 21h18M4 21V10M20 21V10M2 10l10-6 10 6M8 21v-7M12 21v-7M16 21v-7"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17.5" cy="9" r="2.3"/><path d="M15.8 14.2c2.6.5 4.2 2.6 4.2 5.8"/>',
  orb: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.4"/>',
  bike: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h4l3 5M10 9h3M14.5 9.5l2.7 7.5"/>',
  arrowRight: '<path d="M4 12h14M12 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
};

// tipo de categoría → icono
const CATEGORIA_TIPO_ICON = {
  Fijo: "fijo",
  Variable: "variable",
  Ocio: "ocio",
  PrestamoDado: "prestamoDado",
};

// tipo de cuenta → icono
const CUENTA_TIPO_ICON = {
  Corriente: "corriente",
  Ahorro: "ahorro",
  Efectivo: "efectivo",
  Otra: "otra",
};

// palabras clave en el nombre de una suscripción → icono
const SUSCRIPCION_KEYWORDS = [
  [/luz|electric/i, "bolt"],
  [/digi|wifi|internet|fibra/i, "wifi"],
  [/agua|aqua/i, "droplet"],
  [/gym|gimnasio/i, "dumbbell"],
  [/bankinter|banco|préstamo|prestamo/i, "bank"],
  [/pasanaco/i, "users"],
  [/claude|ia|ai\b/i, "orb"],
  [/glovo|delivery|uber|domicilio/i, "bike"],
];

export function icon(name, { size = 18, className = "" } = {}) {
  const body = PATHS[name] || PATHS.categorias;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function iconForCategoriaTipo(tipo) {
  return CATEGORIA_TIPO_ICON[tipo] || "categorias";
}

export function iconForCuentaTipo(tipo) {
  return CUENTA_TIPO_ICON[tipo] || "otra";
}

export function iconForSuscripcion(nombre = "") {
  const match = SUSCRIPCION_KEYWORDS.find(([re]) => re.test(nombre));
  return match ? match[1] : "suscripciones";
}

export function initials(nombre = "") {
  const clean = nombre.replace(/[()]/g, "").trim();
  const parts = clean.split(/\s+/).filter((w) => /[a-zA-Z0-9À-ÿ]/.test(w));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_PALETTE = ["#7a9b81", "#8a9b6e", "#7d8f8a", "#9c8a6f", "#6b8778", "#a8935f"];

export function avatarColor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
