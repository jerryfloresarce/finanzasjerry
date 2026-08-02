import { addCuenta, updateCuenta, deleteCuenta, calcularSaldoCuenta, formatEUR, formatFecha } from "../db.js";
import { openModal, closeModal, todayISO } from "../modal.js";
import { icon, iconForCuentaTipo } from "../icons.js";
import { attachCopyId, copyIdButton } from "../copy-id.js";

const TIPOS = ["Corriente", "Ahorro", "Efectivo", "Otra"];

export function mountCuentas() {
  document.getElementById("btn-add-cuenta").addEventListener("click", () => openForm());
}

export function renderCuentas(state) {
  const el = document.getElementById("cuentas-grid");
  const { cuentas, movimientos } = state;

  if (cuentas.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no has añadido ninguna cuenta.</p>`;
    return;
  }

  el.innerHTML = cuentas
    .map((c) => {
      const saldo = calcularSaldoCuenta(c, movimientos);
      return `
        <article class="entity-card">
          <div class="entity-card__top">
            <div class="entity-card__heading">
              <span class="icon-badge">${icon(iconForCuentaTipo(c.tipo))}</span>
              <p class="entity-card__name">${c.nombre}</p>
            </div>
            <span class="entity-card__tag ${c.activa === false ? "entity-card__tag--pagado" : "entity-card__tag--activo"}">${c.activa === false ? "Inactiva" : c.tipo}</span>
          </div>
          <p class="entity-card__amount">${formatEUR(saldo)}</p>
          <p class="entity-card__meta">Saldo inicial ${formatEUR(c.saldo_inicial)} · desde ${c.fecha_inicio ? formatFecha(new Date(c.fecha_inicio)) : "—"}</p>
          <div class="entity-card__actions">
            ${copyIdButton(c.id)}
            <button class="btn btn--ghost btn--sm" data-edit="${c.id}">Editar</button>
            <button class="btn btn--danger btn--sm" data-delete="${c.id}">Eliminar</button>
          </div>
        </article>`;
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(cuentas.find((c) => c.id === btn.dataset.edit)))
  );
  el.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("¿Eliminar esta cuenta? No se borrarán sus movimientos.")) deleteCuenta(btn.dataset.delete);
    })
  );
  attachCopyId(el);
}

function openForm(cuenta) {
  const isEdit = Boolean(cuenta);
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar cuenta" : "Nueva cuenta"}</h2>
    <form id="form-cuenta" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Nombre</span>
        <input type="text" name="nombre" required value="${cuenta?.nombre ?? ""}" placeholder="Imagin" />
      </label>
      <label class="field">
        <span class="field__label">Tipo</span>
        <select name="tipo">
          ${TIPOS.map((t) => `<option ${cuenta?.tipo === t ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Saldo inicial</span>
        <input type="number" step="0.01" name="saldo_inicial" required value="${cuenta?.saldo_inicial ?? ""}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Fecha de ese saldo</span>
        <input type="date" name="fecha_inicio" value="${cuenta?.fecha_inicio ?? todayISO()}" />
      </label>
      <label class="field-check field--full">
        <input type="checkbox" name="activa" ${cuenta?.activa !== false ? "checked" : ""} />
        Cuenta activa
      </label>
      <p class="field-error" id="form-cuenta-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Guardar" : "Añadir"}</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-cuenta").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            nombre: f.nombre.value.trim(),
            tipo: f.tipo.value,
            saldo_inicial: Number(f.saldo_inicial.value),
            fecha_inicio: f.fecha_inicio.value,
            activa: f.activa.checked,
          };
          try {
            if (isEdit) await updateCuenta(cuenta.id, data);
            else await addCuenta(data);
            closeModal();
          } catch (err) {
            root.querySelector("#form-cuenta-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
