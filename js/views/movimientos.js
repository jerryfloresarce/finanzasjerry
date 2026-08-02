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
        const esTransferencia = m.tipo === "Transferencia";
        const catCell = esTransferencia
          ? `<span class="mini-row__icon">${icon("movimientos", { size: 14 })}</span>Transferencia${m.nota ? " · " + m.nota : ""}`
          : `<span class="mini-row__icon">${icon(iconForCategoriaTipo(cat?.tipo), { size: 14 })}</span>${m.subcategoria ? "<strong>" + m.subcategoria + "</strong> · " : ""}${cat?.nombre || "—"}${m.nota ? " · " + m.nota : ""}`;
        const cuentaCell = esTransferencia
          ? `${cuentaMap.get(m.cuenta_id) || "—"} → ${cuentaMap.get(m.cuenta_destino_id) || "—"}`
          : cuentaMap.get(m.cuenta_id) || "—";
        const amountClass = esTransferencia ? "" : `data-row__amount--${m.tipo}`;
        const amountSign = esTransferencia ? "" : m.tipo === "Ingreso" ? "+ " : "− ";
        return `
      <div class="data-row">
        <span>${formatFecha(fromTimestamp(m.fecha))}</span>
        <span class="data-row__cat">${catCell}</span>
        <span>${cuentaCell}</span>
        <span class="${amountClass}">${amountSign}${formatEUR(Math.abs(Number(m.importe)))}</span>
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
        <select name="tipo" id="movimiento-tipo">
          <option value="Gasto" ${movimiento?.tipo === "Gasto" ? "selected" : ""}>Gasto</option>
          <option value="Ingreso" ${movimiento?.tipo === "Ingreso" ? "selected" : ""}>Ingreso</option>
          <option value="Transferencia" ${movimiento?.tipo === "Transferencia" ? "selected" : ""}>Transferencia entre cuentas</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">Importe</span>
        <input type="number" step="0.01" min="0" name="importe" required value="${movimiento ? Math.abs(movimiento.importe) : ""}" placeholder="0.00" />
      </label>
      <label class="field" id="campo-categoria">
        <span class="field__label">Categoría</span>
        <select name="categoria_id">${optionsFrom(state.categorias, { selected: movimiento?.categoria_id })}</select>
      </label>
      <label class="field">
        <span class="field__label" id="etiqueta-cuenta">Cuenta</span>
        <select name="cuenta_id" required>${optionsFrom(state.cuentas, { selected: movimiento?.cuenta_id })}</select>
      </label>
      <label class="field is-hidden" id="campo-cuenta-destino">
        <span class="field__label">Cuenta destino</span>
        <select name="cuenta_destino_id">${optionsFrom(state.cuentas, { selected: movimiento?.cuenta_destino_id })}</select>
      </label>
      <label class="field">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${fechaValue}" required />
      </label>
      <label class="field" id="campo-subcategoria">
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
        const tipoSelect = root.querySelector("#movimiento-tipo");
        const campoCategoria = root.querySelector("#campo-categoria");
        const campoCuentaDestino = root.querySelector("#campo-cuenta-destino");
        const campoSubcategoria = root.querySelector("#campo-subcategoria");
        const etiquetaCuenta = root.querySelector("#etiqueta-cuenta");

        function toggleCampos() {
          const esTransferencia = tipoSelect.value === "Transferencia";
          campoCategoria.classList.toggle("is-hidden", esTransferencia);
          campoCuentaDestino.classList.toggle("is-hidden", !esTransferencia);
          campoSubcategoria.classList.toggle("is-hidden", esTransferencia);
          etiquetaCuenta.textContent = esTransferencia ? "Cuenta origen" : "Cuenta";
          root.querySelector("[name=categoria_id]").required = !esTransferencia;
          root.querySelector("[name=cuenta_destino_id]").required = esTransferencia;
        }
        tipoSelect.addEventListener("change", toggleCampos);
        toggleCampos();

        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-movimiento").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const esTransferencia = f.tipo.value === "Transferencia";
          const data = {
            tipo: f.tipo.value,
            importe: Number(f.importe.value),
            categoria_id: esTransferencia ? null : f.categoria_id.value,
            cuenta_id: f.cuenta_id.value,
            cuenta_destino_id: esTransferencia ? f.cuenta_destino_id.value : null,
            fecha: toTimestamp(f.fecha.value),
            subcategoria: esTransferencia ? "" : f.subcategoria.value.trim(),
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
