// Botón pequeño para copiar el ID de Firestore de una cuenta/categoría —
// lo necesitas para configurar el Shortcut de iPhone (ver SETUP.md).
import { icon } from "./icons.js?v=62";

export function copyIdButton(id) {
  return `<button type="button" class="btn btn--ghost btn--sm" data-copy-id="${id}" title="Copiar ID de Firestore">${icon("copy", { size: 14 })}</button>`;
}

export function attachCopyId(container) {
  container.querySelectorAll("[data-copy-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copyId);
      } catch (err) {
        return;
      }
      const original = btn.innerHTML;
      btn.innerHTML = icon("check", { size: 14 });
      setTimeout(() => {
        btn.innerHTML = original;
      }, 1200);
    });
  });
}
