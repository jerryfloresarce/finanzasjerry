const modalRoot = document.getElementById("modal-root");
const modalScrim = document.getElementById("modal-scrim");
const modalContent = document.getElementById("modal-content");

export function openModal(html, { onMount } = {}) {
  modalContent.innerHTML = html;
  modalRoot.classList.remove("is-hidden");
  document.body.style.overflow = "hidden";
  if (onMount) onMount(modalContent);
}

export function closeModal() {
  modalRoot.classList.add("is-hidden");
  modalContent.innerHTML = "";
  document.body.style.overflow = "";
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
