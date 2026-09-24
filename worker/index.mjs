// El servidor de avisos: un Cloudflare Worker (plan gratuito) con un KV y un
// cron que se despierta cada minuto.
//
// La app le manda QUÉ avisos tienen que sonar y CUÁNDO (junto con la
// "dirección" Web Push de ese móvil). El cron mira cuáles tocan y se los
// manda al móvil por el canal de avisos del propio navegador, cifrados y
// firmados como exige el estándar. El móvil los enseña aunque la app esté
// cerrada y la pantalla apagada.
//
// Este archivo no sabe nada de préstamos ni de agendas: le da igual de
// dónde salgan los avisos. Solo guarda listas, espera al minuto y empuja.

const RUTA = "/api/avisos/";
const TTL_SEGUNDOS = 4 * 3600; // si el móvil está apagado, el servicio se lo guarda 4 h
const VENTANA_MS = 60_000; // lo que "llega dentro del próximo minuto" también sale en esta pasada
const DEMASIADO_TARDE_MS = 2 * 3600_000; // un aviso de hace más de 2 h ya no es un aviso
const MAX_INTENTOS = 8;
const MAX_ESPERA_REINTENTO_MS = 60 * 60_000;
const CACHE_LISTA_MS = 3 * 60_000; // el plan gratuito da 1.000 list/día; el cron corre 1.440 veces

// ---------- utilidades ----------

const b64u = {
  aBytes(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/");
    const relleno = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
    return Uint8Array.from(atob(s + relleno), (c) => c.charCodeAt(0));
  },
  deBytes(u8) {
    let s = "";
    for (const b of u8) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  deTexto(t) {
    return b64u.deBytes(new TextEncoder().encode(t));
  },
};

const concat = (...partes) => {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
};

async function hashEndpoint(endpoint) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(d).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const json = (cuerpo, estado = 200, extra = {}) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });

function cabecerasCORS(env, request) {
  const origen = request.headers.get("origin") || "";
  const permitidos = (env.ORIGENES_PERMITIDOS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const permitido = permitidos.length === 0 ? "*" : permitidos.includes(origen) ? origen : permitidos[0];
  return {
    "access-control-allow-origin": permitido,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

// ---------- claves VAPID ----------
//
// La privada vive como secreto del Worker (VAPID_PRIVADA_JWK, un JWK en
// texto). La pública se deriva de ella: un solo secreto que cuidar. Si se
// pierden, todos los móviles tienen que volver a activar los avisos.

let vapidCache = null;
async function vapid(env) {
  if (vapidCache) return vapidCache;
  if (!env.VAPID_PRIVADA_JWK) throw new Error("Falta el secreto VAPID_PRIVADA_JWK");
  const jwk = typeof env.VAPID_PRIVADA_JWK === "string" ? JSON.parse(env.VAPID_PRIVADA_JWK) : env.VAPID_PRIVADA_JWK;
  const privada = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const publicaBytes = concat(new Uint8Array([4]), b64u.aBytes(jwk.x), b64u.aBytes(jwk.y));
  vapidCache = { privada, publica: b64u.deBytes(publicaBytes) };
  return vapidCache;
}

async function firmaVAPID(env, endpoint) {
  const { privada, publica } = await vapid(env);
  const audiencia = new URL(endpoint).origin;
  const cabecera = b64u.deTexto(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const datos = b64u.deTexto(
    JSON.stringify({
      aud: audiencia,
      exp: Math.floor(Date.now() / 1000) + 12 * 3600,
      sub: env.VAPID_CONTACTO || "mailto:avisos@example.com",
    })
  );
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privada,
    new TextEncoder().encode(`${cabecera}.${datos}`)
  );
  return { authorization: `vapid t=${cabecera}.${datos}.${b64u.deBytes(new Uint8Array(firma))}, k=${publica}` };
}

// ---------- cifrado del empujón (RFC 8291 + RFC 8188, aes128gcm) ----------

async function hkdf(salt, ikm, info, bits) {
  const clave = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, clave, bits));
}

async function cifrar(suscripcion, textoPlano) {
  const uaPublica = b64u.aBytes(suscripcion.keys.p256dh); // 65 bytes, sin comprimir
  const authSecreto = b64u.aBytes(suscripcion.keys.auth); // 16 bytes
  const asPar = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", asPar.publicKey));
  const uaClave = await crypto.subtle.importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secretoECDH = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaClave }, asPar.privateKey, 256));

  const te = new TextEncoder();
  const infoClave = concat(te.encode("WebPush: info\0"), uaPublica, asPublica);
  const ikm = await hkdf(authSecreto, secretoECDH, infoClave, 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 96);

  // Un único registro: el contenido y el delimitador de último registro (0x02).
  const registro = concat(te.encode(textoPlano), new Uint8Array([2]));
  const claveAES = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, claveAES, registro));

  const tamanoRegistro = new Uint8Array(4);
  new DataView(tamanoRegistro.buffer).setUint32(0, 4096);
  return concat(salt, tamanoRegistro, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

// El empujón en sí. Devuelve { ok, estado, motivo }.
async function empujar(env, suscripcion, carga) {
  let cuerpo;
  try {
    cuerpo = await cifrar(suscripcion, JSON.stringify(carga));
  } catch (e) {
    return { ok: false, estado: 0, motivo: `No pude cifrar el aviso para este móvil (${e.message})`, definitivo: true };
  }
  let respuesta;
  try {
    respuesta = await globalThis.fetch(suscripcion.endpoint, {
      method: "POST",
      headers: {
        ...(await firmaVAPID(env, suscripcion.endpoint)),
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: String(TTL_SEGUNDOS),
        urgency: "high",
      },
      body: cuerpo,
    });
  } catch (e) {
    return { ok: false, estado: 0, motivo: `No llegué al servicio de avisos del móvil (${e.message})` };
  }
  if (respuesta.status === 201 || respuesta.status === 200) return { ok: true, estado: respuesta.status };
  // 404/410: la suscripción ya no existe (la app se desinstaló, o se
  // revocó el permiso). No tiene sentido reintentar.
  if (respuesta.status === 404 || respuesta.status === 410) {
    return { ok: false, estado: respuesta.status, motivo: "Este móvil ya no acepta avisos (hay que volver a activarlos)", caducada: true };
  }
  return { ok: false, estado: respuesta.status, motivo: `El servicio de avisos del móvil respondió ${respuesta.status}` };
}

// ---------- almacenamiento ----------

const kSub = (h) => `sub:${h}`;
const kMar = (h) => `mar:${h}`;
const kVis = (h) => `vis:${h}`;

async function leer(env, clave) {
  const v = await env.AVISOS.get(clave);
  return v ? JSON.parse(v) : null;
}
const guardar = (env, clave, valor) => env.AVISOS.put(clave, JSON.stringify(valor));

let listaCache = null;
let listaCacheHasta = 0;
async function hashesSuscritos(env, ahora) {
  if (listaCache && ahora < listaCacheHasta) return listaCache;
  const hashes = [];
  let cursor;
  do {
    const pagina = await env.AVISOS.list({ prefix: "sub:", cursor });
    for (const k of pagina.keys) hashes.push(k.name.slice(4));
    cursor = pagina.list_complete ? undefined : pagina.cursor;
  } while (cursor);
  listaCache = hashes;
  listaCacheHasta = ahora + CACHE_LISTA_MS;
  return hashes;
}
const olvidarListaCache = () => {
  listaCache = null;
};

function avisoValido(a) {
  return (
    a &&
    typeof a.id === "string" &&
    a.id.length > 0 &&
    a.id.length <= 200 &&
    typeof a.cuando === "string" &&
    !Number.isNaN(Date.parse(a.cuando)) &&
    typeof a.titulo === "string"
  );
}

function suscripcionValida(s) {
  return s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string";
}

// ---------- el cron: cada minuto ----------

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const esperaReintento = (intentos) => Math.min(MAX_ESPERA_REINTENTO_MS, 60_000 * 2 ** Math.max(0, intentos - 1));

async function pasada(env, ahoraMs, reloj = Date.now) {
  const hashes = await hashesSuscritos(env, ahoraMs);
  const informe = { revisados: 0, enviados: 0, fallidos: 0, perdidos: 0 };
  for (const h of hashes) {
    const sub = await leer(env, kSub(h));
    if (!sub) {
      olvidarListaCache();
      continue;
    }
    const marcas = (await leer(env, kMar(h))) || {};
    let cambiado = false;
    const avisos = (sub.avisos || []).filter(avisoValido).sort((a, b) => Date.parse(a.cuando) - Date.parse(b.cuando));

    for (const aviso of avisos) {
      const cuandoMs = Date.parse(aviso.cuando);
      const marca = marcas[aviso.id] || { estado: "pendiente", intentos: 0 };
      if (marca.estado === "enviado" || marca.estado === "perdido") continue;
      if (cuandoMs > ahoraMs + VENTANA_MS) continue; // todavía no toca
      informe.revisados++;

      if (ahoraMs - cuandoMs > DEMASIADO_TARDE_MS && marca.intentos === 0) {
        marcas[aviso.id] = { ...marca, estado: "perdido", motivo: "Llegó al servidor más de dos horas tarde, así que no lo mandé", ultimo: ahoraMs };
        cambiado = true;
        informe.perdidos++;
        continue;
      }
      if (marca.intentos > 0 && ahoraMs - (marca.ultimo || 0) < esperaReintento(marca.intentos)) continue; // aún en espera

      // Esperar dentro de la pasada hasta el segundo exacto: el cron no cae
      // en el segundo cero, y un aviso de las 12:25 tiene que salir a las
      // 12:25:00, no a las 12:24:07 ni a las 12:26:07.
      const falta = cuandoMs - reloj();
      if (falta > 0 && falta <= VENTANA_MS + 5000) await dormir(falta);

      const resultado = await empujar(env, sub.suscripcion, {
        id: aviso.id,
        titulo: aviso.titulo,
        cuerpo: aviso.cuerpo || "",
        url: aviso.url || "./",
        cuando: aviso.cuando,
      });
      const intentos = marca.intentos + 1;
      if (resultado.ok) {
        marcas[aviso.id] = { estado: "enviado", intentos, ultimo: ahoraMs, enviadoEn: ahoraMs };
        informe.enviados++;
      } else if (resultado.caducada) {
        // El móvil ya no está: fuera la suscripción entera, y se acaba aquí.
        await env.AVISOS.delete(kSub(h));
        await env.AVISOS.delete(kMar(h));
        await env.AVISOS.delete(kVis(h));
        olvidarListaCache();
        cambiado = false;
        informe.fallidos++;
        break;
      } else if (resultado.definitivo || intentos >= MAX_INTENTOS) {
        marcas[aviso.id] = {
          estado: "perdido",
          intentos,
          ultimo: ahoraMs,
          motivo: resultado.definitivo ? resultado.motivo : `Lo intenté ${intentos} veces y el servicio de avisos del móvil no lo aceptó (${resultado.motivo})`,
        };
        informe.perdidos++;
      } else {
        marcas[aviso.id] = { estado: "pendiente", intentos, ultimo: ahoraMs, motivo: resultado.motivo };
        informe.fallidos++;
      }
      cambiado = true;
    }
    // Una pasada sin nada que hacer no escribe en KV (1.000 escrituras/día).
    if (cambiado) await guardar(env, kMar(h), marcas);
  }
  return informe;
}

// ---------- rutas ----------

async function manejar(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(RUTA)) return json({ error: "No existe" }, 404);
  const accion = url.pathname.slice(RUTA.length);
  const cors = cabecerasCORS(env, request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const responder = (cuerpo, estado = 200) => json(cuerpo, estado, cors);
  const leerJSON = async () => {
    try {
      return await request.json();
    } catch {
      return null;
    }
  };

  if (accion === "clave" && request.method === "GET") {
    const { publica } = await vapid(env);
    return responder({ clave: publica });
  }

  if (accion === "sincronizar" && request.method === "POST") {
    const datos = await leerJSON();
    if (!datos || !suscripcionValida(datos.suscripcion)) return responder({ error: "Falta la suscripción del móvil" }, 400);
    const avisos = Array.isArray(datos.avisos) ? datos.avisos.filter(avisoValido).slice(0, 500) : [];
    const h = await hashEndpoint(datos.suscripcion.endpoint);
    const existente = await leer(env, kSub(h));
    await guardar(env, kSub(h), {
      suscripcion: { endpoint: datos.suscripcion.endpoint, keys: { p256dh: datos.suscripcion.keys.p256dh, auth: datos.suscripcion.keys.auth } },
      avisos,
      actualizado: Date.now(),
      etiqueta: typeof datos.etiqueta === "string" ? datos.etiqueta.slice(0, 80) : existente?.etiqueta || "",
    });
    // Las marcas de avisos que ya no vienen sobran: se limpian aquí, en la
    // única escritura que la sincronización hace además de la lista.
    const marcas = await leer(env, kMar(h));
    if (marcas) {
      const vivos = new Set(avisos.map((a) => a.id));
      const limpias = Object.fromEntries(Object.entries(marcas).filter(([id]) => vivos.has(id)));
      if (Object.keys(limpias).length !== Object.keys(marcas).length) await guardar(env, kMar(h), limpias);
    }
    if (!existente) olvidarListaCache();
    return responder({ ok: true, guardados: avisos.length });
  }

  if (accion === "estado" && request.method === "GET") {
    const endpoint = url.searchParams.get("endpoint");
    if (!endpoint) return responder({ error: "Falta el endpoint" }, 400);
    const h = await hashEndpoint(endpoint);
    const sub = await leer(env, kSub(h));
    if (!sub) return responder({ suscrito: false, avisos: 0, enviados: 0, perdidos: [] });
    const marcas = (await leer(env, kMar(h))) || {};
    const avisos = sub.avisos || [];
    const enviados = avisos.filter((a) => marcas[a.id]?.estado === "enviado").length;
    const perdidos = avisos
      .filter((a) => marcas[a.id]?.estado === "perdido")
      .map((a) => ({ id: a.id, titulo: a.titulo, cuando: a.cuando, motivo: marcas[a.id].motivo || "" }));
    const ultimoEnvio = Math.max(0, ...Object.values(marcas).map((m) => m.enviadoEn || 0)) || null;
    return responder({
      suscrito: true,
      avisos: avisos.length,
      enviados,
      pendientes: avisos.length - enviados - perdidos.length,
      perdidos,
      ultimoEnvio,
      actualizado: sub.actualizado || null,
    });
  }

  if (accion === "prueba" && request.method === "POST") {
    const datos = await leerJSON();
    if (!datos || !suscripcionValida(datos.suscripcion)) return responder({ error: "Falta la suscripción del móvil" }, 400);
    const resultado = await empujar(env, datos.suscripcion, {
      id: `prueba_${Date.now()}`,
      titulo: datos.titulo || "Aviso de prueba",
      cuerpo: datos.cuerpo || "Si ves esto, los avisos funcionan en este móvil.",
      url: datos.url || "./",
      cuando: new Date().toISOString(),
    });
    return responder(resultado.ok ? { ok: true } : { ok: false, motivo: resultado.motivo }, resultado.ok ? 200 : 502);
  }

  // El navegador a veces entrega un empujón SIN contenido. El service worker
  // pregunta entonces qué tocaba (lo enviado y aún no enseñado) y lo enseña.
  if (accion === "pendientes" && request.method === "GET") {
    const endpoint = url.searchParams.get("endpoint");
    if (!endpoint) return responder({ error: "Falta el endpoint" }, 400);
    const h = await hashEndpoint(endpoint);
    const sub = await leer(env, kSub(h));
    if (!sub) return responder([]);
    const marcas = (await leer(env, kMar(h))) || {};
    const vistos = (await leer(env, kVis(h))) || {};
    const pendientes = (sub.avisos || [])
      .filter((a) => marcas[a.id]?.estado === "enviado" && !vistos[a.id])
      .map((a) => ({ id: a.id, titulo: a.titulo, cuerpo: a.cuerpo || "", url: a.url || "./", cuando: a.cuando }));
    return responder(pendientes);
  }

  if (accion === "mostrados" && request.method === "POST") {
    const datos = await leerJSON();
    if (!datos || typeof datos.endpoint !== "string" || !Array.isArray(datos.ids)) return responder({ error: "Faltan datos" }, 400);
    const h = await hashEndpoint(datos.endpoint);
    const vistos = (await leer(env, kVis(h))) || {};
    let cambiado = false;
    for (const id of datos.ids.slice(0, 200)) {
      if (typeof id === "string" && !vistos[id]) {
        vistos[id] = Date.now();
        cambiado = true;
      }
    }
    if (cambiado) await guardar(env, kVis(h), vistos);
    return responder({ ok: true });
  }

  if (accion === "baja" && request.method === "POST") {
    const datos = await leerJSON();
    if (!datos || typeof datos.endpoint !== "string") return responder({ error: "Falta el endpoint" }, 400);
    const h = await hashEndpoint(datos.endpoint);
    await env.AVISOS.delete(kSub(h));
    await env.AVISOS.delete(kMar(h));
    await env.AVISOS.delete(kVis(h));
    olvidarListaCache();
    return responder({ ok: true });
  }

  // Para comprobar a mano que el worker está vivo.
  if (accion === "" || accion === "salud") return responder({ ok: true, servicio: "avisos", hora: new Date().toISOString() });

  return responder({ error: "No existe" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await manejar(request, env);
    } catch (e) {
      return json({ error: e.message || String(e) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    const ahora = event?.scheduledTime ? Number(event.scheduledTime) : Date.now();
    const trabajo = pasada(env, ahora);
    if (ctx?.waitUntil) ctx.waitUntil(trabajo);
    return trabajo;
  },
};

// Para las pruebas locales (no lo usa Cloudflare).
export { pasada, cifrar, empujar, hashEndpoint, b64u };
