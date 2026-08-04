import { addCategoria, updateCategoria, deleteCategoria, gastosPorCategoriaDelMes, formatEUR } from "../db.js?v=24";
import { openModal, closeModal } from "../modal.js?v=24";
import { entityIcon, iconForCategoriaTipo, icon } from "../icons.js?v=24";
import { attachCopyId, copyIdButton } from "../copy-id.js?v=24";
import { emojiFieldHTML, attachEmojiPicker, CATEGORIA_EMOJIS } from "../emoji-picker.js?v=24";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=24";

const TIPOS = ["Fijo", "Variable", "Ocio", "PrestamoDado"];

export function mountCategorias() {
  document.getElementById("btn-add-categoria").addEventListener("click", () => openForm());
}

export function renderCategorias(state) {
  const el = document.getElementById("categorias-grid");
  const { categorias, movimientos } = state;

  if (categorias.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no has añadido ninguna categoría.</p>`;
    return;
  }

  const gastos = gastosPorCategoriaDelMes(movimientos, categorias);
  const totalByCat = new Map(gastos.map((g) => [g.categoria.id, g.total]));

  el.innerHTML = categorias
    .map((c) => {
      const gastado = totalByCat.get(c.id) || 0;
      return wrapSwipe(
        `
        <article class="entity-card">
          <div class="entity-card__top">
            <div class="entity-card__heading">
              <span class="icon-badge">${entityIcon(c, iconForCategoriaTipo(c.tipo))}</span>
              <p class="entity-card__name">${c.nombre}</p>
            </div>
            <div class="entity-card__top-actions">
              <span class="entity-card__tag">${c.tipo}</span>
              <button type="button" class="row-edit-btn" data-edit="${c.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>
          </div>
          <p class="entity-card__amount">${formatEUR(gastado)}</p>
          <p class="entity-card__meta">${c.limite_mensual ? `Límite mensual ${formatEUR(c.limite_mensual)}` : "Sin límite mensual"}</p>
          <div class="entity-card__actions">
            ${copyIdButton(c.id)}
          </div>
        </article>`,
        c.id
      );
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(categorias.find((c) => c.id === btn.dataset.edit)))
  );
  attachSwipe(el, (id) => {
    if (confirm("¿Eliminar esta categoría?")) deleteCategoria(id);
  });
  attachCopyId(el);
}

function openForm(categoria) {
  const isEdit = Boolean(categoria);
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar categoría" : "Nueva categoría"}</h2>
    <form id="form-categoria" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Nombre</span>
        <input type="text" name="nombre" required value="${categoria?.nombre ?? ""}" placeholder="Comida a domicilio" />
      </label>
      <label class="field">
        <span class="field__label">Tipo</span>
        <select name="tipo">
          ${TIPOS.map((t) => `<option ${categoria?.tipo === t ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Límite mensual (opcional)</span>
        <input type="number" step="0.01" name="limite_mensual" value="${categoria?.limite_mensual ?? ""}" placeholder="0.00" />
      </label>
      ${emojiFieldHTML(categoria?.icono, CATEGORIA_EMOJIS)}
      <p class="field-error" id="form-categoria-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Guardar" : "Añadir"}</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        attachEmojiPicker(root);
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-categoria").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            nombre: f.nombre.value.trim(),
            tipo: f.tipo.value,
            limite_mensual: f.limite_mensual.value ? Number(f.limite_mensual.value) : null,
            icono: f.icono.value.trim() || null,
          };
          try {
            if (isEdit) await updateCategoria(categoria.id, data);
            else await addCategoria(data);
            closeModal();
          } catch (err) {
            root.querySelector("#form-categoria-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
