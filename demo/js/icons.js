// Iconos servidos por Phosphor Icons (https://phosphoricons.com), cargado
// como fuente/CSS vía CDN en index.html. Se mantiene la misma función
// icon() de antes para no tocar el resto de las vistas — solo cambia
// cómo se genera el marcado por dentro.

import { paletaTema } from "./tema.js?v=81";

const PH = {
  dashboard: "squares-four",
  movimientos: "arrows-left-right",
  cuentas: "wallet",
  categorias: "tag",
  prestamos: "hand-coins",
  suscripciones: "arrows-clockwise",
  cuenta: "user-circle",
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
  copy: "copy",
  edit: "pencil-simple",
  trash: "trash",
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

// ---------------------------------------------------------------------
// Icono y color por el NOMBRE de la categoría o la cuenta
// ---------------------------------------------------------------------
//
// Antes todas las categorías del mismo tipo compartían icono: todas las
// "Variable" salían con la misma onda. Eso hace que una lista de doce
// categorías sea doce veces el mismo dibujo, y no se distingue nada de un
// vistazo. Aquí se busca el nombre en esta tabla y se le da a cada una SU
// icono y SU color, que es lo que hace que se reconozcan sin leer.
//
// El orden importa: gana la primera que encaje, así que lo más específico va
// arriba ("gasolina" antes que "coche", "veterinario" antes que "salud").
//
// Si el usuario le ha puesto un emoji a mano, manda el emoji: esto es solo
// para cuando no ha elegido ninguno.
const NOMBRE_ICONOS = [
  // Dinero que entra
  [/n[oó]mina|salario|sueldo|paga\b|ingreso/i, "currency-eur", "verde"],
  [/factura|autón|autonom|freelance|cliente/i, "receipt", "menta"],
  [/inversi|bolsa|acciones|fondo|dividendo|cripto|bitcoin/i, "chart-line-up", "coral"],
  [/ahorro|hucha/i, "piggy-bank", "arena"],

  // Casa
  [/alquiler|hipoteca|piso|vivienda|casa|hogar/i, "house", "rosa"],
  [/luz|electric/i, "lightning", "ambar"],
  [/agua\b/i, "drop", "turquesa"],
  [/gas\b|calefacc|butano/i, "flame", "coral"],
  [/internet|wifi|fibra|digi|router/i, "wifi-high", "coral"],
  [/m[oó]vil|tel[eé]fono|tarifa|linea|línea/i, "device-mobile", "violeta"],
  [/limpieza|hogar|casa/i, "broom", "menta"],

  // Comida
  [/super|compra|mercado|alimenta|comida\s*casa/i, "shopping-cart", "naranja"],
  [/restaurant|comer\s*fuera|cena|almuerzo|men[uú]/i, "fork-knife", "lavanda"],
  [/caf[eé]|desayuno/i, "coffee", "arena"],
  [/bar\b|copas|cerveza|birra|vino/i, "beer-bottle", "ambar"],
  [/pedido|glovo|uber\s*eats|just\s*eat|domicilio/i, "scooter", "coral"],

  // Moverse
  [/gasolina|combustible|carburante|repostar|diesel|gas[oó]leo/i, "gas-pump", "gris"],
  [/taxi|cabify|uber/i, "taxi", "ambar"],
  [/moto\b|motocicl/i, "motorcycle", "gris"],
  [/coche|carro|auto|taller|itv|mec[aá]nic/i, "car", "gris"],
  [/tren|renfe|cercan/i, "train-simple", "coral"],
  [/metro|bus|autob[uú]s|transporte|abono/i, "bus", "coral"],
  [/parking|aparcam|garaje/i, "car-profile", "gris"],
  [/vuelo|avi[oó]n|aeropuerto/i, "airplane-tilt", "azul"],
  [/vacacion|playa|hotel/i, "umbrella-simple", "naranja"],
  [/viaje/i, "suitcase-rolling", "azul"],

  // Cuerpo
  [/gimnasio|gym|deporte|entren|fitness/i, "barbell", "lima"],
  [/dentista|dental/i, "tooth", "turquesa"],
  [/veterinar|mascota|perro|gato/i, "paw-print", "arena"],
  [/salud|m[eé]dic|farmacia|medicin|seguro\s*m[eé]dic/i, "first-aid-kit", "rosa"],
  [/peluquer[ií]a|barber|est[eé]tica|u[nñ]as/i, "scissors", "rosa"],
  [/skincare|cosm[eé]tic|crema/i, "drop-half", "lavanda"],

  // Vida
  [/regalo|cumplea/i, "gift", "arena"],
  [/ropa|moda|zapat|calzado/i, "t-shirt", "indigo"],
  [/educaci|curso|universi|estudio|academia|master|m[aá]ster/i, "graduation-cap", "azul"],
  [/libro|lectura/i, "book-open", "indigo"],
  [/cine|pel[ií]cula/i, "popcorn", "coral"],
  [/m[uú]sica|spotify|concierto/i, "music-notes", "menta"],
  [/juego|videojueg|steam|playstation|xbox|nintendo/i, "game-controller", "violeta"],
  [/netflix|hbo|disney|prime|streaming|entretenim|ocio/i, "film-slate", "violeta"],
  [/seguro/i, "shield-check", "menta"],
  [/impuesto|hacienda|irpf|iva\b/i, "bank", "gris"],
  [/donaci|caridad|ong/i, "hand-heart", "rosa"],
  [/planta|jard[ií]n/i, "plant", "lima"],
  [/beb[eé]|hijo|guarder/i, "baby", "rosa"],
  [/tabaco|cigarr/i, "cigarette", "gris"],
  [/suscripci|cuota/i, "arrows-clockwise", "turquesa"],

  // Dónde está el dinero
  [/efectivo|cash|met[aá]lico/i, "money", "verde"],
  [/tarjeta|cr[eé]dito|visa|mastercard/i, "credit-card", "indigo"],
  [/banco|bbva|santander|caixa|sabadell|ing\b|bankinter|revolut|n26|imagin|trade\s*republic/i, "bank", "azul"],
];

// Busca el icono y el color que le tocan a un nombre. Devuelve null si no
// encaja ninguno, y entonces se usa el icono genérico del tipo de siempre.
export function iconPorNombre(nombre) {
  if (!nombre) return null;
  for (const [patron, ph, color] of NOMBRE_ICONOS) {
    if (patron.test(nombre)) return { ph, color };
  }
  return null;
}

// Phosphor nombra sus grosores con una clase por peso: ph-thin, ph-light,
// ph-bold, ph-fill, ph-duotone... salvo el normal, que NO es "ph-regular"
// sino "ph" a secas. Poner ph-regular no da error: simplemente no pinta
// nada, y se quedan los huecos vacíos.
const clasePeso = (peso) => (peso === "regular" ? "ph" : `ph-${peso}`);

export function icon(name, { size = 18, className = "", weight = "thin", color = null } = {}) {
  const phName = PH[name] || "tag";
  const clases = ["icon", clasePeso(weight), `ph-${phName}`, color ? `icon--${color}` : "", className]
    .filter(Boolean)
    .join(" ");
  return `<i class="${clases}" style="font-size:${size}px" aria-hidden="true"></i>`;
}

// Igual que icon() pero con un nombre de Phosphor directo, sin pasar por la
// tabla PH: lo usa el icono por nombre de categoría, que trae el suyo ya
// resuelto. Peso "regular" y no "thin" porque estos son los iconos que
// identifican cosas y tienen que verse a 18 px de un vistazo.
function iconPh(phName, { size = 18, color = null, weight = "regular" } = {}) {
  const clases = ["icon", clasePeso(weight), `ph-${phName}`, color ? `icon--${color}` : ""].filter(Boolean).join(" ");
  return `<i class="${clases}" style="font-size:${size}px" aria-hidden="true"></i>`;
}

// Cuentas/categorías pueden tener un emoji propio elegido por el usuario
// (campo `icono`); si lo tienen, se muestra en vez del icono genérico del tipo.
export function entityIcon(entity, fallbackName, { size = 18 } = {}) {
  // 1. El emoji que haya elegido a mano manda siempre.
  if (entity?.icono) {
    return `<span class="icon-emoji" style="font-size:${size + 4}px" aria-hidden="true">${entity.icono}</span>`;
  }
  // 2. Si el nombre se reconoce ("Gasolina", "Alquiler", "Gimnasio"), su
  //    icono y su color propios.
  const porNombre = iconPorNombre(entity?.nombre);
  if (porNombre) return iconPh(porNombre.ph, { size, color: porNombre.color });
  // 3. Y si no, el genérico del tipo, como siempre.
  return icon(fallbackName, { size });
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

// La paleta de las iniciales sale del tema activo; la lista de aquí es
// solo el respaldo (el tema Original y por si el CSS aún no ha cargado).
const AVATAR_PALETTE = ["#7a9b81", "#8a9b6e", "#7d8f8a", "#9c8a6f", "#6b8778", "#a8935f"];

export function avatarColor(seed = "") {
  const paleta = paletaTema("--paleta-avatares", AVATAR_PALETTE);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return paleta[hash % paleta.length];
}
