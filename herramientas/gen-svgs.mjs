// Genera los data-URI de las máscaras SVG para css/temas.css.
import { writeFileSync } from "node:fs";

const r1 = (n) => Math.round(n * 10) / 10;
const P = (pts) => "M" + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L");

// PRNG con semilla: así el rayo es siempre el mismo (se elige el que mejor
// queda) y no cambia de forma en cada compilación.
function aleatorio(semilla) {
  let a = semilla;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- ZENITSU
// El rayo se genera por desplazamiento del punto medio (el método clásico
// para relámpagos): se parte el trazo por la mitad una y otra vez y cada
// vez se desvía un poco menos. Sale irregular de verdad —tramos largos,
// tramos cortísimos, quiebros secos— en vez de un zigzag de dientes de
// sierra todos iguales.
const ALTO = 360;
const limitar = (y) => Math.max(26, Math.min(ALTO - 26, y));

function subdividir(a, b, niveles, desplaz, rnd) {
  let puntos = [a, b];
  let d = desplaz;
  for (let n = 0; n < niveles; n++) {
    const nuevos = [puntos[0]];
    for (let i = 0; i < puntos.length - 1; i++) {
      const p = puntos[i];
      const q = puntos[i + 1];
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const largo = Math.hypot(dx, dy) || 1;
      // Perpendicular al tramo, para que la desviación sea lateral.
      const nx = -dy / largo;
      const ny = dx / largo;
      // El punto medio no cae exactamente en el medio: eso es lo que crea
      // tramos de longitudes muy distintas.
      const t = 0.34 + rnd() * 0.32;
      const off = (rnd() * 2 - 1) * d;
      nuevos.push([p[0] + dx * t + nx * off, limitar(p[1] + dy * t + ny * off)], q);
    }
    puntos = nuevos;
    d *= 0.52;
  }
  return puntos;
}

function generarRayo(semilla) {
  const rnd = aleatorio(semilla);
  const principal = subdividir([-24, 150], [1024, 214], 6, 96, rnd);
  const ramas = [];
  // Las ramas salen de puntos repartidos por el trazo principal, siempre
  // hacia delante y abriéndose en ángulo agudo, como las de verdad.
  const anclas = [0.1, 0.2, 0.29, 0.4, 0.5, 0.6, 0.69, 0.79, 0.88];
  anclas.forEach((frac) => {
    const i = Math.max(1, Math.round(frac * (principal.length - 1)));
    const p = principal[i];
    const prev = principal[i - 1];
    const dx = p[0] - prev[0];
    const dy = p[1] - prev[1];
    const base = Math.atan2(dy, dx);
    const giro = (0.3 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1);
    const largo = 80 + rnd() * 190;
    const ang = base + giro;
    const fin = [p[0] + Math.cos(ang) * largo, limitar(p[1] + Math.sin(ang) * largo)];
    const rama = subdividir(p, fin, 4, largo * 0.16, rnd);
    ramas.push(rama);
    // Alguna rama se vuelve a partir: es lo que da sensación de árbol.
    if (rnd() < 0.55) {
      const j = Math.max(1, Math.round(rama.length * (0.35 + rnd() * 0.35)));
      const q = rama[j];
      const ang2 = ang + (0.35 + rnd() * 0.45) * (rnd() < 0.5 ? -1 : 1);
      const l2 = largo * (0.32 + rnd() * 0.28);
      const fin2 = [q[0] + Math.cos(ang2) * l2, limitar(q[1] + Math.sin(ang2) * l2)];
      ramas.push(subdividir(q, fin2, 3, l2 * 0.16, rnd));
    }
  });
  return { principal: P(principal), ramas: ramas.map(P).join("") };
}

// Semilla elegida a ojo entre varias (ver previa-rayos.html).
const SEMILLA_RAYO = 1234;
const { principal: PRINCIPAL, ramas: RAMAS } = generarRayo(SEMILLA_RAYO);

const svgRayo = (color) => ({
  halo: `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="360" viewBox="0 0 1000 360"><g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round"><path stroke-opacity=".13" stroke-width="26" d="${PRINCIPAL}"/><path stroke-opacity=".09" stroke-width="13" d="${RAMAS}"/><path stroke-opacity=".46" stroke-width="8" d="${PRINCIPAL}"/><path stroke-opacity=".3" stroke-width="4.2" d="${RAMAS}"/></g></svg>`,
  nucleo: `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="360" viewBox="0 0 1000 360"><g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round"><path stroke-width="3" d="${PRINCIPAL}"/><path stroke-opacity=".8" stroke-width="1.6" d="${RAMAS}"/></g></svg>`,
});

// ---------------------------------------------------------------- AKAZA
// El símbolo de escarcha de la Aguja de Brújula: copo de seis brazos con
// púas ramificadas, plaquitas hexagonales, hexágonos interiores, aro
// graduado y la aguja de la brújula cruzándolo.
const LIENZO = 320;
const C = LIENZO / 2;
const rot = ([x, y], deg) => {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};
const mundo = (pts, giro) => pts.map((p) => rot(p, giro)).map(([x, y]) => [C + x, C + y]);

const BARBAS = [
  { r: 34, L: 20, sub: true },
  { r: 50, L: 28, sub: true },
  { r: 64, L: 22, sub: false },
  { r: 76, L: 15, sub: false },
  { r: 86, L: 10, sub: false },
];
const ANG_BARBA = 42;
const dir = (deg) => rot([0, -1], deg);

function piezasDeUnBrazo() {
  const espina = [[[0, -9], [0, -96]]];
  const barbas = [];
  const subs = [];
  BARBAS.forEach(({ r, L, sub }) => {
    [-1, 1].forEach((lado) => {
      const d = dir(lado * ANG_BARBA);
      const ini = [0, -r];
      const fin = [ini[0] + d[0] * L, ini[1] + d[1] * L];
      barbas.push([ini, fin]);
      if (!sub) return;
      const medio = [ini[0] + d[0] * L * 0.5, ini[1] + d[1] * L * 0.5];
      const d2 = rot(d, lado * 34);
      subs.push([medio, [medio[0] + d2[0] * L * 0.45, medio[1] + d2[1] * L * 0.45]]);
    });
  });
  // Una plaquita hexagonal ensartada en la espina, como en los copos reales.
  const hex = [];
  for (let i = 0; i < 6; i++) hex.push(rot([0, -6.5], i * 60));
  const placa = [[...hex.map(([x, y]) => [x, y - 42]), [hex[0][0], hex[0][1] - 42]]];
  return { espina, barbas, subs, placa };
}

const brazo = piezasDeUnBrazo();
const seisVeces = (lista) =>
  [0, 60, 120, 180, 240, 300].flatMap((g) => lista.map((pts) => P(mundo(pts, g)))).join("");

const dEspinas = seisVeces(brazo.espina);
const dBarbas = seisVeces(brazo.barbas);
const dSubs = seisVeces(brazo.subs);
const dPlacas = seisVeces(brazo.placa);

const hexagono = (radio, giro) => {
  const pts = [];
  for (let i = 0; i < 7; i++) pts.push(rot([0, -radio], giro + i * 60));
  return P(mundo(pts, 0));
};
const dHexagonos = hexagono(34, 0) + hexagono(22, 30);

// Aro graduado: raya cada 10°, más larga cada 30°.
let dTicks = "";
let dTicksLargos = "";
for (let i = 0; i < 36; i++) {
  const g = i * 10;
  const largo = i % 3 === 0;
  const trazo = P(mundo([[0, -(largo ? 101 : 104)], [0, -(largo ? 114 : 110)]], g));
  if (largo) dTicksLargos += trazo;
  else dTicks += trazo;
}

// La aguja de la brújula, girada 30° para que se distinga de los brazos.
// Tiene que ser ancha de cintura: más estrecha se lee como dos rayas
// cruzadas sueltas en vez de como una aguja.
const dAguja = P(mundo([[0, -86], [17, 0], [0, 86], [-17, 0], [0, -86]], 30));

// Cristalitos sueltos alrededor del copo, como escarcha que va cuajando en
// el aire. Van dentro del mismo dibujo para que crezcan y giren con él.
const rndMotas = aleatorio(4242);
let dMotas = "";
for (let i = 0; i < 18; i++) {
  const ang = i * 20 + rndMotas() * 16 - 8;
  const rad = 128 + rndMotas() * 74;
  const tam = 5 + rndMotas() * 7;
  const giro = rndMotas() * 60;
  const [x, y] = mundo([[0, -rad]], ang)[0];
  // Fuera del lienzo no se ve: las esquinas llegan a r≈226, los lados a 160.
  if (Math.abs(x - C) > C - tam - 2 || Math.abs(y - C) > C - tam - 2) continue;
  for (let j = 0; j < 3; j++) {
    const a = rot([0, -tam], giro + j * 60);
    dMotas += `M${r1(x - a[0])} ${r1(y - a[1])}L${r1(x + a[0])} ${r1(y + a[1])}`;
  }
  const p = rot([0, -tam * 0.62], giro);
  [40, -40].forEach((g2) => {
    const q = rot(p, g2);
    dMotas += `M${r1(x + p[0])} ${r1(y + p[1])}L${r1(x + q[0] * 0.5)} ${r1(y + q[1] * 0.5)}`;
  });
}

const svgEscarcha = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LIENZO}" height="${LIENZO}" viewBox="0 0 ${LIENZO} ${LIENZO}"><g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round"><path stroke-opacity=".12" stroke-width="15" d="${dEspinas}"/><circle stroke-opacity=".1" stroke-width="11" cx="${C}" cy="${C}" r="100"/><path stroke-opacity=".45" stroke-width="1.9" d="${dAguja}"/><path stroke-width="2.8" d="${dEspinas}"/><path stroke-opacity=".92" stroke-width="2" d="${dBarbas}"/><path stroke-opacity=".7" stroke-width="1.2" d="${dSubs}"/><path stroke-opacity=".75" stroke-width="1.4" d="${dPlacas}"/><path stroke-opacity=".9" stroke-width="1.8" d="${dHexagonos}"/><circle stroke-opacity=".85" stroke-width="1.4" cx="${C}" cy="${C}" r="100"/><circle stroke-opacity=".9" stroke-width="1.6" cx="${C}" cy="${C}" r="7"/><path stroke-opacity=".6" stroke-width="1.1" d="${dTicks}"/><path stroke-opacity=".85" stroke-width="1.7" d="${dTicksLargos}"/><path stroke-opacity=".62" stroke-width="1.5" d="${dMotas}"/></g></svg>`;

const enc = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

const salida = [
  ["--rayo", enc(svgRayo("#000").halo)],
  ["--rayo-nucleo", enc(svgRayo("#000").nucleo)],
  ["--escarcha", enc(svgEscarcha("#000"))],
  
];
console.log(salida.map(([k, v]) => `${k}: ${v};`).join("\n\n"));
writeFileSync(new URL("./variables.css", import.meta.url), salida.map(([k, v]) => `  ${k}: ${v};`).join("\n"));

// ---- Vistas previas (trazo claro sobre fondo oscuro, como se verán) ----
const caja = (svg, fondo) =>
  `<div style="background:${fondo};margin:14px 0">${svg.replace("<svg", '<svg style="width:100%;display:block"')}</div>`;
writeFileSync(
  new URL("./previa-svgs.html", import.meta.url),
  `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111;padding:10px">
   ${caja(svgRayo("#ffe37a").halo, "#0c0904")}
   ${caja(svgRayo("#fff8dd").nucleo, "#0c0904")}
   <div style="width:420px;margin:0 auto">${caja(svgEscarcha("#7fe8ee"), "#12081a")}</div>
   
   </body>`
);

// Varias semillas, para poder elegir la que más se parezca a un rayo real.
const semillas = [7, 42, 101, 555, 1234, 20260807, 88881, 31337, 9090, 777];
writeFileSync(
  new URL("./previa-rayos.html", import.meta.url),
  `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0c0904">` +
    semillas
      .map((s) => {
        const { principal, ramas } = generarRayo(s);
        return `<div style="position:relative"><svg style="width:100%;display:block" width="1000" height="360" viewBox="0 0 1000 360"><g fill="none" stroke="#ffe37a" stroke-linecap="round" stroke-linejoin="round"><path stroke-opacity=".4" stroke-width="8" d="${principal}"/><path stroke-opacity=".25" stroke-width="4" d="${ramas}"/><path stroke="#fff8dd" stroke-width="3" d="${principal}"/><path stroke="#fff8dd" stroke-opacity=".8" stroke-width="1.6" d="${ramas}"/></g></svg><span style="position:absolute;left:6px;top:6px;color:#fff;font:12px monospace">${s}</span></div>`;
      })
      .join("") +
    `</body>`
);
