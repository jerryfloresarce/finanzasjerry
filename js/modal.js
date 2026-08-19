import { bloquearScrollFondo, desbloquearScrollFondo } from "./scroll-lock.js?v=53";
import { efectoAlGuardar } from "./efectos.js?v=53";

const modalRoot = document.getElementById("modal-root");
const modalScrim = document.getElementById("modal-scrim");
const modalContent = document.getElementById("modal-content");

const MODAL_TRANSITION_MS = 220;
let modalCloseTimeout = null;
let activeOnClose = null;

// Confirmación visual al guardar: el destello del personaje. Se engancha
// aquí, en un único sitio, en vez de en el "submit" de cada formulario.
// No basta con escuchar el submit: si el guardado falla, el modal se queda
// abierto y no habría nada que celebrar. Por eso se apunta el momento del
// envío y solo se lanza el efecto si además el modal se cierra justo
// después — que es lo que hacen todos los formularios cuando les ha ido
// bien. Cancelar o cerrar sin enviar no dispara nada.
const MARGEN_TRAS_ENVIAR_MS = 2000;
let momentoDelEnvio = 0;

modalContent.addEventListener("submit", () => {
  momentoDelEnvio = Date.now();
});


// onClose: se llama SIEMPRE que el modal se cierra (Cancelar, click en el
// scrim, Escape, o un cierre tras guardar con éxito) — quien lo pasa es
// responsable de distinguir "se guardó" de "se canceló" (normalmente con
// una variable local `saved` que solo se pone a true justo antes de su
// propio closeModal() en el submit). Sirve para revertir un cambio óptimo
// en la fila que abrió el modal (p. ej. un checkbox) si al final no se guardó.
export function openModal(html, { onMount, wide, onClose } = {}) {
  clearTimeout(modalCloseTimeout);
  modalContent.innerHTML = html;
  modalContent.classList.toggle("modal--wide", Boolean(wide));
  modalRoot.classList.remove("is-hidden");
  requestAnimationFrame(() => modalRoot.classList.add("is-open"));
  bloquearScrollFondo("modal");
  activeOnClose = onClose || null;
  if (onMount) onMount(modalContent);
}

export function closeModal() {
  if (momentoDelEnvio && Date.now() - momentoDelEnvio < MARGEN_TRAS_ENVIAR_MS) {
    efectoAlGuardar();
  }
  momentoDelEnvio = 0;
  modalRoot.classList.remove("is-open");
  desbloquearScrollFondo("modal");
  modalCloseTimeout = setTimeout(() => {
    modalRoot.classList.add("is-hidden");
    modalContent.innerHTML = "";
  }, MODAL_TRANSITION_MS);
  if (activeOnClose) {
    const cb = activeOnClose;
    activeOnClose = null;
    cb();
  }
}

modalScrim.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalRoot.classList.contains("is-hidden")) closeModal();
});

export function optionsFrom(items, { value = "id", label = "nombre", selected } = {}) {
  return items
    .map((item) => {
      const v = item[value];
      const isSel = selected && String(selected) === String(v);
      return `<option value="${v}" ${isSel ? "selected" : ""}>${item[label]}</option>`;
    })
    .join("");
}

// El día de hoy SEGÚN EL RELOJ DE QUIEN LA USA. Antes salía de
// toISOString(), que es UTC: entre medianoche y las dos de la mañana en
// España devolvía el día anterior, así que un gasto apuntado a la 00:30 se
// guardaba con la fecha de ayer.
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
