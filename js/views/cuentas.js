import { addCuenta, updateCuenta, deleteCuenta, calcularSaldoCuenta, formatEUR, formatFecha, fromTimestamp } from "../db.js?v=42";
import { openModal, closeModal, todayISO } from "../modal.js?v=42";
import { entityIcon, iconForCuentaTipo, iconForCategoriaTipo, icon } from "../icons.js?v=42";
import { attachCopyId, copyIdButton } from "../copy-id.js?v=42";
import { emojiFieldHTML, attachEmojiPicker, CUENTA_EMOJIS } from "../emoji-picker.js?v=42";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=42";

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
      return wrapSwipe(
        `
        <article class="entity-card">
          <div class="entity-card__top">
            <div class="entity-card__heading">
              <span class="icon-badge">${entityIcon(c, iconForCuentaTipo(c.tipo))}</span>
              <p class="entity-card__name">${c.nombre}</p>
            </div>
            <div class="entity-card__top-actions">
              <span class="entity-card__tag ${c.activa === false ? "entity-card__tag--pagado" : "entity-card__tag--activo"}">${c.activa === false ? "Inactiva" : c.tipo}</span>
              <button type="button" class="row-edit-btn" data-edit="${c.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>
          </div>
          <p class="entity-card__amount">${formatEUR(saldo)}</p>
          <p class="entity-card__meta">Saldo inicial ${formatEUR(c.saldo_inicial)} · desde ${c.fecha_inicio ? formatFecha(new Date(c.fecha_inicio)) : "—"}</p>
          <div class="entity-card__actions">
            ${copyIdButton(c.id)}
            <button class="btn btn--ghost btn--sm" data-historial="${c.id}">Historial</button>
          </div>
        </article>`,
        c.id
      );
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(cuentas.find((c) => c.id === btn.dataset.edit)))
  );
  el.querySelectorAll("[data-historial]").forEach((btn) =>
    btn.addEventListener("click", () => openHistorial(cuentas.find((c) => c.id === btn.dataset.historial), state))
  );
  attachSwipe(el, (id) => deleteCuenta(id), {
    confirmar: "¿Eliminar esta cuenta? No se borrarán sus movimientos.",
  });
  attachCopyId(el);
}

export function openHistorial(cuenta, state) {
  const { movimientos, categorias, cuentas } = state;
  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c.nombre]));

  const relacionados = movimientos
    .filter((m) => m.cuenta_id === cuenta.id || m.cuenta_destino_id === cuenta.id)
    .sort((a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0));

  const filas = relacionados
    .map((m) => {
      const esTransferencia = m.tipo === "Transferencia";
      const esOrigen = m.cuenta_id === cuenta.id;
      let descripcion;
      let signo;
      if (esTransferencia) {
        descripcion = esOrigen
          ? `Transferencia enviada a ${cuentaMap.get(m.cuenta_destino_id) || "—"}`
          : `Transferencia recibida de ${cuentaMap.get(m.cuenta_id) || "—"}`;
        signo = esOrigen ? -1 : 1;
      } else {
        const cat = catMap.get(m.categoria_id);
        descripcion = `${entityIcon(cat, iconForCategoriaTipo(cat?.tipo), { size: 14 })} ${m.subcategoria ? m.subcategoria + " · " : ""}${cat?.nombre || "—"}`;
        signo = m.tipo === "Ingreso" ? 1 : -1;
      }
      return `
        <div class="data-row data-row--historial">
          <span>${formatFecha(fromTimestamp(m.fecha))}</span>
          <span class="data-row__cat">${descripcion}</span>
          <span class="${signo > 0 ? "data-row__amount--Ingreso" : "data-row__amount--Gasto"}">${signo > 0 ? "+ " : "− "}${formatEUR(Math.abs(Number(m.importe)))}</span>
        </div>`;
    })
    .join("");

  openModal(
    `
    <h2 class="modal__title">Historial · ${cuenta.nombre}</h2>
    ${relacionados.length === 0 ? `<p class="empty-state">Todavía no hay movimientos en esta cuenta.</p>` : `<div class="data-table data-table--historial">${filas}</div>`}
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="btn-cerrar-historial">Cerrar</button>
    </div>
  `,
    {
      wide: true,
      onMount: (root) => {
        root.querySelector("#btn-cerrar-historial").addEventListener("click", closeModal);
      },
    }
  );
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
      ${emojiFieldHTML(cuenta?.icono, CUENTA_EMOJIS)}
      <p class="field-error" id="form-cuenta-error"></p>
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
        root.querySelector("#form-cuenta").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            nombre: f.nombre.value.trim(),
            tipo: f.tipo.value,
            saldo_inicial: Number(f.saldo_inicial.value),
            fecha_inicio: f.fecha_inicio.value,
            activa: f.activa.checked,
            icono: f.icono.value.trim() || null,
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
