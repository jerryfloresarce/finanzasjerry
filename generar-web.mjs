// El build de Cloudflare Pages: prepara la carpeta _site con LO QUE ES WEB
// (la app y la demostración) y genera la versión de Gaby (gaby.html + su
// manifiesto) a partir de index.html, igual que hacía el workflow de
// GitHub. Fuera se quedan las guías, las reglas y las herramientas, que
// no pintan nada publicadas.
//
// Cloudflare lo ejecuta en cada push con:
//   comando de build:      node generar-web.mjs
//   carpeta de salida:     _site
//
// Sin dependencias: solo Node de serie. El apóstrofe tipográfico de la
// marca va como secuencia unicode para que el archivo sea ASCII puro.

import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const SALIDA = "_site";
const PUBLICAR = ["index.html", "manifest.json", "css", "js", "assets", "demo"];

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA);
for (const nombre of PUBLICAR) {
  if (!existsSync(nombre)) {
    console.error(`Falta ${nombre} y es parte de la web.`);
    process.exit(1);
  }
  cpSync(nombre, `${SALIDA}/${nombre}`, { recursive: true });
}

// La pagina de Gaby: misma app, su nombre y su manifiesto.
const AP = "\u2019";
let html = readFileSync(`${SALIDA}/index.html`, "utf8");
html = html.split("Jerry" + AP + "s Life").join("Gaby" + AP + "s Life");
html = html.split("Jerry" + AP + "s <span>").join("Gaby" + AP + "s <span>");
html = html.split("Hola, Jerry").join("Hola, Gaby");
html = html.replace('href="manifest.json', 'href="manifest-gaby.json');
writeFileSync(`${SALIDA}/gaby.html`, html);

let man = readFileSync(`${SALIDA}/manifest.json`, "utf8");
man = man.split("Jerry" + AP + "s Life").join("Gaby" + AP + "s Life");
man = man.replace(/"start_url":\s*"[^"]*"/, '"start_url": "gaby.html"');
writeFileSync(`${SALIDA}/manifest-gaby.json`, man);

const cuantasGaby = (html.match(new RegExp("Gaby" + AP + "s", "g")) || []).length;
if (cuantasGaby < 3) {
  console.error("gaby.html no salio bien: la marca de Gaby no aparece.");
  process.exit(1);
}
console.log(`_site lista: la app, la demo y la pagina de Gaby (${cuantasGaby} marcas).`);
