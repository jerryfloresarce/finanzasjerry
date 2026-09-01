import { bloquearScrollFondo, desbloquearScrollFondo } from "./scroll-lock.js?v=110";
import { efectoAlGuardar } from "./efectos.js?v=110";

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
  arreglarCamposDeNumero(modalContent);
  if (onMount) onMount(modalContent);
}

// El teclado del iPhone en español escribe COMA para los decimales. Y un
// <input type="number"> se come la coma sin decir nada: al escribir "1,49"
// el valor que queda es "149", y el campo se da por válido. O sea que un
// pago de 1,49 € se guardaba como 149 € y no avisaba nadie.
//
// Se arregla aquí, en un solo sitio, y no campo a campo por las vistas:
// cada casilla de número se convierte en una de texto con teclado numérico
// (inputmode="decimal", que en el móvil sigue saliendo el teclado de
// números) y se limpia lo que se escribe, cambiando la coma por el punto.
// Así el Number(...) que hace cada formulario al guardar sigue valiendo tal
// cual, sin tocar ninguna vista.
function arreglarCamposDeNumero(root) {
  root.querySelectorAll('input[type="number"]').forEach((input) => {
    const permiteNegativos = input.min === undefined || input.min === "" || Number(input.min) < 0;
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    if (input.value) input.value = String(input.value).replace(",", ".");
    input.addEventListener("input", () => {
      const cursorAlFinal = input.selectionStart === input.value.length;
      let v = input.value.replace(",", ".").replace(permiteNegativos ? /[^0-9.-]/g : /[^0-9.]/g, "");
      // Un solo punto, y el menos solo al principio.
      const partes = v.split(".");
      if (partes.length > 2) v = partes[0] + "." + partes.slice(1).join("");
      if (permiteNegativos) v = (v.startsWith("-") ? "-" : "") + v.replace(/-/g, "");
      if (v !== input.value) {
        input.value = v;
        if (cursorAlFinal) input.setSelectionRange(v.length, v.length);
      }
    });
  });
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

// Texto del usuario dentro de HTML generado: SIEMPRE por aquí. Sin esto,
// unas comillas dobles en un nombre truncan el value="..." de un
// formulario al reabrirlo (y al guardar se pierde el resto del texto), y
// un "<" rompe el marcado. Vale igual para atributos (con comillas
// dobles) y para contenido; dataset.* devuelve el texto ya descodificado.
export function esc(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function optionsFrom(items, { value = "id", label = "nombre", selected } = {}) {
  return items
    .map((item) => {
      const v = item[value];
      const isSel = selected && String(selected) === String(v);
      return `<option value="${esc(v)}" ${isSel ? "selected" : ""}>${esc(item[label])}</option>`;
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
