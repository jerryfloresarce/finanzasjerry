import { addPrestamo, updatePrestamo, deletePrestamo, addMovimiento, formatEUR, formatFecha, toTimestamp } from "../db.js?v=28";
import { openModal, closeModal, optionsFrom, todayISO } from "../modal.js?v=28";
import { initials, avatarColor, icon } from "../icons.js?v=28";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=28";

const ESTADOS = ["Activo", "Pagado"];

export function mountPrestamos() {
  document.getElementById("btn-add-prestamo").addEventListener("click", () => openPrestamoForm());
}

// Un mes exacto después de una fecha ISO ("2026-09-01" → "2026-10-01"),
// para avanzar la fecha de interés cada vez que se marca pagado o impago.
function unMesDespues(fechaISO) {
  const d = new Date(fechaISO + "T00:00:00");
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// El interés se puede fijar a mano (para préstamos como el de Liz
// colombiana, donde no es un % fijo del capital) o calcularse solo con el
// % configurado (Silvia, Jessica...). Si hay un importe manual guardado, ese
// gana siempre sobre el %.
function tieneInteresManual(p) {
  return p.interes_manual !== undefined && p.interes_manual !== null && p.interes_manual !== "";
}

function interesActualDe(p) {
  if (tieneInteresManual(p)) return Number(p.interes_manual);
  const capital = Number(p.capital ?? p.capital_inicial ?? 0);
  const pct = Number(p.interes_porcentaje ?? 0);
  return capital * (pct / 100);
}

export function renderPrestamos(state) {
  const el = document.getElementById("prestamos-grid");
  const { prestamos } = state;

  const activos = prestamos.filter((p) => p.estado !== "Pagado");
  const totalCapital = activos.reduce((acc, p) => acc + Number(p.capital ?? p.capital_inicial ?? 0), 0);
  const totalInteres = activos.reduce((acc, p) => acc + interesActualDe(p), 0);
  document.getElementById("kpi-prestamos-capital").textContent = formatEUR(totalCapital);
  document.getElementById("kpi-prestamos-interes").textContent = formatEUR(totalInteres);

  if (prestamos.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no has registrado ningún préstamo.</p>`;
    return;
  }

  el.innerHTML = prestamos
    .map((p) => {
      // capital_inicial es el campo antiguo (de antes de simplificar
      // préstamos): si un préstamo todavía no tiene `capital` fijado, se
      // usa como respaldo temporal para no mostrar NaN/vacío.
      const capital = Number(p.capital ?? p.capital_inicial ?? 0);
      const pct = Number(p.interes_porcentaje ?? 0);
      const interesActual = interesActualDe(p);
      const etiquetaInteres = tieneInteresManual(p) ? "Interés (fijo)" : `Interés (${pct}%)`;
      const tagClass = p.estado === "Pagado" ? "entity-card__tag--pagado" : "entity-card__tag--activo";

      return wrapSwipe(
        `
        <article class="entity-card">
          <div class="entity-card__top">
            <div class="entity-card__heading">
              <span class="avatar" style="background:${avatarColor(p.persona)}">${initials(p.persona)}</span>
              <p class="entity-card__name">${p.persona}</p>
            </div>
            <div class="entity-card__top-actions">
              <span class="entity-card__tag ${tagClass}">${p.estado || "Activo"}</span>
              <button type="button" class="row-edit-btn" data-edit="${p.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>
          </div>
          <p class="entity-card__amount">${formatEUR(capital)} <span style="font-size:0.9rem;color:var(--text-muted);font-family:var(--font-body)">de capital</span></p>
          ${p.notas ? `<p class="entity-card__meta">${p.notas}</p>` : ""}

          ${
            p.fecha_interes
              ? `
          <div class="prestamo-interes">
            <div class="prestamo-interes__info">
              <span class="prestamo-interes__label">${etiquetaInteres}</span>
              <span class="prestamo-interes__amount">${formatEUR(interesActual)}</span>
              <span class="prestamo-interes__fecha">vence ${formatFecha(new Date(p.fecha_interes + "T00:00:00"))}</span>
            </div>
            <div class="prestamo-interes__actions">
              <button type="button" class="btn btn--primary btn--sm" data-pago-ok="${p.id}">✓ Pagó</button>
              <button type="button" class="btn btn--ghost btn--sm" data-pago-no="${p.id}">✕ No pagó</button>
            </div>
          </div>`
              : `<p class="entity-card__meta">Sin fecha de interés configurada — edita el préstamo para añadirla.</p>`
          }
          ${
            p.estado !== "Pagado"
              ? `<button type="button" class="btn btn--ghost btn--sm btn--block prestamo-liquidar-btn" data-liquidar="${p.id}">💰 Ha pagado capital + interés (liquidar deuda)</button>`
              : ""
          }
        </article>`,
        p.id
      );
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openPrestamoForm(prestamos.find((p) => p.id === btn.dataset.edit)))
  );
  el.querySelectorAll("[data-pago-ok]").forEach((btn) =>
    btn.addEventListener("click", () => openInteresPagadoForm(prestamos.find((p) => p.id === btn.dataset.pagoOk), state))
  );
  el.querySelectorAll("[data-pago-no]").forEach((btn) =>
    btn.addEventListener("click", () => marcarInteresImpago(prestamos.find((p) => p.id === btn.dataset.pagoNo)))
  );
  el.querySelectorAll("[data-liquidar]").forEach((btn) =>
    btn.addEventListener("click", () => openLiquidarForm(prestamos.find((p) => p.id === btn.dataset.liquidar), state))
  );
  attachSwipe(el, (id) => {
    if (confirm("¿Eliminar este préstamo?")) deletePrestamo(id);
  });
}

async function marcarInteresImpago(prestamo) {
  const capital = Number(prestamo.capital ?? prestamo.capital_inicial ?? 0);
  const interesActual = interesActualDe(prestamo);
  const nuevoCapital = capital + interesActual;
  if (
    !confirm(
      `${prestamo.persona} no pagó el interés de ${formatEUR(interesActual)}.\n\nSe sumará al capital: ${formatEUR(capital)} + ${formatEUR(
        interesActual
      )} = ${formatEUR(nuevoCapital)}.\n\n¿Confirmas?`
    )
  )
    return;
  await updatePrestamo(prestamo.id, {
    capital: nuevoCapital,
    fecha_interes: unMesDespues(prestamo.fecha_interes),
  });
}

function openInteresPagadoForm(prestamo, state) {
  const interesActual = interesActualDe(prestamo);

  openModal(
    `
    <h2 class="modal__title">Interés pagado · ${prestamo.persona}</h2>
    <form id="form-interes-pago" class="form-grid">
      <label class="field">
        <span class="field__label">Importe</span>
        <input type="number" step="0.01" name="importe" required value="${interesActual.toFixed(2)}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Cuenta</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: prestamo.cuenta_id })}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <p class="field-error" id="form-interes-pago-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Confirmar</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-interes-pago").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          try {
            await addMovimiento({
              tipo: "Ingreso",
              importe: Number(f.importe.value),
              categoria_id: null,
              cuenta_id: f.cuenta_id.value,
              cuenta_destino_id: null,
              fecha: toTimestamp(f.fecha.value),
              subcategoria: `Interés préstamo · ${prestamo.persona}`,
              nota: "",
            });
            await updatePrestamo(prestamo.id, { fecha_interes: unMesDespues(prestamo.fecha_interes) });
            closeModal();
          } catch (err) {
            root.querySelector("#form-interes-pago-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

// Cuando la persona paga TODO de golpe (el capital pendiente + el interés
// actual), no basta con marcar el interés como pagado (eso solo mueve la
// fecha y deja el capital intacto): aquí se registra un único ingreso por
// la suma de ambos y el préstamo se cierra del todo (capital a 0, estado
// Pagado), en vez de seguir esperando el próximo interés.
function openLiquidarForm(prestamo, state) {
  const capital = Number(prestamo.capital ?? prestamo.capital_inicial ?? 0);
  const interesActual = interesActualDe(prestamo);
  const total = capital + interesActual;

  openModal(
    `
    <h2 class="modal__title">Liquidar deuda · ${prestamo.persona}</h2>
    <p class="entity-card__meta" style="margin-bottom:16px;">
      Capital (${formatEUR(capital)}) + interés (${formatEUR(interesActual)}) = <strong>${formatEUR(total)}</strong>.
      Esto registra un ingreso por el total y cierra el préstamo como Pagado.
    </p>
    <form id="form-liquidar" class="form-grid">
      <label class="field">
        <span class="field__label">Importe total</span>
        <input type="number" step="0.01" name="importe" required value="${total.toFixed(2)}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Cuenta</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: prestamo.cuenta_id })}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <p class="field-error" id="form-liquidar-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Liquidar y cerrar préstamo</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-liquidar").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          try {
            await addMovimiento({
              tipo: "Ingreso",
              importe: Number(f.importe.value),
              categoria_id: null,
              cuenta_id: f.cuenta_id.value,
              cuenta_destino_id: null,
              fecha: toTimestamp(f.fecha.value),
              subcategoria: `Préstamo liquidado · ${prestamo.persona}`,
              nota: "",
            });
            await updatePrestamo(prestamo.id, { capital: 0, estado: "Pagado" });
            closeModal();
          } catch (err) {
            root.querySelector("#form-liquidar-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function openPrestamoForm(prestamo) {
  const isEdit = Boolean(prestamo);
  const capital = prestamo ? Number(prestamo.capital ?? prestamo.capital_inicial ?? 0) : "";
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar préstamo" : "Nuevo préstamo"}</h2>
    <form id="form-prestamo" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Persona</span>
        <input type="text" name="persona" required value="${prestamo?.persona ?? ""}" placeholder="Liz colombiana" />
      </label>
      <label class="field">
        <span class="field__label">Capital pendiente</span>
        <input type="number" step="0.01" name="capital" required value="${capital}" placeholder="500.00" />
      </label>
      <label class="field">
        <span class="field__label">Interés (%)</span>
        <input type="number" step="0.01" name="interes_porcentaje" value="${prestamo?.interes_porcentaje ?? 0}" placeholder="20" />
      </label>
      <label class="field">
        <span class="field__label">Interés manual (€, opcional)</span>
        <input type="number" step="0.01" name="interes_manual" value="${prestamo?.interes_manual ?? ""}" placeholder="Vacío = se calcula con el %" />
      </label>
      <label class="field">
        <span class="field__label">Fecha del próximo interés</span>
        <input type="date" name="fecha_interes" value="${prestamo?.fecha_interes ?? ""}" />
      </label>
      <label class="field">
        <span class="field__label">Estado</span>
        <select name="estado">${ESTADOS.map((e) => `<option ${prestamo?.estado === e ? "selected" : ""}>${e}</option>`).join("")}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Notas (opcional)</span>
        <textarea name="notas" rows="2" placeholder="Notas breves…">${prestamo?.notas ?? ""}</textarea>
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
            capital: Number(f.capital.value),
            interes_porcentaje: Number(f.interes_porcentaje.value || 0),
            interes_manual: f.interes_manual.value !== "" ? Number(f.interes_manual.value) : null,
            fecha_interes: f.fecha_interes.value || null,
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
