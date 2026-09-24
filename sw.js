// El service worker de la app: SOLO avisos. No guarda copia de la app (la
// app se sirve siempre fresca con su ?v=), así que nunca puede dejar una
// versión vieja pegada en el móvil. Recibe los empujones del servidor de
// avisos y los enseña aunque la app esté cerrada.
const URL_AVISOS = new URL(self.location.href).searchParams.get("avisos") || "";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(atenderEmpujon(event));
});

async function atenderEmpujon(event) {
  let aviso = null;
  try {
    aviso = event.data ? event.data.json() : null;
  } catch {
    aviso = null;
  }
  if (aviso && aviso.titulo) {
    await mostrar(aviso);
    await confirmar([aviso.id]);
    return;
  }
  // Un empujón sin contenido (pasa): preguntar al servidor qué tocaba.
  let pendientes = [];
  try {
    const sus = await self.registration.pushManager.getSubscription();
    if (URL_AVISOS && sus) {
      const r = await fetch(`${URL_AVISOS}/api/avisos/pendientes?endpoint=${encodeURIComponent(sus.endpoint)}`);
      pendientes = await r.json();
    }
  } catch {
    pendientes = [];
  }
  if (!Array.isArray(pendientes) || pendientes.length === 0) {
    // Siempre hay que enseñar algo: si el navegador ve un empujón sin
    // notificación, le retira el permiso a la app.
    await mostrar({ id: `vacio_${Date.now()}`, titulo: "Tienes un aviso", cuerpo: "Abre la app para verlo.", url: "./" });
    return;
  }
  for (const a of pendientes) await mostrar(a);
  await confirmar(pendientes.map((a) => a.id));
}

function mostrar(aviso) {
  const hora = Date.parse(aviso.cuando);
  return self.registration.showNotification(aviso.titulo, {
    body: aviso.cuerpo || "",
    icon: "assets/icono-192.png",
    badge: "assets/icono-192.png",
    tag: aviso.id, // el mismo id dos veces = una sola notificación
    timestamp: Number.isNaN(hora) ? Date.now() : hora,
    vibrate: [200, 100, 200],
    data: { url: aviso.url || "./" },
  });
}

async function confirmar(ids) {
  try {
    const sus = await self.registration.pushManager.getSubscription();
    if (!URL_AVISOS || !sus) return;
    await fetch(`${URL_AVISOS}/api/avisos/mostrados`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sus.endpoint, ids }),
    });
  } catch {
    /* sin red: no pasa nada, el servidor lo dará por enseñado la próxima vez */
  }
}

// Tocar la notificación: trae la app al frente y le dice a qué sección ir
// SIN recargarla (recargar tira lo que hubiera a medias).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "./", self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const propia = ventanas.find((v) => v.url.startsWith(self.registration.scope));
      if (propia) {
        await propia.focus();
        propia.postMessage({ tipo: "ir", url: destino });
        return;
      }
      await self.clients.openWindow(destino);
    })()
  );
});
