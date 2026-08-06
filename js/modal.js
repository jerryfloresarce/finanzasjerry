import { bloquearScrollFondo, desbloquearScrollFondo } from "./scroll-lock.js?v=37";

const modalRoot = document.getElementById("modal-root");
const modalScrim = document.getElementById("modal-scrim");
const modalContent = document.getElementById("modal-content");

const MODAL_TRANSITION_MS = 220;
let modalCloseTimeout = null;
let activeOnClose = null;

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

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
