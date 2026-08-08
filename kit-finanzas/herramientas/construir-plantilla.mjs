// Genera kit-finanzas/plantilla-app/ a partir de la app real de este repo.
//
// La plantilla NO se escribe a mano: se saca de la app que está funcionando,
// y se le quitan las cosas que son de Jerry y las que no pueden viajar en
// algo que se reparte. Así, cuando la app mejora, la plantilla se pone al
// día ejecutando esto otra vez, y no hay dos copias que se van separando.
//
//   node kit-finanzas/herramientas/construir-plantilla.mjs
//
// Lo que se queda por el camino, y por qué:
//
//   js/firebase-config.js   son las claves del proyecto de Jerry. En su
//                           lugar va un ejemplo con huecos que rellena el
//                           asistente con las claves de cada persona.
//   js/seed.js              son sus cuentas y sus saldos de verdad. Se
//                           sustituye por un juego de categorías neutro.
//   js/fixes.js             correcciones de un solo uso de sus datos
//                           ("el préstamo de Liz tiene mal la fecha"). No
//                           le sirven a nadie más: se sustituye por una
//                           versión que no hace nada, para no tener que
//                           tocar el Dashboard que la importa.
//   assets/img/*            las fotos de los personajes de anime tienen
//                           dueño y no pueden repartirse. Las variables de
//                           imagen se dejan a "none" y cada uno pone la
//                           suya.
//   SETUP.md                la guía de Jerry, con su clave y su repo. El
//                           kit trae la suya, guiada por el asistente.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const KIT = join(RAIZ, "kit-finanzas");
const DESTINO = join(KIT, "plantilla-app");
const EXTRAS = join(KIT, "extras");

// El nombre de la app en la plantilla. Neutro a propósito: así la plantilla
// se puede abrir tal cual y se entiende, y el asistente lo cambia luego por
// el que elija cada persona.
const NOMBRE_NEUTRO = { app: "Mis Finanzas", marca: "Mis <span>Finanzas</span>", saludo: "Hola" };

const NO_COPIAR = new Set(["firebase-config.js", "seed.js", "fixes.js"]);

// Los avisos de un solo uso que Jerry tenía en el Dashboard para arreglar
// sus propios datos. El de "seed-banner" sí se queda: es el que ofrece
// rellenar las categorías la primera vez, y eso lo necesita todo el mundo.
const BANNERS_A_QUITAR = [
  "fix-banner",
  "reset-prestamos-banner",
  "gastos-fijos-agosto-banner",
  "liz-fecha-banner",
  "plan-pagos-ana-banner",
];

function log(msg) {
  console.log(msg);
}

// ---------------------------------------------------------------- utilidades

// Quita del HTML el <div id="..."> entero, contando las aperturas y cierres
// para no cortar por el <div> equivocado si algún día lleva algo anidado.
function quitarDivPorId(html, id) {
  const inicio = html.indexOf(`<div id="${id}"`);
  if (inicio < 0) return html;
  let i = inicio;
  let profundidad = 0;
  while (i < html.length) {
    const abre = html.indexOf("<div", i);
    const cierra = html.indexOf("</div>", i);
    if (cierra < 0) break;
    if (abre >= 0 && abre < cierra) {
      profundidad++;
      i = abre + 4;
      continue;
    }
    profundidad--;
    i = cierra + 6;
    if (profundidad === 0) break;
  }
  // Se lleva también la indentación de la línea y el salto que deja detrás.
  let desde = inicio;
  while (desde > 0 && (html[desde - 1] === " " || html[desde - 1] === "\t")) desde--;
  let hasta = i;
  while (hasta < html.length && html[hasta] === "\n") hasta++;
  return html.slice(0, desde) + html.slice(hasta);
}

function copiarArbol(desde, hasta, filtro) {
  mkdirSync(hasta, { recursive: true });
  for (const nombre of readdirSync(desde)) {
    const origen = join(desde, nombre);
    const destino = join(hasta, nombre);
    if (statSync(origen).isDirectory()) {
      copiarArbol(origen, destino, filtro);
      continue;
    }
    if (filtro && !filtro(nombre, origen)) continue;
    cpSync(origen, destino);
  }
}

// ---------------------------------------------------------------- construir

if (!existsSync(join(RAIZ, "index.html"))) {
  console.error("No encuentro la app. Ejecuta esto desde el repo de la app.");
  process.exit(1);
}

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });

// 1 · Los archivos que se copian tal cual
copiarArbol(join(RAIZ, "css"), join(DESTINO, "css"));
copiarArbol(join(RAIZ, "js"), join(DESTINO, "js"), (nombre) => !NO_COPIAR.has(nombre));
cpSync(join(RAIZ, "firestore.rules"), join(DESTINO, "firestore.rules"));
log("· copiados css/, js/ y firestore.rules");

// 2 · index.html: nombre neutro y fuera los avisos de un solo uso
let html = readFileSync(join(RAIZ, "index.html"), "utf8");
html = html.replace(/<title>.*?<\/title>/, `<title>${NOMBRE_NEUTRO.app}</title>`);
html = html.replaceAll("Finanzas <span>Jerry</span>", NOMBRE_NEUTRO.marca);
html = html.replace(">Hola, Jerry<", `>${NOMBRE_NEUTRO.saludo}<`);
for (const id of BANNERS_A_QUITAR) {
  const antes = html.length;
  html = quitarDivPorId(html, id);
  if (html.length === antes) console.warn(`  aviso: no encontré el banner ${id}`);
}

// Las paletas de color, que en la app de Jerry no existen: son los temas
// sin temática, para quien no quiera ni One Piece ni Kimetsu. Se enlazan
// DESPUÉS de temas.css para poder pisarlo si hiciera falta.
const versionCss = html.match(/css\/temas\.css\?v=(\d+)/)?.[1] || "1";
html = html.replace(
  /(<link rel="stylesheet" href="css\/temas\.css\?v=\d+" \/>)/,
  `$1\n<link rel="stylesheet" href="css/paletas.css?v=${versionCss}" />`
);
// Y sus identificadores en el guion que pinta el tema en el primer
// fotograma. Sin esto, quien tenga puesta una paleta ve un instante de
// verde al abrir, que es justo lo que ese guion existe para evitar.
const idsPaletas = [...readFileSync(join(EXTRAS, "css", "paletas.css"), "utf8").matchAll(/html\[data-tema="([\w-]+)"\]/g)]
  .map((m) => m[1])
  .filter((v, i, a) => a.indexOf(v) === i);
html = html.replace(
  /(var temasValidos = \[)([^\]]*)(\])/,
  (_, a, lista, c) => a + lista + ", " + idsPaletas.map((x) => `"${x}"`).join(", ") + c
);

writeFileSync(join(DESTINO, "index.html"), html);
log(`· index.html: nombre neutro, ${BANNERS_A_QUITAR.length} avisos de un solo uso fuera y ${idsPaletas.length} paletas enlazadas`);

// 3 · Las imágenes: se van y las variables quedan en "none"
const AVISO_IMAGEN = (que) =>
  `/* Sin imagen de serie: las fotos no viajan en la plantilla. Para poner\n     la tuya, deja el archivo en assets/img/ y cambia esta línea por\n     url("../assets/img/tu-foto.jpg"). ${que} */\n  `;

let estilos = readFileSync(join(DESTINO, "css", "styles.css"), "utf8");
estilos = estilos.replace(
  /--login-imagen: url\("[^"]*"\);/,
  AVISO_IMAGEN("Es el fondo de la pantalla de acceso.") + "--login-imagen: none;"
);
writeFileSync(join(DESTINO, "css", "styles.css"), estilos);

let temas = readFileSync(join(DESTINO, "css", "temas.css"), "utf8");
const imagenesQuitadas = (temas.match(/--hero-imagen: url\("[^"]*"\);/g) || []).length;
temas = temas.replace(
  /--hero-imagen: url\("[^"]*"\);/g,
  AVISO_IMAGEN("Es la foto de la tarjeta de arriba del Dashboard.") + "--hero-imagen: none;"
);
writeFileSync(join(DESTINO, "css", "temas.css"), temas);
log(`· imágenes fuera: 1 de acceso + ${imagenesQuitadas} de los temas`);

// 4 · Lo que sustituye a lo que no viaja
copiarArbol(EXTRAS, DESTINO);

// Los extras se escriben a mano y sus imports llevan un ?v=NN que se queda
// viejo en cuanto la app sube de versión. Se pone al día con la que use la
// app ahora mismo, para que no haya que acordarse de tocarlos.
const version = html.match(/js\/app\.js\?v=(\d+)/)?.[1];
if (!version) {
  console.error("No encuentro la versión de js/app.js en index.html.");
  process.exit(1);
}
function ponerVersion(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      ponerVersion(ruta);
      continue;
    }
    if (!nombre.endsWith(".js")) continue;
    const antes = readFileSync(ruta, "utf8");
    const despues = antes.replace(/(from\s+"\.[^"]+?\.js)\?v=\d+"/g, `$1?v=${version}"`);
    if (antes !== despues) writeFileSync(ruta, despues);
  }
}
ponerVersion(join(DESTINO, "js"));

// El nombre de la app está repartido por comentarios y cabeceras de medio
// repo. Se cambia en bloque por el neutro, y lo que se escape lo caza la
// comprobación de más abajo.
const RENOMBRES = [
  [/FINANZAS JERRY/g, NOMBRE_NEUTRO.app.toUpperCase()],
  [/Finanzas Jerry/g, NOMBRE_NEUTRO.app],
  [/finanzas-jerry/g, "mis-finanzas"],
];
function renombrar(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      renombrar(ruta);
      continue;
    }
    if (!/\.(js|html|css|md|rules|json)$/.test(nombre)) continue;
    const antes = readFileSync(ruta, "utf8");
    let despues = antes;
    for (const [de, a] of RENOMBRES) despues = despues.replace(de, a);
    if (antes !== despues) writeFileSync(ruta, despues);
  }
}
renombrar(DESTINO);

// Las paletas también tienen que estar en el catálogo de js/tema.js, que es
// de donde el selector saca la lista. Enlazar el CSS no basta: sin esto los
// colores existen pero no hay forma de elegirlos.
{
  const ruta = join(DESTINO, "js", "tema.js");
  let tema = readFileSync(ruta, "utf8");
  const nombres = Object.fromEntries(
    [...readFileSync(join(EXTRAS, "css", "paletas.css"), "utf8").matchAll(/\/\* (.+?) \*\/\nhtml\[data-tema="([\w-]+)"\]/g)]
      .map((m) => [m[2], m[1]])
  );
  const entradas = Object.entries(nombres)
    .map(([id, nombre]) => `  {\n    id: "${id}",\n    nombre: "${nombre}",\n    grupo: "Colores",\n  },`)
    .join("\n");
  tema = tema.replace(/(\n\];\n\nexport const TEMA_POR_DEFECTO)/, `\n${entradas}$1`);
  writeFileSync(ruta, tema);
  log(`· js/tema.js: ${Object.keys(nombres).length} paletas añadidas al selector`);
}
log(`· añadidos el ejemplo de configuración, el arranque de datos y el modo demostración (versión ${version})`);

// 5 · demo.html: la misma app, pero con los Firebase de mentira.
//
// Un "importmap" es una tabla que le dice al navegador "cuando alguien pida
// esta dirección, dale esta otra". Con eso, los import de Firebase que hay
// repartidos por la app apuntan a js/demo/ sin tocar ni una línea de código:
// la app no sabe que está en una demostración.
const importmap = `<script type="importmap">
{
  "imports": {
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js": "./js/demo/app-falso.js?v=${version}",
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js": "./js/demo/auth-falso.js?v=${version}",
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js": "./js/demo/firestore-falso.js?v=${version}"
  }
}
</script>
`;
// El importmap tiene que ir ANTES de cualquier <script type="module">, o el
// navegador lo ignora sin decir nada y la demostración intenta hablar con
// Firebase de verdad.
let demo = html.replace("<title>", importmap + "<title>");
demo = demo.replace(/<title>.*?<\/title>/, `<title>${NOMBRE_NEUTRO.app} · demostración</title>`);

// La visita guiada solo existe aquí, no en la app de verdad: es lo que
// hace de "vídeo" de lo que vas a tener. El guion va al final del body,
// después de que la app se haya montado.
demo = demo.replace(
  "</head>",
  `<link rel="stylesheet" href="css/visita.css?v=${version}" />\n</head>`
);
demo = demo.replace(
  "</body>",
  `<script type="module">
  import { montarBotonDeVisita } from "./js/demo/visita.js?v=${version}";
  montarBotonDeVisita();
</script>
</body>`
);

writeFileSync(join(DESTINO, "demo.html"), demo);
log("· demo.html: la app con datos de mentira y la visita guiada");

// 5 · Comprobaciones: la plantilla tiene que quedar sin rastro personal
const problemas = [];
function revisar(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      revisar(ruta);
      continue;
    }
    if (!/\.(js|html|css|md|rules|json)$/.test(nombre)) continue;
    const texto = readFileSync(ruta, "utf8");
    const rel = ruta.slice(DESTINO.length + 1);
    const controles = [
      [/jerry/i, "el nombre de Jerry"],
      [/AIzaSy[\w-]{20,}/, "una clave de Firebase de verdad"],
      [/arce\.jerry54/, "un correo personal"],
    ];
    // Y que ninguna variable de imagen apunte de verdad a un archivo. Los
    // comentarios y el LEEME sí enseñan un ejemplo de cómo se escribe, y eso
    // no cuenta: lo que se busca es una declaración viva.
    if (!nombre.endsWith(".md")) {
      controles.push([/--[\w-]*imagen[\w-]*:\s*url\(/, "una imagen que no viaja"]);
    }
    for (const [patron, queEs] of controles) {
      if (patron.test(texto)) problemas.push(`${rel}: ${queEs}`);
    }
  }
}
revisar(DESTINO);

// La comprobación que de verdad importa: que no haya viajado ninguna foto.
const imagenes = readdirSync(join(DESTINO, "assets", "img")).filter((n) => !n.endsWith(".md"));
if (imagenes.length) problemas.push(`assets/img/ lleva archivos que no deberían estar: ${imagenes.join(", ")}`);

if (problemas.length) {
  console.error("\nLa plantilla tiene rastros que no deberían viajar:");
  problemas.forEach((p) => console.error("  ✗ " + p));
  process.exit(1);
}

// 6 · Y tiene que estar completa: si falta un archivo que alguien importa,
//     la app se rompe al abrirla, y eso no se ve mirando el árbol.
const faltan = [];
function revisarImports(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      revisarImports(ruta);
      continue;
    }
    if (!nombre.endsWith(".js")) continue;
    const texto = readFileSync(ruta, "utf8");
    for (const m of texto.matchAll(/from\s+"(\.[^"]+?\.js)(\?v=\d+)?"/g)) {
      const destino = join(dirname(ruta), m[1]);
      if (!existsSync(destino)) faltan.push(`${ruta.slice(DESTINO.length + 1)} pide ${m[1]}`);
    }
  }
}
revisarImports(join(DESTINO, "js"));

if (faltan.length) {
  console.error("\nHay imports que apuntan a archivos que no existen:");
  faltan.forEach((f) => console.error("  ✗ " + f));
  process.exit(1);
}

log("\n✓ plantilla-app/ construida y comprobada: sin datos personales, sin imágenes con dueño y sin imports rotos");
