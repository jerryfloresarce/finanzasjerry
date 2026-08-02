import {
  addMovimiento,
  updateMovimiento,
  deleteMovimiento,
  formatEUR,
  formatFecha,
  fromTimestamp,
  toTimestamp,
} from "../db.js";
import { openModal, closeModal, optionsFrom, todayISO } from "../modal.js";
import { icon, iconForCategoriaTipo } from "../icons.js";

export function mountMovimientos() {
  document.getElementById("btn-add-movimiento").addEventListener("click", () => openForm(null, currentState));
}

let currentState = null;

export function renderMovimientos(state) {
  currentState = state;
  const el = document.getElementById("movimientos-table");
  const { movimientos, categorias, cuentas } = state;
  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c.nombre]));

  if (movimientos.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no hay movimientos.</p>`;
    return;
  }

  const ordenados = [...movimientos].sort(
    (a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0)
  );

  el.innerHTML =
    `<div class="data-row data-row--head">
      <span>Fecha</span><span>Nota / Categoría</span><span>Cuenta</span><span>Importe</span><span></span>
    </div>` +
    ordenados
      .map((m) => {
        const cat = catMap.get(m.categoria_id);
        return `
      <div class="data-row">
        <span>${formatFecha(fromTimestamp(m.fecha))}</span>
        <span class="data-row__cat"><span class="mini-row__icon">${icon(iconForCategoriaTipo(cat?.tipo), { size: 14 })}</span>${m.subcategoria ? "<strong>" + m.subcategoria + "</strong> · " : ""}${cat?.nombre || "—"}${m.nota ? " · " + m.nota : ""}</span>
        <span>${cuentaMap.get(m.cuenta_id) || "—"}</span>
        <span class="data-row__amount--${m.tipo}">${m.tipo === "Ingreso" ? "+" : "−"} ${formatEUR(Math.abs(Number(m.importe)))}</span>
        <span class="data-row__actions">
          <button class="btn btn--ghost btn--sm" data-edit="${m.id}">Editar</button>
          <button class="btn btn--danger btn--sm" data-delete="${m.id}">Eliminar</button>
        </span>
      </div>`;
      })
      .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(movimientos.find((m) => m.id === btn.dataset.edit), state))
  );
  el.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("¿Eliminar este movimiento?")) deleteMovimiento(btn.dataset.delete);
    })
  );
}

function openForm(movimiento, state) {
  const isEdit = Boolean(movimiento);
  const fechaValue = movimiento ? fromTimestamp(movimiento.fecha).toISOString().slice(0, 10) : todayISO();

  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar movimiento" : "Añadir movimiento"}</h2>
    <form id="form-movimiento" class="form-grid">
      <label class="field">
        <span class="field__label">Tipo</span>
        <select name="tipo">
          <option value="Gasto" ${movimiento?.tipo === "Gasto" ? "selected" : ""}>Gasto</option>
          <option value="Ingreso" ${movimiento?.tipo === "Ingreso" ? "selected" : ""}>Ingreso</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">Importe</span>
        <input type="number" step="0.01" min="0" name="importe" required value="${movimiento ? Math.abs(movimiento.importe) : ""}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Categoría</span>
        <select name="categoria_id" required>${optionsFrom(state.categorias, { selected: movimiento?.categoria_id })}</select>
      </label>
      <label class="field">
        <span class="field__label">Cuenta</span>
        <select name="cuenta_id" required>${optionsFrom(state.cuentas, { selected: movimiento?.cuenta_id })}</select>
      </label>
      <label class="field">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${fechaValue}" required />
      </label>
      <label class="field">
        <span class="field__label">Subcategoría (opcional)</span>
        <input type="text" name="subcategoria" value="${movimiento?.subcategoria ?? ""}" placeholder="Five Guys, Zara…" />
      </label>
      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="nota" value="${movimiento?.nota ?? ""}" placeholder="Mercadona, Glovo, nómina…" />
      </label>
      <p class="field-error" id="form-movimiento-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Guardar" : "Añadir"}</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-movimiento").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            tipo: f.tipo.value,
            importe: Number(f.importe.value),
            categoria_id: f.categoria_id.value,
            cuenta_id: f.cuenta_id.value,
            fecha: toTimestamp(f.fecha.value),
            subcategoria: f.subcategoria.value.trim(),
            nota: f.nota.value.trim(),
          };
          try {
            if (isEdit) await updateMovimiento(movimiento.id, data);
            else await addMovimiento(data);
            closeModal();
          } catch (err) {
            root.querySelector("#form-movimiento-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
