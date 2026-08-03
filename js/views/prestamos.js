import {
  addPrestamo,
  updatePrestamo,
  deletePrestamo,
  addPagoPrestamo,
  updatePagoPrestamo,
  deletePagoPrestamo,
  formatEUR,
  formatFecha,
  fromTimestamp,
  toTimestamp,
} from "../db.js?v=10";
import { openModal, closeModal, todayISO } from "../modal.js?v=10";
import { capitalActual } from "./dashboard.js?v=10";
import { initials, avatarColor } from "../icons.js?v=10";

const ESTADOS = ["Activo", "Pagado", "Impago"];
const TIPOS_PAGO = ["Interes", "Capital", "Ambos", "AumentoCapital"];
const TIPO_LABELS = {
  Interes: "Interés",
  Capital: "Capital",
  Ambos: "Ambos",
  AumentoCapital: "Capitalización de interés",
};

let currentState = null;

export function mountPrestamos() {
  document.getElementById("btn-add-prestamo").addEventListener("click", () => openPrestamoForm());
}

export function renderPrestamos(state) {
  currentState = state;
  const el = document.getElementById("prestamos-grid");
  const { prestamos, pagosPrestamos } = state;

  if (prestamos.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no has registrado ningún préstamo.</p>`;
    return;
  }

  el.innerHTML = prestamos
    .map((p) => {
      const pagos = pagosPrestamos.filter((pg) => pg.prestamo_id === p.id).sort(
        (a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0)
      );
      const restante = capitalActual(p, pagosPrestamos);
      const totalInteres = restante * (Number(p.interes_porcentaje ?? 0) / 100);
      const tagClass =
        p.estado === "Pagado" ? "entity-card__tag--pagado" : p.estado === "Impago" ? "entity-card__tag--impago" : "entity-card__tag--activo";

      return `
        <article class="entity-card">
          <div class="entity-card__top">
            <div class="entity-card__heading">
              <span class="avatar" style="background:${avatarColor(p.persona)}">${initials(p.persona)}</span>
              <p class="entity-card__name">${p.persona}</p>
            </div>
            <span class="entity-card__tag ${tagClass}">${p.estado}</span>
          </div>
          <p class="entity-card__amount">${formatEUR(restante)} <span style="font-size:0.9rem;color:var(--text-muted);font-family:var(--font-body)">pendiente de capital</span></p>
          <p class="entity-card__meta">Prestado ${formatEUR(p.capital_inicial)} el ${p.fecha_inicio ? formatFecha(new Date(p.fecha_inicio)) : "—"} · ${p.interes_porcentaje}% interés (${formatEUR(totalInteres)})</p>
          ${p.notas ? `<p class="entity-card__meta">${p.notas}</p>` : ""}

          <div class="mini-list pago-list">
            ${
              pagos.length === 0
                ? `<p class="empty-state" style="padding:8px 0;">Sin pagos registrados</p>`
                : pagos
                    .map(
                      (pg) => `
                <div class="mini-row">
                  <label class="field-check" style="flex:1;">
                    <input type="checkbox" data-toggle-pago="${pg.id}" ${pg.pagado ? "checked" : ""} />
                    <span class="mini-row__main">
                      <span class="mini-row__title">${TIPO_LABELS[pg.tipo] || pg.tipo}</span>
                      <span class="mini-row__sub">${formatFecha(fromTimestamp(pg.fecha))}${pg.tipo === "Ambos" ? ` · ${formatEUR(pg.importe_capital)} cap + ${formatEUR(pg.importe_interes)} int` : ""}</span>
                    </span>
                  </label>
                  <span class="mini-row__amount">${formatEUR(pg.importe)}</span>
                  <button class="btn btn--ghost btn--sm" data-delete-pago="${pg.id}" title="Eliminar pago">✕</button>
                </div>`
                    )
                    .join("")
            }
          </div>

          <div class="entity-card__actions">
            <button class="btn btn--ghost btn--sm" data-add-pago="${p.id}">+ Pago</button>
            <button class="btn btn--ghost btn--sm" data-edit="${p.id}">Editar</button>
            <button class="btn btn--danger btn--sm" data-delete="${p.id}">Eliminar</button>
          </div>
        </article>`;
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openPrestamoForm(prestamos.find((p) => p.id === btn.dataset.edit)))
  );
  el.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("¿Eliminar este préstamo? No se borrarán sus pagos.")) deletePrestamo(btn.dataset.delete);
    })
  );
  el.querySelectorAll("[data-add-pago]").forEach((btn) =>
    btn.addEventListener("click", () => openPagoForm(prestamos.find((p) => p.id === btn.dataset.addPago), pagosPrestamos))
  );
  el.querySelectorAll("[data-toggle-pago]").forEach((input) =>
    input.addEventListener("change", () => updatePagoPrestamo(input.dataset.togglePago, { pagado: input.checked }))
  );
  el.querySelectorAll("[data-delete-pago]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("¿Eliminar este pago?")) deletePagoPrestamo(btn.dataset.deletePago);
    })
  );
}

function openPrestamoForm(prestamo) {
  const isEdit = Boolean(prestamo);
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar préstamo" : "Nuevo préstamo"}</h2>
    <form id="form-prestamo" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Persona</span>
        <input type="text" name="persona" required value="${prestamo?.persona ?? ""}" placeholder="Liz colombiana" />
      </label>
      <label class="field">
        <span class="field__label">Capital prestado</span>
        <input type="number" step="0.01" name="capital_inicial" required value="${prestamo?.capital_inicial ?? ""}" placeholder="500.00" />
      </label>
      <label class="field">
        <span class="field__label">Interés (%)</span>
        <input type="number" step="0.01" name="interes_porcentaje" value="${prestamo?.interes_porcentaje ?? 0}" placeholder="20" />
      </label>
      <label class="field">
        <span class="field__label">Fecha de inicio</span>
        <input type="date" name="fecha_inicio" value="${prestamo?.fecha_inicio ?? todayISO()}" />
      </label>
      <label class="field">
        <span class="field__label">Estado</span>
        <select name="estado">${ESTADOS.map((e) => `<option ${prestamo?.estado === e ? "selected" : ""}>${e}</option>`).join("")}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Notas (opcional)</span>
        <textarea name="notas" rows="2" placeholder="Máximo 05/09/2026, 300€…">${prestamo?.notas ?? ""}</textarea>
      </label>
      <p class="field-error" id="form-prestamo-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Guardar" : "Añadir"}</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-prestamo").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            persona: f.persona.value.trim(),
            capital_inicial: Number(f.capital_inicial.value),
            interes_porcentaje: Number(f.interes_porcentaje.value || 0),
            fecha_inicio: f.fecha_inicio.value,
            estado: f.estado.value,
            notas: f.notas.value.trim(),
          };
          try {
            if (isEdit) await updatePrestamo(prestamo.id, data);
            else await addPrestamo(data);
            closeModal();
          } catch (err) {
            root.querySelector("#form-prestamo-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function openPagoForm(prestamo, pagosPrestamos) {
  const prestamoId = prestamo.id;
  openModal(
    `
    <h2 class="modal__title">Registrar pago</h2>
    <form id="form-pago" class="form-grid">
      <label class="field">
        <span class="field__label">Tipo</span>
        <select name="tipo" id="pago-tipo">
          ${TIPOS_PAGO.map((t) => `<option value="${t}">${TIPO_LABELS[t]}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>

      <div id="pago-simple" class="field field--full">
        <span class="field__label">Importe</span>
        <input type="number" step="0.01" name="importe" placeholder="0.00" />
        <p class="field-hint is-hidden" id="pago-aumento-hint"></p>
      </div>

      <div id="pago-ambos" class="form-grid field--full is-hidden" style="padding:0;">
        <label class="field">
          <span class="field__label">Parte de capital</span>
          <input type="number" step="0.01" name="importe_capital" placeholder="0.00" />
        </label>
        <label class="field">
          <span class="field__label">Parte de interés</span>
          <input type="number" step="0.01" name="importe_interes" placeholder="0.00" />
        </label>
      </div>

      <label class="field-check field--full" id="pago-pagado-wrap">
        <input type="checkbox" name="pagado" checked />
        Ya pagado
      </label>
      <p class="field-error" id="form-pago-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Registrar</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        const tipoSelect = root.querySelector("#pago-tipo");
        const simple = root.querySelector("#pago-simple");
        const ambos = root.querySelector("#pago-ambos");
        const pagadoWrap = root.querySelector("#pago-pagado-wrap");
        const importeInput = root.querySelector("input[name=importe]");
        const aumentoHint = root.querySelector("#pago-aumento-hint");

        function toggleFields() {
          const esAmbos = tipoSelect.value === "Ambos";
          const esAumento = tipoSelect.value === "AumentoCapital";
          simple.classList.toggle("is-hidden", esAmbos);
          ambos.classList.toggle("is-hidden", !esAmbos);
          pagadoWrap.classList.toggle("is-hidden", esAumento);
          aumentoHint.classList.toggle("is-hidden", !esAumento);
          if (esAumento) {
            const restante = capitalActual(prestamo, pagosPrestamos);
            const interes = restante * (Number(prestamo.interes_porcentaje ?? 0) / 100);
            importeInput.value = (restante + interes).toFixed(2);
            aumentoHint.textContent = `Sugerido: capital pendiente (${formatEUR(restante)}) + interés de este periodo (${formatEUR(interes)}). Ajusta el importe si solo una parte queda impaga.`;
          }
        }
        tipoSelect.addEventListener("change", toggleFields);
        toggleFields();

        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-pago").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const tipo = f.tipo.value;

          let importe, importe_capital, importe_interes;
          if (tipo === "Ambos") {
            importe_capital = Number(f.importe_capital.value || 0);
            importe_interes = Number(f.importe_interes.value || 0);
            importe = importe_capital + importe_interes;
          } else {
            importe = Number(f.importe.value || 0);
            importe_capital = tipo === "Capital" ? importe : 0;
            importe_interes = tipo === "Interes" ? importe : 0;
          }

          const data = {
            prestamo_id: prestamoId,
            fecha: toTimestamp(f.fecha.value),
            tipo,
            importe,
            importe_capital,
            importe_interes,
            pagado: tipo === "AumentoCapital" ? true : f.pagado.checked,
          };
          try {
            await addPagoPrestamo(data);
            closeModal();
          } catch (err) {
            root.querySelector("#form-pago-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
