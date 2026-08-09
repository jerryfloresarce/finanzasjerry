// Bloqueo del scroll de fondo mientras hay algo abierto por encima (un
// modal, el menú móvil o el panel de Mi cuenta).
//
// Poner `overflow: hidden` en el body —que es lo que se hacía antes— NO
// funciona en Safari de iOS: la página de detrás se sigue arrastrando con
// el dedo igualmente. Lo único fiable ahí es sacar el body del flujo con
// `position: fixed` y compensar el desplazamiento con `top`, para que la
// página no dé un salto al principio ni al final.
//
// Cada capa se identifica con un nombre ("modal", "nav", "panel") en vez de
// llevar un simple contador: así da igual que se pida bloquear dos veces
// seguidas lo mismo (el modal, por ejemplo, se vuelve a abrir sobre sí
// mismo al repintarse) — no se descuadra la cuenta y el fondo se suelta
// solo cuando ya no queda ninguna capa abierta.

const capasAbiertas = new Set();
let scrollGuardado = 0;

export function bloquearScrollFondo(clave) {
  if (capasAbiertas.has(clave)) return;
  const eraElPrimero = capasAbiertas.size === 0;
  capasAbiertas.add(clave);
  if (!eraElPrimero) return;

  scrollGuardado = window.scrollY;
  const body = document.body;
  body.style.position = "fixed";
  body.style.top = `-${scrollGuardado}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

export function desbloquearScrollFondo(clave) {
  if (!capasAbiertas.delete(clave)) return;
  if (capasAbiertas.size > 0) return;

  const body = document.body;
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.overflow = "";
  // Devolver la página justo donde estaba: al quitar el position:fixed el
  // navegador la deja arriba del todo si no se restaura a mano.
  window.scrollTo(0, scrollGuardado);
}
