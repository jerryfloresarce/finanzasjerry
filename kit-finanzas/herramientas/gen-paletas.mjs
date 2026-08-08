// Genera las paletas de color de la plantilla (extras/css/paletas.css).
//
//   node herramientas/gen-paletas.mjs                 las de serie
//   node herramientas/gen-paletas.mjs "#c2185b" rosa "Rosa"   una a medida
//
// Un tema de la app son unas cuarenta variables de color que tienen que
// encajar entre ellas: si se eligen a mano, casi siempre sale algo con el
// texto que no se lee o con dos verdes distintos que pelean. Aquí se
// calculan todas a partir de UN color, en HSL, con las mismas relaciones
// que ya funcionan en los temas que trae la app.
//
// La segunda razón de que esto exista: cuando alguien diga "quiero mi app
// en tonos lavanda", no hay que inventar cuarenta colores a ojo. Se le pasa
// su color y sale un tema entero, coherente y con el contraste comprobado.

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- color

const hex = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");

function hslAHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + hex((r + m) * 255) + hex((g + m) * 255) + hex((b + m) * 255);
}

function hexAHsl(cadena) {
  const t = cadena.replace("#", "");
  const r = parseInt(t.slice(0, 2), 16) / 255;
  const g = parseInt(t.slice(2, 4), 16) / 255;
  const b = parseInt(t.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

// Luminancia relativa y contraste, tal como los define la norma de
// accesibilidad. Se usa para COMPROBAR lo que sale, no para decorar: un
// tema bonito con el texto a 2:1 no lo puede leer nadie a pleno sol.
function luminancia(cadena) {
  const t = cadena.replace("#", "");
  const canal = (i) => {
    const v = parseInt(t.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const conAlfa = (cadena, alfa) => {
  const t = cadena.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
};

// ---------------------------------------------------------------- tema

// A partir del color de acento salen las demás. Los fondos son casi negros
// con una pizca del tono del acento: es lo que hace que un tema se sienta
// "de un color" sin que la pantalla se vuelva de ese color, que es el error
// clásico y lo que hace que una app parezca un juguete.
export function construirTema({ id, nombre, acento, tonoFondo, apoyo }) {
  const [h, s] = hexAHsl(acento);
  const hFondo = tonoFondo ?? h;
  // Los fondos llevan poca saturación a propósito: mucha, y las tarjetas
  // se tiñen tanto que el texto gris deja de leerse.
  const satFondo = Math.min(s * 0.35, 22);
  const hApoyo = apoyo ?? (h + 150) % 360;

  const t = {
    "--bg": hslAHex(hFondo, satFondo, 4),
    "--bg-elevated": hslAHex(hFondo, satFondo, 6.5),
    "--surface": hslAHex(hFondo, satFondo, 8.5),
    "--surface-hover": hslAHex(hFondo, satFondo, 12),
    "--border": conAlfa(hslAHex(hFondo, 20, 92), 0.1),
    "--border-strong": conAlfa(hslAHex(hFondo, 20, 92), 0.19),

    "--text-primary": hslAHex(hFondo, 14, 95),
    "--text-secondary": hslAHex(hFondo, 12, 72),
    "--text-muted": hslAHex(hFondo, 10, 50),

    "--accent": acento,
    "--accent-dim": hslAHex(h, s, Math.max(hexAHsl(acento)[2] - 18, 18)),
    "--accent-soft": conAlfa(acento, 0.14),
    "--accent-soft-strong": conAlfa(acento, 0.26),

    "--success": hslAHex(hApoyo, Math.min(s, 55), 52),
    "--danger": hslAHex(4, 62, 55),
    "--danger-soft": conAlfa(hslAHex(4, 62, 55), 0.16),
    "--warning": hslAHex(38, 72, 58),
    "--warning-soft": conAlfa(hslAHex(38, 72, 58), 0.16),

    // El texto que va ENCIMA del acento: negro o blanco, el que se lea
    // mejor sobre ese color concreto. Fijar uno de los dos siempre es lo
    // que deja botones ilegibles con los acentos claros.
    "--on-accent": contraste(acento, "#12100f") > contraste(acento, "#ffffff") ? "#12100f" : "#ffffff",
    "--on-accent-dim": "#ffffff",
    "--on-danger": "#ffffff",

    "--atm-luz-1": conAlfa(acento, 0.16),
    "--atm-luz-2": conAlfa(hslAHex(hApoyo, s, 55), 0.13),
    "--atm-luz-3": conAlfa(hslAHex(hFondo, 40, 12), 0.34),
    "--atm-base-1": hslAHex(hFondo, satFondo, 9),
    "--atm-base-2": hslAHex(hFondo, satFondo, 5),
    "--atm-base-3": hslAHex(hFondo, satFondo, 2.5),
    "--atm-lluvia": conAlfa(hslAHex(hFondo, 25, 88), 0.07),

    "--chart-rejilla": conAlfa(hslAHex(hFondo, 20, 92), 0.07),
    "--chart-eje": hslAHex(hFondo, 10, 50),
    "--chart-leyenda": hslAHex(hFondo, 12, 72),
    "--chart-borde": hslAHex(hFondo, satFondo, 8.5),
  };

  // Las paletas de los gráficos: variaciones del acento y de su apoyo,
  // separadas en tono para que dos porciones seguidas no se confundan.
  const rueda = (base, cuantos, paso) =>
    Array.from({ length: cuantos }, (_, i) => hslAHex(base + i * paso, Math.max(s - i * 4, 30), 62 - (i % 3) * 9));

  t["--paleta-gastos"] = rueda(4, 6, 12).join(", ");
  t["--paleta-ingresos"] = rueda(hApoyo, 6, 10).join(", ");
  t["--paleta-categorias"] = [...rueda(h, 4, 26), ...rueda(hApoyo, 4, 26)].join(", ");
  t["--paleta-avatares"] = rueda(h, 6, 40).join(", ");

  return { id, nombre, variables: t };
}

// ---------------------------------------------------------------- de serie

export const PALETAS = [
  { id: "rosa", nombre: "Rosa", acento: "#f06a9b", tonoFondo: 340, apoyo: 175 },
  { id: "lavanda", nombre: "Lavanda", acento: "#a78bfa", tonoFondo: 258, apoyo: 190 },
  { id: "menta", nombre: "Menta", acento: "#4fd6b0", tonoFondo: 168, apoyo: 210 },
  { id: "oceano", nombre: "Océano", acento: "#4aa8f0", tonoFondo: 208, apoyo: 168 },
  { id: "arena", nombre: "Arena", acento: "#e0a869", tonoFondo: 32, apoyo: 165 },
  { id: "cereza", nombre: "Cereza", acento: "#e8556d", tonoFondo: 352, apoyo: 185 },
  { id: "bosque", nombre: "Bosque", acento: "#7cc46a", tonoFondo: 110, apoyo: 40 },
  { id: "noche", nombre: "Noche", acento: "#8fa4d8", tonoFondo: 225, apoyo: 275 },
];

function aCss(tema) {
  const lineas = Object.entries(tema.variables).map(([k, v]) => `  ${k}: ${v};`);
  return `/* ${tema.nombre} */\nhtml[data-tema="${tema.id}"] {\n${lineas.join("\n")}\n}`;
}

// La muestra que sale en el selector: un círculo con el color del tema.
function aMuestra(tema) {
  return `.tema-btn[data-tema-id="${tema.id}"] .tema-btn__muestra {
  --muestra-fondo: ${tema.variables["--bg"]};
  --muestra-acento: ${tema.variables["--accent"]};
  --muestra-marca: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%229%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E");
}`;
}

// ------------------------------------------------------------ comprobar

// Lo que se mira: que el texto se lea sobre el fondo y sobre las tarjetas,
// y que lo que va encima de un botón de acento se lea también. Por debajo
// de 4.5 la norma dice que el texto normal ya no cumple.
export function comprobarTema(tema) {
  const v = tema.variables;
  const pruebas = [
    ["texto principal sobre el fondo", v["--text-primary"], v["--bg"], 7],
    ["texto principal sobre las tarjetas", v["--text-primary"], v["--surface"], 7],
    ["texto secundario sobre las tarjetas", v["--text-secondary"], v["--surface"], 4.5],
    ["texto apagado sobre las tarjetas", v["--text-muted"], v["--surface"], 3],
    ["texto encima de un botón de acento", v["--on-accent"], v["--accent"], 4.5],
    ["el acento sobre las tarjetas", v["--accent"], v["--surface"], 3],
  ];
  return pruebas.map(([que, a, b, minimo]) => {
    const r = Math.round(contraste(a, b) * 10) / 10;
    return { que, contraste: r, minimo, pasa: r >= minimo };
  });
}

// ---------------------------------------------------------------- salida

const [colorArg, idArg, nombreArg] = process.argv.slice(2);
const temas = colorArg
  ? [construirTema({ id: idArg || "mio", nombre: nombreArg || "El mío", acento: colorArg })]
  : PALETAS.map(construirTema);

let fallos = 0;
for (const tema of temas) {
  const resultados = comprobarTema(tema);
  const malos = resultados.filter((r) => !r.pasa);
  console.log(`${malos.length ? "✗" : "✓"} ${tema.nombre.padEnd(10)} acento ${tema.variables["--accent"]}  texto sobre ${tema.variables["--on-accent"]}`);
  malos.forEach((m) => {
    fallos++;
    console.log(`    ✗ ${m.que}: ${m.contraste}:1, hace falta ${m.minimo}:1`);
  });
}

const css = `/* =========================================================
   PALETAS DE COLOR
   =========================================================
   Temas de color sin ninguna temática: solo colores que combinan.
   Están CALCULADOS a partir de un color de acento (ver
   herramientas/gen-paletas.mjs), no elegidos a mano uno por uno, y cada
   uno pasa una comprobación de contraste antes de entrar aquí — que el
   texto se lea sobre el fondo, sobre las tarjetas y encima de los botones.

   Para inventar uno nuevo con TU color:
     node herramientas/gen-paletas.mjs "#tucolor" miid "Mi nombre"
   ========================================================= */

${temas.map(aCss).join("\n\n")}

/* Las muestras del selector */
${temas.map(aMuestra).join("\n")}
`;

if (!colorArg) {
  writeFileSync(new URL("../extras/css/paletas.css", import.meta.url), css);
  console.log("\n✓ extras/css/paletas.css escrito con " + temas.length + " paletas");
} else {
  console.log("\n--- pega esto en css/paletas.css de la app ---\n");
  console.log(css);
}

if (fallos) {
  console.error(`\n${fallos} comprobación(es) de contraste sin pasar. Ese tema no se puede usar tal cual.`);
  process.exit(1);
}
