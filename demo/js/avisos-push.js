// Avisos en el móvil con la app cerrada: la parte que vive en la app.
//
// Pide permiso, registra el service worker (sw.js), se suscribe al canal de
// avisos del navegador, y cada vez que cambian los datos recalcula la lista
// de avisos de los próximos 30 días y se la manda al servidor (worker/). La
// tarjeta de Ajustes solo dice "activados" cuando el servidor lo confirma.
import { URL_AVISOS } from "./config-avisos.js?v=135";
import { calcularAvisos, huellaDeAvisos } from "./avisos-calculo.js?v=135";
import { state } from "./store.js?v=135";
import { formatEUR, fromTimestamp } from "./db.js?v=135";
import { avisosCobroActivos } from "./views/prestamos.js?v=135";
import { esc } from "./modal.js?v=135";

const CLAVE_LOCAL = "fj-avisos-push";
const VERSION_SW = new URL(import.meta.url).searchParams.get("v") || "0";

const leerLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || "null") || {};
  } catch {
    return {};
  }
};
const guardarLocal = (datos) => {
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(datos));
  } catch {
    /* sin almacenamiento: la próxima apertura volverá a preguntar */
  }
};

const soportado = () => typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const esIPhoneSinInstalar = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.standalone !== true;

function b64uABytes(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const relleno = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Uint8Array.from(atob(s + relleno), (c) => c.charCodeAt(0));
}

const rutaSW = () => `sw.js?v=${VERSION_SW}&avisos=${encodeURIComponent(URL_AVISOS)}`;

async function registro() {
  return navigator.serviceWorker.register(rutaSW());
}

async function suscripcionActual() {
  if (!soportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function listaActual() {
  let vidaDatos = null;
  let bloques = null;
  let cumplido = null;
  let dia = null;
  return calcularAvisos({
    state,
    vida: vidaDatos,
    bloquesDelDia: bloques,
    esCumplido: cumplido,
    diaPorFecha: dia,
    formatEUR,
    fromTimestamp,
    avisosCobroActivos: avisosCobroActivos(state.config),
  });
}

async function enviarLista(suscripcion, forzar = false) {
  const avisos = listaActual();
  const huella = huellaDeAvisos(avisos);
  const local = leerLocal();
  if (!forzar && local.huella === huella && local.endpoint === suscripcion.endpoint) return { ok: true, sinCambios: true, avisos: avisos.length };
  const r = await fetch(`${URL_AVISOS}/api/avisos/sincronizar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ suscripcion: suscripcion.toJSON ? suscripcion.toJSON() : suscripcion, avisos, etiqueta: navigator.userAgent.slice(0, 80) }),
  });
  if (!r.ok) throw new Error(`El servidor de avisos respondió ${r.status}`);
  guardarLocal({ ...local, activo: true, endpoint: suscripcion.endpoint, huella, ultimaSync: Date.now() });
  return { ok: true, avisos: avisos.length };
}

// ---------- acciones ----------

export async function activarAvisosPush() {
  if (!URL_AVISOS) return { ok: false, motivo: "El servidor de avisos aún no está configurado." };
  if (!soportado()) {
    return {
      ok: false,
      motivo: esIPhoneSinInstalar()
        ? "En iPhone solo funciona con la app en la pantalla de inicio: Compartir → Añadir a pantalla de inicio, y activa desde ahí."
        : "Este navegador no permite avisos con la app cerrada.",
    };
  }
  const reg = await registro();
  await navigator.serviceWorker.ready;
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return { ok: false, motivo: "No diste permiso para los avisos. Puedes cambiarlo en los ajustes del navegador." };
  const clave = (await (await fetch(`${URL_AVISOS}/api/avisos/clave`)).json()).clave;
  let sus = await reg.pushManager.getSubscription();
  if (!sus) sus = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uABytes(clave) });
  const resultado = await enviarLista(sus, true);
  return { ok: true, avisos: resultado.avisos };
}

export async function desactivarAvisosPush() {
  const sus = await suscripcionActual().catch(() => null);
  if (sus) {
    try {
      await fetch(`${URL_AVISOS}/api/avisos/baja`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sus.endpoint }) });
    } catch {
      /* el servidor lo borrará solo cuando el móvil responda 410 */
    }
    await sus.unsubscribe().catch(() => {});
  }
  guardarLocal({ activo: false });
}

export async function probarAvisosPush() {
  const sus = await suscripcionActual();
  if (!sus) return { ok: false, motivo: "Este móvil no está suscrito: activa los avisos primero." };
  const r = await fetch(`${URL_AVISOS}/api/avisos/prueba`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ suscripcion: sus.toJSON(), titulo: "Aviso de prueba", cuerpo: "Si ves esto, los avisos funcionan en este móvil." }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok ? { ok: true } : { ok: false, motivo: j.motivo || `El servidor respondió ${r.status}` };
}

export async function estadoAvisosPush() {
  if (!URL_AVISOS) return { configurado: false };
  const sus = await suscripcionActual().catch(() => null);
  if (!sus) return { configurado: true, activo: false };
  try {
    const r = await fetch(`${URL_AVISOS}/api/avisos/estado?endpoint=${encodeURIComponent(sus.endpoint)}`);
    const j = await r.json();
    return { configurado: true, activo: Boolean(j.suscrito), ...j };
  } catch {
    return { configurado: true, activo: true, sinRespuesta: true };
  }
}

// Sincroniza la lista si los avisos están activos en este móvil. Se llama en
// cada repintado; solo habla con el servidor si la lista cambió, y como
// mucho una vez cada pocos segundos.
let temporizador = null;
export function sincronizarAvisosPush() {
  if (!URL_AVISOS || !leerLocal().activo || !state.ready) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(async () => {
    try {
      const sus = await suscripcionActual();
      if (sus) await enviarLista(sus);
    } catch {
      /* sin red: se reintenta en el siguiente cambio */
    }
  }, 4000);
}

// ---------- la tarjeta de Ajustes ----------

function pintarEstado(html, clase = "") {
  const el = document.getElementById("avisos-push-estado");
  if (!el) return;
  el.innerHTML = html;
  el.className = `entity-card__meta avisos-push__estado ${clase}`.trim();
}

function mostrarBotones({ activar = false, probar = false, desactivar = false }) {
  document.getElementById("btn-avisos-activar")?.classList.toggle("is-hidden", !activar);
  document.getElementById("btn-avisos-probar")?.classList.toggle("is-hidden", !probar);
  document.getElementById("btn-avisos-desactivar")?.classList.toggle("is-hidden", !desactivar);
}

export async function renderAvisosPush() {
  if (!document.getElementById("avisos-push")) return;
  if (!URL_AVISOS) {
    pintarEstado("El servidor de avisos aún no está configurado.");
    mostrarBotones({});
    return;
  }
  pintarEstado("Comprobando…");
  const e = await estadoAvisosPush();
  if (!e.activo) {
    pintarEstado(
      soportado()
        ? "Sin activar en este móvil."
        : esIPhoneSinInstalar()
          ? "En iPhone solo funciona con la app en la pantalla de inicio (Compartir → Añadir a pantalla de inicio)."
          : "Este navegador no permite avisos con la app cerrada."
    );
    mostrarBotones({ activar: soportado() });
    return;
  }
  if (e.sinRespuesta) {
    pintarEstado("Activados en este móvil, pero ahora mismo no puedo comprobar el servidor.", "avisos-push__estado--aviso");
    mostrarBotones({ probar: true, desactivar: true });
    return;
  }
  const perdidos = Array.isArray(e.perdidos) ? e.perdidos : [];
  const partes = [`✓ Avisos activados · ${e.avisos ?? 0} programados`];
  if (e.enviados) partes.push(`${e.enviados} enviados`);
  let html = esc(partes.join(" · "));
  if (perdidos.length) {
    html += `<br><span class="avisos-push__perdidos">${perdidos.length === 1 ? "1 aviso no llegó" : `${perdidos.length} avisos no llegaron`}: ${esc(perdidos[0].motivo || "")}</span>`;
  }
  pintarEstado(html, perdidos.length ? "avisos-push__estado--aviso" : "avisos-push__estado--ok");
  mostrarBotones({ probar: true, desactivar: true });
}

export function mountAvisosPush() {
  document.getElementById("btn-avisos-activar")?.addEventListener("click", async () => {
    pintarEstado("Activando…");
    try {
      const r = await activarAvisosPush();
      if (!r.ok) {
        pintarEstado(esc(r.motivo), "avisos-push__estado--aviso");
        return;
      }
    } catch (err) {
      pintarEstado(esc(`No se pudo activar: ${err.message}`), "avisos-push__estado--aviso");
      return;
    }
    await renderAvisosPush();
  });
  document.getElementById("btn-avisos-probar")?.addEventListener("click", async () => {
    pintarEstado("Mandando el aviso de prueba…");
    const r = await probarAvisosPush().catch((err) => ({ ok: false, motivo: err.message }));
    pintarEstado(r.ok ? "Enviado. Tiene que aparecer en este móvil en unos segundos." : esc(r.motivo), r.ok ? "avisos-push__estado--ok" : "avisos-push__estado--aviso");
    setTimeout(renderAvisosPush, 6000);
  });
  document.getElementById("btn-avisos-desactivar")?.addEventListener("click", async () => {
    await desactivarAvisosPush();
    await renderAvisosPush();
  });
  // Al tocar una notificación, el service worker pide ir a una sección sin
  // recargar la app.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (ev) => {
      if (ev.data?.tipo === "ir" && typeof ev.data.url === "string") {
        const hash = new URL(ev.data.url).hash;
        if (hash) location.hash = hash;
      }
    });
    // Si los avisos ya estaban activos, el service worker se registra al
    // arrancar (así también recoge una versión nueva del sw.js).
    if (URL_AVISOS && leerLocal().activo) registro().catch(() => {});
  }
}
