import { addSuscripcion, updateSuscripcion, deleteSuscripcion, formatEUR, formatFecha } from "../db.js";
import { openModal, closeModal, optionsFrom, todayISO } from "../modal.js";

let currentState = null;

export function mountSuscripciones() {
  document.getElementById("btn-add-suscripcion").addEventListener("click", () => openForm(null, currentState));
}

export function renderSuscripciones(state) {
  currentState = state;
  const el = document.getElementById("suscripciones-grid");
  const { suscripciones, categorias, cuentas } = state;
  const catMap = new Map(categorias.map((c) => [c.id, c.nombre]));
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c.nombre]));

  if (suscripciones.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no has añadido ninguna suscripción.</p>`;
    return;
  }

  el.innerHTML = suscripciones
    .map((s) => {
      const proximo = s.proximo_pago ? formatFecha(new Date(s.proximo_pago)) : "—";
      return `
        <article class="entity-card">
          <div class="entity-card__top">
            <p class="entity-card__name">${s.nombre}</p>
            <span class="entity-card__tag ${s.activa === false ? "entity-card__tag--pagado" : "entity-card__tag--activo"}">${s.activa === false ? "Inactiva" : s.frecuencia}</span>
          </div>
          <p class="entity-card__amount">${formatEUR(s.precio)}</p>
          <p class="entity-card__meta">${catMap.get(s.categoria_id) || "—"} · ${cuentaMap.get(s.cuenta_id) || "—"}</p>
          <p class="entity-card__meta">Próximo pago: ${proximo}</p>
          <div class="entity-card__actions">
            <button class="btn btn--ghost btn--sm" data-edit="${s.id}">Editar</button>
            <button class="btn btn--danger btn--sm" data-delete="${s.id}">Eliminar</button>
          </div>
        </article>`;
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(suscripciones.find((s) => s.id === btn.dataset.edit), currentState))
  );
  el.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("¿Eliminar esta suscripción?")) deleteSuscripcion(btn.dataset.delete);
    })
  );
}

function openForm(suscripcion, state) {
  const isEdit = Boolean(suscripcion);
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar suscripción" : "Nueva suscripción"}</h2>
    <form id="form-suscripcion" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Nombre</span>
        <input type="text" name="nombre" required value="${suscripcion?.nombre ?? ""}" placeholder="Glovo Prime" />
      </label>
      <label class="field">
        <span class="field__label">Precio</span>
        <input type="number" step="0.01" name="precio" required value="${suscripcion?.precio ?? ""}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Frecuencia</span>
        <select name="frecuencia">
          <option ${suscripcion?.frecuencia === "Mensual" ? "selected" : ""}>Mensual</option>
          <option ${suscripcion?.frecuencia === "Anual" ? "selected" : ""}>Anual</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">Categoría</span>
        <select name="categoria_id">${optionsFrom(state.categorias, { selected: suscripcion?.categoria_id })}</select>
      </label>
      <label class="field">
        <span class="field__label">Cuenta</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: suscripcion?.cuenta_id })}</select>
      </label>
      <label class="field">
        <span class="field__label">Próximo pago</span>
        <input type="date" name="proximo_pago" value="${suscripcion?.proximo_pago ?? todayISO()}" />
      </label>
      <label class="field-check field--full">
        <input type="checkbox" name="activa" ${suscripcion?.activa !== false ? "checked" : ""} />
        Suscripción activa
      </label>
      <p class="field-error" id="form-suscripcion-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Guardar" : "Añadir"}</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-suscripcion").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            nombre: f.nombre.value.trim(),
            precio: Number(f.precio.value),
            frecuencia: f.frecuencia.value,
            categoria_id: f.categoria_id.value,
            cuenta_id: f.cuenta_id.value,
            proximo_pago: f.proximo_pago.value,
            activa: f.activa.checked,
          };
          try {
            if (isEdit) await updateSuscripcion(suscripcion.id, data);
            else await addSuscripcion(data);
            closeModal();
          } catch (err) {
            root.querySelector("#form-suscripcion-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
