const modalRoot = document.getElementById("modal-root");
const modalScrim = document.getElementById("modal-scrim");
const modalContent = document.getElementById("modal-content");

const MODAL_TRANSITION_MS = 220;
let modalCloseTimeout = null;

export function openModal(html, { onMount, wide } = {}) {
  clearTimeout(modalCloseTimeout);
  modalContent.innerHTML = html;
  modalContent.classList.toggle("modal--wide", Boolean(wide));
  modalRoot.classList.remove("is-hidden");
  requestAnimationFrame(() => modalRoot.classList.add("is-open"));
  document.body.style.overflow = "hidden";
  if (onMount) onMount(modalContent);
}

export function closeModal() {
  modalRoot.classList.remove("is-open");
  document.body.style.overflow = "";
  modalCloseTimeout = setTimeout(() => {
    modalRoot.classList.add("is-hidden");
    modalContent.innerHTML = "";
  }, MODAL_TRANSITION_MS);
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
