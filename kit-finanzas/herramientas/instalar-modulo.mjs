// Añade (o quita) un módulo a la app de alguien.
//
//   node herramientas/instalar-modulo.mjs rutina        instala
//   node herramientas/instalar-modulo.mjs rutina quitar  desinstala
//
// Un módulo es una sección nueva de la app —la rutina diaria, el ciclo
// menstrual, lo que sea— y vive entero en modulos/<nombre>/. Para que
// aparezca hay que tocar SEIS sitios distintos: el menú de escritorio, el
// del móvil, el hueco de la vista, el router, la lista de datos que escucha
// la app y las reglas de la base de datos. Hacerlo a mano seis veces es
// justo la clase de cosa que sale mal una de cada tres, así que lo hace
// esto, y comprueba el resultado.
//
// Todo lo que se añade queda marcado con un comentario del tipo
// "modulo:rutina", que es lo que permite quitarlo después sin dejar restos.

import { readFileSync, writeFileSync, existsSync, cpSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const KIT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const APP = join(KIT, "mi-app");

const nombre = process.argv[2];
const quitar = process.argv[3] === "quitar";

if (!nombre) {
  console.error("Falta el nombre del módulo. Ejemplo: node herramientas/instalar-modulo.mjs rutina");
  process.exit(1);
}

const DIR = join(KIT, "modulos", nombre);
if (!existsSync(DIR)) {
  console.error(`No existe modulos/${nombre}/.`);
  process.exit(1);
}
if (!existsSync(join(APP, "index.html"))) {
  console.error("No hay ninguna app en mi-app/. Móntala antes de añadirle módulos.");
  process.exit(1);
}

const mod = JSON.parse(readFileSync(join(DIR, "modulo.json"), "utf8"));
const MARCA = `modulo:${nombre}`;

const leer = (p) => readFileSync(join(APP, p), "utf8");
const escribir = (p, t) => {
  mkdirSync(dirname(join(APP, p)), { recursive: true });
  writeFileSync(join(APP, p), t);
};

// La versión de cache-busting que usa la app ahora mismo. Los archivos del
// módulo la llevan como [[V]] y se sustituye al instalar.
const version = leer("index.html").match(/js\/app\.js\?v=(\d+)/)?.[1] || "1";

// ---------------------------------------------------------------- quitar

// Cada trozo insertado va entre una marca de apertura y otra de cierre, así
// que quitarlo es recortar entre las dos. Sin marcas habría que adivinar
// dónde empieza y dónde acaba, y eso deja restos.
function quitarBloques(texto) {
  const abre = new RegExp(`[ \\t]*(?://|<!--|/\\*)\\s*${MARCA}:inicio\\s*(?:-->|\\*/)?\\n`);
  const cierra = new RegExp(`[ \\t]*(?://|<!--|/\\*)\\s*${MARCA}:fin\\s*(?:-->|\\*/)?\\n`);
  let salida = texto;
  for (;;) {
    const i = salida.search(abre);
    if (i < 0) break;
    const resto = salida.slice(i);
    const j = resto.search(cierra);
    if (j < 0) break;
    const finLinea = resto.slice(j).indexOf("\n") + j + 1;
    salida = salida.slice(0, i) + resto.slice(finLinea);
  }
  // Solo se normaliza el final del archivo. Colapsar líneas en blanco por
  // todas partes tocaría sitios que no tienen nada que ver con el módulo, y
  // el archivo dejaría de volver a su estado original al desinstalar.
  return salida.replace(/\n+$/, "\n");
}

if (quitar) {
  for (const archivo of ["index.html", "demo.html", "js/app.js", "js/db.js", "js/store.js", "firestore.rules", "css/styles.css"]) {
    if (!existsSync(join(APP, archivo))) continue;
    escribir(archivo, quitarBloques(leer(archivo)));
  }
  rmSync(join(APP, "js", "views", `${nombre}.js`), { force: true });
  console.log(`✓ módulo "${nombre}" quitado. Los datos que hubiera en la base de datos siguen ahí:`);
  console.log(`  si quieres borrarlos, hay que hacerlo desde la consola de Firebase.`);
  process.exit(0);
}

// ---------------------------------------------------------------- instalar

if (leer("index.html").includes(MARCA)) {
  console.log(`El módulo "${nombre}" ya estaba instalado. No se toca nada.`);
  process.exit(0);
}

const conVersion = (t) => t.replaceAll("[[V]]", version);
const envolver = (contenido, tipo) => {
  const [a, c] = tipo === "html" ? [`<!-- ${MARCA}:inicio -->`, `<!-- ${MARCA}:fin -->`] : [`// ${MARCA}:inicio`, `// ${MARCA}:fin`];
  return `${a}\n${contenido}\n${c}\n`;
};

// Sangra solo las líneas que tienen algo. Sangrar también la línea vacía
// del final deja espacios sueltos que sobreviven al desinstalar y se van
// sumando a la sangría de la línea siguiente cada vez que se instala.
const sangrar = (texto, espacios) => texto.replace(/^(?!\s*$)/gm, espacios);

function insertarAntes(texto, ancla, bloque, dondeFalla) {
  const i = texto.indexOf(ancla);
  if (i < 0) throw new Error(`No encuentro dónde insertar en ${dondeFalla}: falta "${ancla.slice(0, 40)}"`);
  return texto.slice(0, i) + bloque + texto.slice(i);
}

// 1 · La vista
escribir(`js/views/${nombre}.js`, conVersion(readFileSync(join(DIR, "vista.js"), "utf8")));

// 2 · Los dos menús y el hueco de la sección.
//
// Se parchean index.html Y demo.html. demo.html es una copia aparte de la
// app (la misma página, pero con los Firebase de mentira), así que si solo
// se toca index.html el módulo funciona en la app de verdad y no aparece en
// la demostración — que es justo donde la gente lo va a mirar primero.
const enlace = conVersion(readFileSync(join(DIR, "nav.html"), "utf8")).trimEnd();
const seccion = conVersion(readFileSync(join(DIR, "vista.html"), "utf8")).trimEnd();

const PAGINAS = ["index.html", "demo.html"].filter((p) => existsSync(join(APP, p)));

for (const pagina of PAGINAS) {
  let html = leer(pagina);
  // El menú de escritorio y el del móvil son dos listas distintas y las dos
  // tienen que llevar el enlace, o la sección existe pero no se puede llegar
  // a ella desde uno de los dos.
  html = insertarAntes(html, `      </div>\n    </nav>`, sangrar(envolver(sangrar(enlace, "  "), "html"), "      "), `el menú de escritorio (${pagina})`);
  html = insertarAntes(html, `    </div>\n    <button id="mobile-logout-btn"`, sangrar(envolver(enlace, "html"), "      "), `el menú del móvil (${pagina})`);
  html = insertarAntes(html, `  </main>`, sangrar(envolver(seccion, "html"), "    "), `el hueco de la sección (${pagina})`);
  escribir(pagina, html);
}

// 3 · app.js: el import, la ruta y el montaje
let app = leer("js/app.js");
app = insertarAntes(
  app,
  `import { mountCuentaPanel }`,
  envolver(`import { mount${mod.Vista}, render${mod.Vista} } from "./views/${nombre}.js?v=${version}";`),
  "los imports de app.js"
);
app = insertarAntes(app, `};\n\nconst DEFAULT_ROUTE`, envolver(`  ${nombre}: render${mod.Vista},`), "la lista de rutas");
app = insertarAntes(app, `    mountCuentaPanel();`, envolver(`    mount${mod.Vista}();`), "el montaje de las vistas");
escribir("js/app.js", app);

// 4 · db.js: las funciones para leer y escribir su colección
let db = leer("js/db.js");
const lineasDb = mod.colecciones
  .map((c) => {
    const N = c.Nombre;
    const orden = c.ordenarPor ? `"${c.ordenarPor}"` : "null";
    return [
      `export const listen${N} = (cb) => listen("${c.id}", ${orden}, cb);`,
      `export const add${N} = (data) => addDoc(col("${c.id}"), data);`,
      `export const update${N} = (id, data) => updateDoc(doc(db, "${c.id}", id), data);`,
      `export const delete${N} = (id) => deleteDoc(doc(db, "${c.id}", id));`,
    ].join("\n");
  })
  .join("\n\n");
db = insertarAntes(db, `// ---------- Cálculos derivados ----------`, envolver(lineasDb + "\n"), "db.js");
escribir("js/db.js", db);

// 5 · store.js: escuchar esa colección y guardarla en el estado
let store = leer("js/store.js");
store = insertarAntes(
  store,
  `} from "./db.js`,
  envolver(mod.colecciones.map((c) => `  listen${c.Nombre},`).join("\n")),
  "los imports de store.js"
);
store = insertarAntes(
  store,
  `  config: {},`,
  envolver(mod.colecciones.map((c) => `  ${c.estado}: [],`).join("\n")),
  "el estado inicial"
);
store = insertarAntes(
  store,
  `  listenConfig((data)`,
  envolver(
    mod.colecciones
      .map((c) => `  listen${c.Nombre}((items) => { state.${c.estado} = items; notify("${c.estado}"); });`)
      .join("\n")
  ),
  "los escuchadores"
);
escribir("js/store.js", store);

// 6 · Los estilos del módulo, al final de la hoja de la app
if (existsSync(join(DIR, "estilos.css"))) {
  const css = readFileSync(join(DIR, "estilos.css"), "utf8").trimEnd();
  escribir(
    "css/styles.css",
    leer("css/styles.css").trimEnd() + "\n/* " + MARCA + ":inicio */\n\n" + css + "\n/* " + MARCA + ":fin */\n"
  );
}

// 7 · Las reglas de la base de datos
let reglas = leer("firestore.rules");
const bloqueReglas = mod.colecciones
  .map((c) => `    match /${c.id}/{docId} {\n      allow read, write: if autenticado();\n    }`)
  .join("\n\n");
reglas = insertarAntes(
  reglas,
  `    // Todo lo demás, denegado por defecto.`,
  envolver(bloqueReglas + "\n"),
  "firestore.rules"
);
escribir("firestore.rules", reglas);

// ---------------------------------------------------------- comprobaciones

const fallos = [];
for (const [archivo, queTieneQueEstar] of [
  ...PAGINAS.map((p) => [p, [`data-view="${nombre}"`, `href="#/${nombre}"`]]),
  ["js/app.js", [`mount${mod.Vista}`, `${nombre}: render${mod.Vista}`]],
  ["js/db.js", mod.colecciones.map((c) => `listen${c.Nombre}`)],
  ["js/store.js", mod.colecciones.map((c) => `state.${c.estado} =`)],
  ["firestore.rules", mod.colecciones.map((c) => `match /${c.id}/`)],
]) {
  const texto = leer(archivo);
  for (const trozo of queTieneQueEstar) {
    if (!texto.includes(trozo)) fallos.push(`${archivo}: falta "${trozo}"`);
  }
}
// Y que el enlace esté en LOS DOS menús de CADA página, no solo en uno.
for (const pagina of PAGINAS) {
  const enlaces = (leer(pagina).match(new RegExp(`href="#/${nombre}"`, "g")) || []).length;
  if (enlaces !== 2) fallos.push(`${pagina}: el enlace del menú sale ${enlaces} vez/veces, tienen que ser 2 (escritorio y móvil)`);
}

if (fallos.length) {
  console.error(`\nEl módulo "${nombre}" se instaló mal:`);
  fallos.forEach((f) => console.error("  ✗ " + f));
  console.error("\nQuítalo con: node herramientas/instalar-modulo.mjs " + nombre + " quitar");
  process.exit(1);
}

console.log(`✓ módulo "${nombre}" instalado: ${mod.titulo}`);
console.log(`  Recuerda: hay que volver a publicar firestore.rules en Firebase,`);
console.log(`  o la sección nueva dará "sin permiso" al intentar guardar.`);
