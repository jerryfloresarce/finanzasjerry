// Iconos servidos por Phosphor Icons (https://phosphoricons.com), cargado
// como fuente/CSS vía CDN en index.html. Se mantiene la misma función
// icon() de antes para no tocar el resto de las vistas — solo cambia
// cómo se genera el marcado por dentro.

const PH = {
  dashboard: "squares-four",
  movimientos: "arrows-left-right",
  cuentas: "wallet",
  categorias: "tag",
  prestamos: "hand-coins",
  suscripciones: "arrows-clockwise",
  corriente: "credit-card",
  ahorro: "trend-up",
  efectivo: "money",
  otra: "folder-simple",
  fijo: "calendar-check",
  variable: "waveform",
  ocio: "sparkle",
  prestamoDado: "hand-coins",
  bolt: "lightning",
  wifi: "wifi-high",
  droplet: "drop",
  dumbbell: "barbell",
  bank: "bank",
  users: "users-three",
  orb: "robot",
  bike: "bicycle",
  arrowRight: "arrow-right",
  plus: "plus",
  check: "check",
  logout: "sign-out",
  logo: "leaf",
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

export function icon(name, { size = 18, className = "", weight = "thin" } = {}) {
  const phName = PH[name] || "tag";
  return `<i class="icon ph-${weight} ph-${phName} ${className}" style="font-size:${size}px" aria-hidden="true"></i>`;
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
