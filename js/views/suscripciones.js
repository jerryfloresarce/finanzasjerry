import { addSuscripcion, updateSuscripcion, deleteSuscripcion, addMovimiento, deleteMovimiento, formatEUR, formatFecha, fromTimestamp, toTimestamp } from "../db.js?v=30";
import { openModal, closeModal, optionsFrom, todayISO } from "../modal.js?v=30";
import { icon, iconForSuscripcion } from "../icons.js?v=30";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=30";

let currentState = null;
// Primer día del mes que se está viendo en el listado (checklist mensual).
let mesActual = firstOfMonth(new Date());

function firstOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function mountSuscripciones() {
  document.getElementById("btn-add-suscripcion").addEventListener("click", () => openForm(null, currentState));
  document.getElementById("susc-mes-prev").addEventListener("click", () => {
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1);
    if (currentState) renderSuscripciones(currentState);
  });
  document.getElementById("susc-mes-next").addEventListener("click", () => {
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
    if (currentState) renderSuscripciones(currentState);
  });
}

// Movimientos de tipo Gasto vinculados a una suscripción (campo
// suscripcion_id) que caen dentro del mes que se está viendo — así se sabe
// si esa suscripción ya está "pagada" este periodo sin necesitar un estado
// aparte que se pueda desincronizar del movimiento real.
function pagosDelMes(movimientos, suscripcionId) {
  return movimientos.filter((m) => {
    if (m.suscripcion_id !== suscripcionId) return false;
    const d = fromTimestamp(m.fecha);
    return d && d.getFullYear() === mesActual.getFullYear() && d.getMonth() === mesActual.getMonth();
  });
}

export function renderSuscripciones(state) {
  currentState = state;
  const el = document.getElementById("suscripciones-grid");
  const { suscripciones, categorias, cuentas, movimientos } = state;
  const catMap = new Map(categorias.map((c) => [c.id, c.nombre]));
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c.nombre]));

  const mesLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(mesActual);
  document.getElementById("susc-mes-label").textContent = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  if (suscripciones.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no has añadido ningún gasto fijo.</p>`;
    document.getElementById("susc-resumen").textContent = "";
    return;
  }

  const ordenadas = [...suscripciones].sort((a, b) => (a.activa === false) - (b.activa === false));

  let pagadoTotal = 0;
  let pendienteTotal = 0;
  let pagadasCount = 0;

  el.innerHTML = ordenadas
    .map((s) => {
      const pagos = pagosDelMes(movimientos, s.id);
      const pagada = pagos.length > 0;
      const importeReal = pagada ? pagos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0) : Number(s.precio ?? 0);
      if (s.activa !== false) {
        if (pagada) {
          pagadoTotal += importeReal;
          pagadasCount++;
        } else pendienteTotal += importeReal;
      }

      return wrapSwipe(
        `
        <div class="mini-row susc-row ${s.activa === false ? "susc-row--inactiva" : ""}">
          <label class="field-check" style="flex:1; min-width:0;">
            <input type="checkbox" data-toggle-susc="${s.id}" ${pagada ? "checked" : ""} ${s.activa === false ? "disabled" : ""} />
            <span class="mini-row__body" style="min-width:0;">
              <span class="mini-row__icon">${icon(iconForSuscripcion(s.nombre))}</span>
              <span class="mini-row__main">
                <span class="mini-row__title">${s.nombre}</span>
                <span class="mini-row__sub">${catMap.get(s.categoria_id) || "—"} · ${cuentaMap.get(s.cuenta_id) || "—"}${s.activa === false ? " · Inactiva" : ""}</span>
              </span>
            </span>
          </label>
          <span class="mini-row__amount">${formatEUR(importeReal)}</span>
          <button type="button" class="row-edit-btn" data-edit="${s.id}" title="Editar">${icon("edit", { size: 15 })}</button>
        </div>`,
        s.id
      );
    })
    .join("");

  const totalActivas = suscripciones.filter((s) => s.activa !== false).length;
  document.getElementById("susc-resumen").textContent =
    `Pagado este mes: ${formatEUR(pagadoTotal)} (${pagadasCount}/${totalActivas}) · Pendiente: ${formatEUR(pendienteTotal)}`;

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(suscripciones.find((s) => s.id === btn.dataset.edit), currentState))
  );
  el.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("¿Eliminar este gasto fijo? No se borrarán los gastos ya registrados.")) deleteSuscripcion(btn.dataset.delete);
    })
  );
  el.querySelectorAll("[data-toggle-susc]").forEach((input) =>
    input.addEventListener("change", () => {
      const s = suscripciones.find((x) => x.id === input.dataset.toggleSusc);
      if (input.checked) openMarcarPagado(s, currentState, input);
      else {
        input.checked = true; // se revierte visualmente hasta que se confirme el borrado
        const pagos = pagosDelMes(movimientos, s.id);
        if (pagos.length > 0 && confirm(`¿Deshacer el pago de "${s.nombre}" este mes? Se borrará el gasto registrado.`)) {
          pagos.forEach((m) => deleteMovimiento(m.id));
        }
      }
    })
  );
}

// checkboxInput: la casilla que el usuario acaba de marcar para abrir este
// modal. El navegador ya la puso "checked" antes de que este código se
// ejecute (comportamiento normal de un <input type="checkbox">) — si el
// usuario cierra el modal sin guardar (Cancelar, click fuera, Escape), no
// se crea ningún movimiento y por tanto "pagada" seguiría siendo falso en
// los datos reales, pero la casilla se quedaría marcada visualmente hasta
// el próximo render. onClose la revierte en ese caso (y no hace nada si
// se guardó con éxito, gracias a la bandera `saved`).
function openMarcarPagado(suscripcion, state, checkboxInput) {
  let saved = false;
  openModal(
    `
    <h2 class="modal__title">Marcar "${suscripcion.nombre}" como pagado</h2>
    <form id="form-susc-pago" class="form-grid">
      <label class="field">
        <span class="field__label">Importe</span>
        <input type="number" step="0.01" name="importe" required value="${suscripcion.precio ?? ""}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Cuenta</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: suscripcion.cuenta_id })}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <label class="field-check field--full">
        <input type="checkbox" name="no_afecta_saldo" />
        Ya estaba pagado — no descontar de la cuenta (solo registrarlo)
      </label>
      <p class="field-error" id="form-susc-pago-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Confirmar</button>
      </div>
    </form>
  `,
    {
      onClose: () => {
        if (!saved && checkboxInput) checkboxInput.checked = false;
      },
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-susc-pago").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            tipo: "Gasto",
            importe: Number(f.importe.value),
            categoria_id: suscripcion.categoria_id || null,
            cuenta_id: f.cuenta_id.value,
            cuenta_destino_id: null,
            fecha: toTimestamp(f.fecha.value),
            subcategoria: suscripcion.nombre,
            nota: "",
            suscripcion_id: suscripcion.id,
            afecta_saldo: !f.no_afecta_saldo.checked,
          };
          try {
            await addMovimiento(data);
            saved = true;
            closeModal();
          } catch (err) {
            root.querySelector("#form-susc-pago-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function openForm(suscripcion, state) {
  const isEdit = Boolean(suscripcion);
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar gasto fijo" : "Nuevo gasto fijo"}</h2>
    <form id="form-suscripcion" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Nombre</span>
        <input type="text" name="nombre" required value="${suscripcion?.nombre ?? ""}" placeholder="Glovo Prime, Préstamo Bankinter, Luz…" />
      </label>
      <label class="field">
        <span class="field__label">Precio habitual</span>
        <input type="number" step="0.01" name="precio" required value="${suscripcion?.precio ?? ""}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Frecuencia</span>
        <select name="frecuencia">
          <option ${suscripcion?.frecuencia === "Mensual" ? "selected" : ""}>Mensual</option>
          <option ${suscripcion?.frecuencia === "Bimensual" ? "selected" : ""}>Bimensual</option>
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
      <label class="field-check field--full">
        <input type="checkbox" name="activa" ${suscripcion?.activa !== false ? "checked" : ""} />
        Gasto fijo activo
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
