// Pruebas locales del servidor de avisos, sin Cloudflare: un KV de mentira
// (que cuenta escrituras) y un servicio de push de mentira que DESCIFRA lo
// que el worker manda y comprueba la firma VAPID, como haría el navegador.
//   node worker/prueba/probar.mjs
import worker, { hashEndpoint } from "../index.mjs";

let ok = 0, mal = 0;
const check = (c, m) => { c ? ok++ : mal++; console.log(` ${c ? "✓" : "✗"} ${m}`); };
const te = new TextEncoder(), td = new TextDecoder();
const b64u = (u8) => Buffer.from(u8).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s) => new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
const cat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

// ---- KV de mentira ----
class KVFalso {
  constructor() { this.m = new Map(); this.escrituras = 0; this.listados = 0; }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.escrituras++; this.m.set(k, v); }
  async delete(k) { this.escrituras++; this.m.delete(k); }
  async list({ prefix = "" } = {}) { this.listados++; return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}

// ---- claves VAPID del servidor ----
const parVapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwkVapid = await crypto.subtle.exportKey("jwk", parVapid.privateKey);
const publicaVapid = b64u(cat(new Uint8Array([4]), deB64u(jwkVapid.x), deB64u(jwkVapid.y)));
const env = { AVISOS: new KVFalso(), VAPID_PRIVADA_JWK: JSON.stringify({ kty: "EC", crv: "P-256", x: jwkVapid.x, y: jwkVapid.y, d: jwkVapid.d }), VAPID_CONTACTO: "mailto:prueba@prueba.com" };

// ---- un "móvil": su par ECDH y su secreto auth, como hace el navegador ----
async function nuevoMovil(n) {
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publica = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { par, publica, auth, suscripcion: { endpoint: `https://push.prueba/sub/${n}`, keys: { p256dh: b64u(publica), auth: b64u(auth) } } };
}
const hkdf = async (salt, ikm, info, bits) => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), bits));
async function descifrar(movil, cuerpo) {
  const salt = cuerpo.slice(0, 16), idlen = cuerpo[20], asPub = cuerpo.slice(21, 21 + idlen), ct = cuerpo.slice(21 + idlen);
  const asClave = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secreto = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asClave }, movil.par.privateKey, 256));
  const ikm = await hkdf(movil.auth, secreto, cat(te.encode("WebPush: info\0"), movil.publica, asPub), 256);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 96);
  const clave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, clave, ct));
  let fin = claro.length - 1; while (fin > 0 && claro[fin] === 0) fin--;
  if (claro[fin] !== 2) throw new Error("delimitador de registro incorrecto");
  return JSON.parse(td.decode(claro.slice(0, fin)));
}
async function verificarVAPID(auth, endpoint) {
  const m = /^vapid t=([^,]+), k=(\S+)$/.exec(auth);
  if (!m) return { ok: false, motivo: "cabecera mal formada" };
  const [h, p, s] = m[1].split(".");
  const clave = await crypto.subtle.importKey("raw", deB64u(m[2]), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const firmaOK = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, clave, deB64u(s), te.encode(`${h}.${p}`));
  const claims = JSON.parse(td.decode(deB64u(p)));
  return { ok: firmaOK && claims.aud === new URL(endpoint).origin && claims.exp * 1000 > Date.now() && m[2] === publicaVapid, claims };
}

// ---- servicio de push de mentira ----
const moviles = new Map(); // endpoint → movil
const recibidos = []; // { endpoint, carga, cabeceras, vapid }
let estadoRespuesta = 201;
const fetchReal = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith("https://push.prueba/")) return fetchReal(url, init);
  const movil = moviles.get(String(url));
  const cuerpo = new Uint8Array(init.body);
  const carga = await descifrar(movil, cuerpo);
  const vapid = await verificarVAPID(init.headers.authorization, String(url));
  recibidos.push({ endpoint: String(url), carga, cabeceras: init.headers, vapid });
  return new Response(null, { status: estadoRespuesta });
};

// ---- ayudas para hablar con el worker ----
const BASE = "https://worker.prueba";
const pedir = (ruta, init) => worker.fetch(new Request(BASE + "/api/avisos/" + ruta, init), env);
const post = (ruta, cuerpo) => pedir(ruta, { method: "POST", headers: { "content-type": "application/json", origin: "https://app.prueba" }, body: JSON.stringify(cuerpo) });
const cron = (ahoraMs) => worker.scheduled({ scheduledTime: ahoraMs }, env, { waitUntil() {} });
// El cron de las pruebas usa la hora simulada también como reloj real, así
// la "espera al segundo exacto" es 0 y no duerme de verdad.
import { pasada } from "../index.mjs";
let PASADAS = 0;
const cronSim = (ahoraMs) => { PASADAS++; return pasada(env, ahoraMs, () => ahoraMs); };

const min = 60_000;
const T = Date.parse("2026-10-01T10:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();

console.log("== clave y CORS ==");
let r = await pedir("clave");
check(r.status === 200 && (await r.json()).clave === publicaVapid, "GET /clave devuelve la pública VAPID derivada del secreto");
r = await pedir("x", { method: "OPTIONS", headers: { origin: "https://app.prueba" } });
check(r.status === 204 && r.headers.get("access-control-allow-origin") === "*", "OPTIONS responde 204 con CORS");
r = await post("sincronizar", { suscripcion: { endpoint: "http://malo" }, avisos: [] });
check(r.status === 400, "Una suscripción inválida se rechaza con 400");

console.log("== sincronizar y estado ==");
const movil = await nuevoMovil(1);
moviles.set(movil.suscripcion.endpoint, movil);
const avisos = [
  { id: "cita_dentista", cuando: iso(T + 2 * min), titulo: "Dentista", cuerpo: "Hoy a las 12:02", url: "./#/agenda" },
  { id: "cobro_raquel", cuando: iso(T + 40 * min), titulo: "💰 Cobro de préstamo", cuerpo: "A Raquel le toca pagarte hoy", url: "./#/prestamos" },
  { id: "viejo", cuando: iso(T - 3 * 60 * min), titulo: "Viejo", cuerpo: "de hace 3 horas" },
];
r = await post("sincronizar", { suscripcion: movil.suscripcion, avisos, etiqueta: "iPhone de prueba" });
let j = await r.json();
check(r.status === 200 && j.ok && j.guardados === 3, "POST /sincronizar guarda la lista (3 avisos)");
r = await pedir(`estado?endpoint=${encodeURIComponent(movil.suscripcion.endpoint)}`);
j = await r.json();
check(j.suscrito === true && j.avisos === 3 && j.enviados === 0, "GET /estado: suscrito, 3 avisos, 0 enviados");

console.log("== el cron ==");
let escrituras = env.AVISOS.escrituras;
await cronSim(T);
check(recibidos.length === 0, "A las 10:00 no toca ninguno: no se manda nada");
r = await pedir(`estado?endpoint=${encodeURIComponent(movil.suscripcion.endpoint)}`); j = await r.json();
check(j.perdidos.length === 1 && j.perdidos[0].id === "viejo" && /dos horas tarde/.test(j.perdidos[0].motivo), "El aviso de hace 3 horas se da por perdido con su motivo en castellano");
escrituras = env.AVISOS.escrituras;
const listadosAntes = env.AVISOS.listados;
await cronSim(T + 30_000);
check(env.AVISOS.escrituras === escrituras && recibidos.length === 0, "Una pasada sin nada que hacer no escribe en KV ni manda nada");
check(env.AVISOS.listados === listadosAntes, "Y dentro de los 3 minutos reutiliza la lista de suscripciones (0 list nuevos)");

await cronSim(T + 2 * min);
check(recibidos.length === 1, "A las 10:02 sale el aviso del dentista (1 empujón)");
const e1 = recibidos[0];
check(e1.carga.id === "cita_dentista" && e1.carga.titulo === "Dentista" && e1.carga.cuerpo === "Hoy a las 12:02" && e1.carga.url === "./#/agenda", "El móvil DESCIFRA el empujón y lee id, título, cuerpo y url");
check(e1.vapid.ok, `La firma VAPID es válida para ${e1.vapid.claims?.aud} y lleva la clave pública correcta`);
check(e1.cabeceras.ttl === "14400" && e1.cabeceras.urgency === "high" && e1.cabeceras["content-encoding"] === "aes128gcm", "Cabeceras: TTL 4 h, Urgency high, aes128gcm");
await cronSim(T + 2 * min + 30_000);
check(recibidos.length === 1, "En la pasada siguiente NO se repite (ya consta enviado)");
r = await pedir(`estado?endpoint=${encodeURIComponent(movil.suscripcion.endpoint)}`); j = await r.json();
check(j.enviados === 1 && j.pendientes === 1 && j.perdidos.length === 1, "Estado: 1 enviado, 1 pendiente (el cobro), 1 perdido");

console.log("== pendientes / mostrados (empujón sin contenido) ==");
r = await pedir(`pendientes?endpoint=${encodeURIComponent(movil.suscripcion.endpoint)}`); j = await r.json();
check(Array.isArray(j) && j.length === 1 && j[0].id === "cita_dentista", "GET /pendientes devuelve lo enviado y aún no enseñado");
await post("mostrados", { endpoint: movil.suscripcion.endpoint, ids: ["cita_dentista"] });
r = await pedir(`pendientes?endpoint=${encodeURIComponent(movil.suscripcion.endpoint)}`); j = await r.json();
check(j.length === 0, "Tras confirmar /mostrados, ya no hay pendientes");

console.log("== reintentos con espera creciente ==");
estadoRespuesta = 500;
const antes = recibidos.length;
await cronSim(T + 40 * min);
check(recibidos.length === antes + 1, "10:40: primer intento del cobro (el servicio falla con 500)");
await cronSim(T + 40 * min + 30_000);
check(recibidos.length === antes + 1, "30 s después no reintenta (espera 1 min)");
await cronSim(T + 41 * min + 5_000);
check(recibidos.length === antes + 2, "Al minuto reintenta (2º intento)");
await cronSim(T + 42 * min);
check(recibidos.length === antes + 2, "Tras el 2º intento espera 2 min: a los 55 s no reintenta");
// Agotar los 8 intentos: 3º a +3m, 4º a +7m, 5º a +15m, 6º a +31m, 7º a +63m... (tope 60 min), 8º
let t = T + 41 * min + 5_000;
for (let k = 3; k <= 8; k++) { t += Math.min(60 * min, min * 2 ** (k - 2)) + 5_000; await cronSim(t); }
check(recibidos.length === antes + 8, `Se hacen exactamente 8 intentos (${recibidos.length - antes})`);
await cronSim(t + 70 * min);
check(recibidos.length === antes + 8, "Y después ya no insiste más");
r = await pedir(`estado?endpoint=${encodeURIComponent(movil.suscripcion.endpoint)}`); j = await r.json();
const perdidoCobro = j.perdidos.find((p) => p.id === "cobro_raquel");
check(perdidoCobro && /Lo intenté 8 veces/.test(perdidoCobro.motivo), `Se da por perdido con motivo: "${perdidoCobro?.motivo}"`);
estadoRespuesta = 201;

console.log("== volver a sincronizar sustituye la lista y limpia marcas ==");
r = await post("sincronizar", { suscripcion: movil.suscripcion, avisos: [{ id: "nuevo", cuando: iso(T + 500 * min), titulo: "Nuevo" }] });
const marcas = JSON.parse(await env.AVISOS.get(`mar:${await hashEndpoint(movil.suscripcion.endpoint)}`));
check(Object.keys(marcas).length === 0 && (await r.json()).guardados === 1, "Los avisos que ya no vienen desaparecen, con sus marcas");

console.log("== aviso de prueba ==");
const antesPrueba = recibidos.length;
r = await post("prueba", { suscripcion: movil.suscripcion });
check(r.status === 200 && (await r.json()).ok && recibidos.length === antesPrueba + 1 && recibidos.at(-1).carga.titulo === "Aviso de prueba", "POST /prueba manda un empujón al momento");

console.log("== móvil que ya no existe (410) ==");
const movil2 = await nuevoMovil(2);
moviles.set(movil2.suscripcion.endpoint, movil2);
await post("sincronizar", { suscripcion: movil2.suscripcion, avisos: [{ id: "a", cuando: iso(T + 600 * min), titulo: "A" }] });
estadoRespuesta = 410;
await cronSim(T + 600 * min);
estadoRespuesta = 201;
r = await pedir(`estado?endpoint=${encodeURIComponent(movil2.suscripcion.endpoint)}`); j = await r.json();
check(j.suscrito === false, "Si el servicio dice 410, la suscripción se borra (habrá que reactivar)");

console.log("== baja ==");
await post("baja", { endpoint: movil.suscripcion.endpoint });
r = await pedir(`estado?endpoint=${encodeURIComponent(movil.suscripcion.endpoint)}`); j = await r.json();
check(j.suscrito === false, "POST /baja da de baja el móvil");
check(env.AVISOS.listados < PASADAS, `El listado de suscripciones se cachea: ${env.AVISOS.listados} list para ${PASADAS} pasadas de cron`);

console.log(`\n${ok} ✓ · ${mal} ✗`);
process.exit(mal ? 1 : 0);
