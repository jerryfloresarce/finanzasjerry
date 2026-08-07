// Máscaras de los tajos de Zoro y del aspa de Inosuke.
//
// Antes eran bandas rectas de grosor constante (linear-gradient), y se
// notaba: un corte de espada no es una barra, es fino en las puntas, gordo
// por el medio y va ligeramente curvado. Y el de Inosuke, además, mellado,
// que sus espadas están hechas polvo.
import { writeFileSync } from "node:fs";

const r1 = (n) => Math.round(n * 10) / 10;
const P = (pts) => "M" + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L");

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

// Un tajo: una lente alargada. El ancho va como un seno, así que en las
// dos puntas vale cero (el filo entra y sale) y el máximo está en medio.
// "curva" arquea el eje; "dientes" mella los bordes.
function tajo(a, b, ancho, curva, dientes = 0, rnd = null) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const lado = (signo) => {
    const N = dientes ? 30 : 20;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const eje = curva * 4 * t * (1 - t);
      const w = ancho * Math.pow(Math.sin(Math.PI * t), 0.7);
      let off = eje + signo * w;
      if (dientes && i > 0 && i < N) {
        off += (rnd() * 2 - 1) * dientes * Math.sin(Math.PI * t);
      }
      pts.push([ax + ux * L * t + nx * off, ay + uy * L * t + ny * off]);
    }
    return pts;
  };
  return P([...lado(1), ...lado(-1).reverse()]) + "Z";
}

const W = 700;
const H = 1500;

// ---------------------------------------------------------------- ZORO
// Tres tajos paralelos, de largos y grosores distintos, con el filo
// blanco por dentro. Se dibujan desplazados unos de otros a lo ancho.
const A = [-20, -250];
const B = [980, 1750];
const ux = (B[0] - A[0]) / Math.hypot(B[0] - A[0], B[1] - A[1]);
const uy = (B[1] - A[1]) / Math.hypot(B[0] - A[0], B[1] - A[1]);
const nx = -uy;
const ny = ux;
const desplazar = (p, o, s) => [p[0] + nx * o + ux * s, p[1] + ny * o + uy * s];

const ZORO = [
  { o: -235, ancho: 21, curva: 58, s0: 120, s1: -180 },
  { o: 10, ancho: 30, curva: -72, s0: -60, s1: 60 },
  { o: 250, ancho: 17, curva: 46, s0: 200, s1: -120 },
];
const dZoroCuerpo = ZORO.map((z) => tajo(desplazar(A, z.o, z.s0), desplazar(B, z.o, z.s1), z.ancho, z.curva)).join("");
const dZoroFilo = ZORO.map((z) =>
  tajo(desplazar(A, z.o, z.s0 + 40), desplazar(B, z.o, z.s1 - 40), z.ancho * 0.26, z.curva)
).join("");

const svgTajos = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g fill="${color}"><path fill-opacity=".24" d="${dZoroCuerpo}"/><path d="${dZoroFilo}"/></g></svg>`;

// -------------------------------------------------------------- INOSUKE
// Dos tajos cruzados y mellados: sus espadas están todas melladas, así que
// el corte que dejan no puede tener el borde limpio.
const rnd = aleatorio(88);
const INOSUKE = [
  { a: [-170, -200], b: [870, 1700], ancho: 27, curva: 40, dientes: 8 },
  { a: [870, -200], b: [-170, 1700], ancho: 22, curva: -34, dientes: 7 },
];
const dAspaCuerpo = INOSUKE.map((i) => tajo(i.a, i.b, i.ancho, i.curva, i.dientes, rnd)).join("");
const dAspaFilo = INOSUKE.map((i) => tajo(i.a, i.b, i.ancho * 0.3, i.curva, i.dientes * 0.35, rnd)).join("");

const svgAspa = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g fill="${color}"><path fill-opacity=".26" d="${dAspaCuerpo}"/><path d="${dAspaFilo}"/></g></svg>`;

const enc = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const salida = [
  ["--tajos", enc(svgTajos("#000"))],
  ["--aspa", enc(svgAspa("#000"))],
];
writeFileSync(new URL("./variables-tajos.css", import.meta.url), salida.map(([k, v]) => `  ${k}: ${v};`).join("\n"));

const caja = (svg, fondo) =>
  `<div style="background:${fondo};width:300px">${svg.replace("<svg", '<svg style="width:100%;display:block"')}</div>`;
writeFileSync(
  new URL("./previa-tajos.html", import.meta.url),
  `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111;display:flex;gap:12px;padding:10px">
   ${caja(svgTajos("#3ee06b"), "#060a07")}
   ${caja(svgAspa("#5fd6f0"), "#05080b")}
   </body>`
);
console.log("hecho");
