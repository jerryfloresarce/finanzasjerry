// Gesto compartido de "deslizar para eliminar": envuelve una fila o
// tarjeta en un contenedor con un botón rojo "Eliminar" detrás, que se
// revela al arrastrar el contenido hacia la izquierda. Se usa en vez de
// un botón "Eliminar" siempre visible, en todas las listas de la app.

import { animarFilaAlEliminar } from "./efectos.js?v=69";

const REVEAL_PX = 88;
const DRAG_LOCK_THRESHOLD = 8;

let lastOpen = null;

export function wrapSwipe(innerHTML, id) {
  return `
    <div class="swipe-row" data-swipe-row="${id}">
      <button type="button" class="swipe-row__action" data-swipe-delete="${id}">Eliminar</button>
      <div class="swipe-row__content" data-swipe-content="${id}">${innerHTML}</div>
    </div>`;
}

function closeRow(content, row) {
  content.style.transform = "translateX(0)";
  // row puede no existir si esa fila ya se borró de la pantalla (al eliminar
  // un elemento, la lista entera se vuelve a pintar y la fila que estaba
  // deslizada desaparece con ella).
  row?.classList.remove("is-open");
  if (lastOpen === content) lastOpen = null;
}

// container: elemento ya insertado en el DOM cuyos HIJOS DIRECTOS son una o
// más `[data-swipe-row]` (normalmente el resultado de varios wrapSwipe()
// unidos con join("")). Se usa ":scope > " para no engancharse a listas
// anidadas (p. ej. los pagos dentro de una tarjeta de préstamo, que llevan
// su propio attachSwipe con su propio onDelete).
// onDelete(id): se llama al tocar el botón rojo "Eliminar".
// confirmar: texto de la pregunta de seguridad. La pregunta se hace aquí y
// no en cada vista para poder encadenar bien las tres cosas: preguntar,
// despedir la fila con la animación del tema, y solo entonces borrar. Si se
// borrara antes, la lista se volvería a pintar a los pocos milisegundos y
// la fila desaparecería de golpe sin que diera tiempo a ver nada.
export function attachSwipe(container, onDelete, { confirmar } = {}) {
  // Si la fila que quedó deslizada ya no está en el documento (su lista se
  // volvió a pintar), se suelta la referencia: si no, se quedaba apuntando
  // a un nodo muerto que ya nadie puede cerrar ni ver.
  if (lastOpen && !lastOpen.isConnected) lastOpen = null;

  container.querySelectorAll(":scope > [data-swipe-row]").forEach((row) => {
    const content = row.querySelector("[data-swipe-content]");
    const deleteBtn = row.querySelector("[data-swipe-delete]");
    if (!content || !deleteBtn) return;

    deleteBtn.addEventListener("click", async () => {
      if (confirmar && !window.confirm(confirmar)) return;
      await animarFilaAlEliminar(row);
      onDelete(row.dataset.swipeRow);
    });

    let startX = null;
    let startY = null;
    let startTranslate = 0;
    let dragging = null;

    content.addEventListener(
      "touchstart",
      (e) => {
        if (lastOpen && lastOpen !== content) {
          const openRow = lastOpen.closest("[data-swipe-row]");
          closeRow(lastOpen, openRow);
        }
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTranslate = row.classList.contains("is-open") ? -REVEAL_PX : 0;
        dragging = null;
      },
      { passive: true }
    );

    content.addEventListener(
      "touchmove",
      (e) => {
        if (startX === null) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        if (dragging === null) {
          if (Math.abs(deltaX) < DRAG_LOCK_THRESHOLD && Math.abs(deltaY) < DRAG_LOCK_THRESHOLD) return;
          dragging = Math.abs(deltaX) > Math.abs(deltaY);
          if (dragging) content.classList.add("swipe-row__content--dragging");
        }
        if (!dragging) return;
        e.preventDefault();
        const translate = Math.max(-REVEAL_PX, Math.min(0, startTranslate + deltaX));
        content.style.transform = `translateX(${translate}px)`;
      },
      { passive: false }
    );

    content.addEventListener(
      "touchend",
      (e) => {
        if (startX === null) {
          return;
        }
        if (!dragging) {
          startX = null;
          return;
        }
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - startX;
        const finalTranslate = Math.max(-REVEAL_PX, Math.min(0, startTranslate + deltaX));
        const open = finalTranslate < -REVEAL_PX / 2;
        content.classList.remove("swipe-row__content--dragging");
        content.style.transform = open ? `translateX(-${REVEAL_PX}px)` : "translateX(0)";
        row.classList.toggle("is-open", open);
        lastOpen = open ? content : lastOpen === content ? null : lastOpen;
        startX = null;
        startY = null;
        dragging = null;
      },
      { passive: true }
    );
  });
}
