import {
  addPrestamo,
  updatePrestamo,
  deletePrestamo,
  addMovimiento,
  deleteMovimiento,
  addPagoPrestamo,
  updatePagoPrestamo,
  formatEUR,
  formatFecha,
  toTimestamp,
  fromTimestamp,
  esPlanDePagos,
  restantePlanDePagos,
  fechaISO as diaISO,
} from "../db.js?v=111";
import { openModal, closeModal, optionsFrom, todayISO, esc } from "../modal.js?v=111";
import { initials, avatarColor, icon } from "../icons.js?v=111";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=111";
import { efectoDeCelebracion } from "../efectos.js?v=111";

const ESTADOS = ["Activo", "Pagado"];

// El formulario de "Nuevo préstamo" necesita la lista de cuentas para
// preguntar de dónde sale el dinero, y el botón de arriba se engancha una
// sola vez al arrancar (cuando todavía no hay datos), así que el estado se
// guarda aquí y se refresca en cada pintado.
let currentState = null;

export function mountPrestamos() {
  document.getElementById("btn-add-prestamo").addEventListener("click", () => openPrestamoForm(null, currentState));
}

const round2 = (n) => Math.round(n * 100) / 100;

// El modelo de deuda es UNO y simple: total a devolver = capital + interés.
// Cada pago (del importe que sea, el día que sea) resta de ese total, y al
// llegar a cero el préstamo se cierra solo. Ejemplo real de la casa: 100 €
// prestados al 20 % → debe 120 €; si paga 30 € al día durante 4 días,
// liquidado. Sin meses que vencen, sin intereses que se congelan o se
// acumulan: una deuda, un total, pagos hasta el cero.

// El interés se puede fijar a mano (para los préstamos en los que se pactó
// una cantidad concreta y no un % del capital) o calcularse solo con el %
// configurado. Si hay un importe manual guardado, ese gana siempre sobre
// el %.
function tieneInteresManual(p) {
  return p.interes_manual !== undefined && p.interes_manual !== null && p.interes_manual !== "";
}

function interesTotalDe(p) {
  if (tieneInteresManual(p)) return Number(p.interes_manual);
  const capital = Number(p.capital ?? p.capital_inicial ?? 0);
  const pct = Number(p.interes_porcentaje ?? 0);
  return round2(capital * (pct / 100));
}

function totalDe(p) {
  return round2(Number(p.capital ?? p.capital_inicial ?? 0) + interesTotalDe(p));
}

function pagadoDe(p) {
  return Number(p.pagado ?? 0);
}

function pendienteDe(p) {
  return Math.max(0, round2(totalDe(p) - pagadoDe(p)));
}

// Los pagos que ha hecho una persona: los ingresos que crearon los botones
// de pago, los días del plan y la liquidación. SOLO por el id del préstamo:
// antes también se casaba por el texto ("… · Mama") y dos préstamos a la
// misma persona se enseñaban los pagos el uno del otro.
function pagosDelPrestamo(p, movimientos) {
  return movimientos
    .filter((m) => m.tipo === "Ingreso" && m.prestamo_id === p.id)
    .sort((a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0));
}

// En qué fecha toca el próximo cobro de un préstamo: la del interés, o el
// primer día pendiente de su plan de pagos diario. Sin fecha, al final.
function fechaProximoCobro(p, pagosPrestamos) {
  if (esPlanDePagos(p)) {
    const pendiente = pagosPrestamos
      .filter((pg) => pg.prestamo_id === p.id && !pg.pagado)
      .map((pg) => fromTimestamp(pg.fecha))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    return pendiente ? diaISO(pendiente) : "9999-12-31";
  }
  return p.fecha_interes || "9999-12-31";
}

// Qué historial está desplegado (se recuerda entre repintados).
const historialAbierto = new Set();

function renderHistorialPagos(p, movimientos) {
  const pagos = pagosDelPrestamo(p, movimientos);
  if (pagos.length === 0) return "";
  const total = pagos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0);
  const abierto = historialAbierto.has(p.id);
  const etiqueta = (m) =>
    m.subcategoria?.startsWith("Interés préstamo")
      ? "Interés"
      : m.subcategoria?.startsWith("Plan de pagos")
        ? "Cuota del plan"
        : m.subcategoria?.startsWith("Abono préstamo")
          ? "Abono"
          : m.subcategoria?.startsWith("Préstamo liquidado")
            ? "Liquidación"
            : "Pago";
  return `
    <button type="button" class="prestamo-historial__toggle" data-historial="${p.id}">
      Historial: ${pagos.length} ${pagos.length === 1 ? "pago" : "pagos"} · ${formatEUR(total)} cobrados ${abierto ? "▴" : "▾"}
    </button>
    ${
      abierto
        ? `<div class="pago-list">
        ${pagos
          .map(
            (m) => `
          <div class="mini-row">
            <div class="mini-row__body">
              <div class="mini-row__main">
                <span class="mini-row__title">${etiqueta(m)}</span>
                <span class="mini-row__sub">${formatFecha(fromTimestamp(m.fecha))}</span>
              </div>
            </div>
            <span class="mini-row__amount mini-row__amount--pos">+ ${formatEUR(Number(m.importe ?? 0))}</span>
          </div>`
          )
          .join("")}
      </div>`
        : ""
    }`;
}

export function renderPrestamos(state) {
  currentState = state;
  const el = document.getElementById("prestamos-grid");
  const { prestamos, pagosPrestamos, movimientos } = state;

  const activos = prestamos.filter((p) => p.estado !== "Pagado");
  // Un préstamo con plan de pagos diario no tiene un pendiente fijo: lo que
  // debe de verdad es lo que quede sin marcar como pagado en su lista de
  // días. El resto usan el modelo simple: total (capital + interés) menos
  // lo ya pagado.
  const totalPendiente = activos.reduce(
    (acc, p) => acc + (esPlanDePagos(p) ? restantePlanDePagos(p, pagosPrestamos) : pendienteDe(p)),
    0
  );
  // Los intereses a tu favor de los préstamos vivos (los del plan diario ya
  // van repartidos dentro de sus cuotas, así que no suman aparte).
  const totalInteres = activos.reduce((acc, p) => acc + (esPlanDePagos(p) ? 0 : interesTotalDe(p)), 0);
  document.getElementById("kpi-prestamos-capital").textContent = formatEUR(totalPendiente);
  document.getElementById("kpi-prestamos-interes").textContent = formatEUR(totalInteres);

  if (prestamos.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no has registrado ningún préstamo.</p>`;
    return;
  }

  // Orden: a quién le toca pagar antes, primero — por la fecha del próximo
  // cobro. Los que no tienen fecha van después, y los ya pagados al final.
  const ordenados = [...prestamos].sort((a, b) => {
    const pagadoA = a.estado === "Pagado";
    const pagadoB = b.estado === "Pagado";
    if (pagadoA !== pagadoB) return pagadoA ? 1 : -1;
    return fechaProximoCobro(a, pagosPrestamos).localeCompare(fechaProximoCobro(b, pagosPrestamos));
  });

  el.innerHTML = ordenados
    .map((p) => {
      // capital_inicial es el campo antiguo (de antes de simplificar
      // préstamos): si un préstamo todavía no tiene `capital` fijado, se
      // usa como respaldo temporal para no mostrar NaN/vacío.
      const capital = Number(p.capital ?? p.capital_inicial ?? 0);
      const planPagos = esPlanDePagos(p);
      const pct = Number(p.interes_porcentaje ?? 0);
      const interes = interesTotalDe(p);
      const total = totalDe(p);
      const pagado = pagadoDe(p);
      const pendiente = pendienteDe(p);
      const tagClass = p.estado === "Pagado" ? "entity-card__tag--pagado" : "entity-card__tag--activo";
      const montoMostrado = planPagos ? restantePlanDePagos(p, pagosPrestamos) : pendiente;
      // El desglose de la deuda, en una línea: qué se prestó, qué interés
      // lleva y cuánto ha devuelto ya. La barra es lo pagado sobre el total.
      const desglose = planPagos
        ? ""
        : `<p class="entity-card__meta">Prestado ${formatEUR(capital)}${
            interes > 0 ? ` + interés ${formatEUR(interes)}${!tieneInteresManual(p) && pct > 0 ? ` (${pct} %)` : ""} = debe ${formatEUR(total)}` : ""
          }${pagado > 0 ? ` · ya ha pagado ${formatEUR(pagado)}` : ""}${
            p.fecha_interes && p.estado !== "Pagado" ? ` · para el ${formatFecha(new Date(p.fecha_interes + "T00:00:00"))}` : ""
          }</p>
          ${
            p.estado !== "Pagado" && total > 0
              ? `<div class="progress-track" style="margin:4px 0 8px;"><div class="progress-fill" style="width:${Math.min(100, Math.round((pagado / total) * 100))}%"></div></div>`
              : ""
          }`;

      return wrapSwipe(
        `
        <article class="entity-card">
          <div class="entity-card__top">
            <div class="entity-card__heading">
              <span class="avatar" style="background:${avatarColor(p.persona)}">${initials(p.persona)}</span>
              <p class="entity-card__name">${esc(p.persona)}</p>
            </div>
            <div class="entity-card__top-actions">
              <span class="entity-card__tag ${tagClass}">${p.estado || "Activo"}</span>
              <button type="button" class="row-edit-btn" data-edit="${p.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>
          </div>
          <p class="entity-card__amount">${formatEUR(montoMostrado)} <span style="font-size:0.9rem;color:var(--text-muted);font-family:var(--font-body)">${p.estado === "Pagado" ? "— saldado" : "pendiente"}</span></p>
          ${desglose}
          ${p.notas ? `<p class="entity-card__meta">${esc(p.notas)}</p>` : ""}

          ${p.estado === "Pagado" ? `<p class="entity-card__meta">Préstamo cerrado.</p>` : planPagos ? renderPlanPagos(p, pagosPrestamos) : ""}
          ${renderHistorialPagos(p, movimientos)}
          ${
            p.estado !== "Pagado" && !planPagos
              ? `<button type="button" class="btn btn--ghost btn--sm btn--block" data-abono="${p.id}">± Ha pagado una parte</button>`
              : ""
          }
          ${
            p.estado !== "Pagado"
              ? `<button type="button" class="btn btn--ghost btn--sm btn--block prestamo-liquidar-btn" data-liquidar="${p.id}">💰 Ha pagado todo lo pendiente (liquidar)</button>`
              : ""
          }
        </article>`,
        p.id
      );
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openPrestamoForm(prestamos.find((p) => p.id === btn.dataset.edit), state))
  );
  el.querySelectorAll("[data-liquidar]").forEach((btn) =>
    btn.addEventListener("click", () => openLiquidarForm(prestamos.find((p) => p.id === btn.dataset.liquidar), state))
  );
  el.querySelectorAll("[data-abono]").forEach((btn) =>
    btn.addEventListener("click", () => openAbonoForm(prestamos.find((p) => p.id === btn.dataset.abono), state))
  );
  el.querySelectorAll("[data-historial]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.historial;
      if (historialAbierto.has(id)) historialAbierto.delete(id);
      else historialAbierto.add(id);
      renderPrestamos(currentState);
    })
  );
  el.querySelectorAll("[data-dia-pendiente]").forEach((btn) =>
    btn.addEventListener("click", () => openDiaPagadoForm(pagosPrestamos.find((pg) => pg.id === btn.dataset.diaPendiente), state))
  );
  el.querySelectorAll("[data-dia-pagado]").forEach((btn) =>
    btn.addEventListener("click", () => deshacerDiaPagado(pagosPrestamos.find((pg) => pg.id === btn.dataset.diaPagado)))
  );
  attachSwipe(el, (id) => eliminarPrestamo(prestamos.find((p) => p.id === id)), {
    confirmar:
      "¿Eliminar este préstamo? Los pagos ya registrados se quedan en Movimientos (ese dinero entró de verdad). Solo si nunca cobró nada, se borra también el gasto de cuando salió el dinero.",
  });
}

// Borrar un préstamo que NUNCA cobró nada se lleva por delante el
// movimiento que sacó el dinero de la cuenta al crearlo: fue un apunte por
// error y así no deja el saldo descuadrado ni un gasto suelto.
//
// Pero si el préstamo YA tiene pagos registrados, el dinero se movió de
// verdad (salió el gasto, entraron los pagos): ahí NO se toca ningún
// movimiento — borrar la tarjeta borrando solo la mitad de la historia
// dejaba la cuenta con dinero fantasma (pasó con un préstamo ya devuelto:
// se fue el −60 del origen, se quedaron los dos +30, y la cuenta subió
// 60 € que no existían).
async function eliminarPrestamo(prestamo) {
  if (!prestamo) return;
  const cobros = pagosDelPrestamo(prestamo, currentState?.movimientos ?? []);
  if (prestamo.movimiento_origen_id && cobros.length === 0) {
    try {
      await deleteMovimiento(prestamo.movimiento_origen_id);
    } catch (err) {
      console.error("No se pudo borrar el movimiento de origen del préstamo:", err);
    }
  }
  await deletePrestamo(prestamo.id);
}

// Plan de pagos diario: en vez de un interés mensual único, se muestra la
// lista de días (cada uno con su cuota) para poder marcar/desmarcar día a
// día lo que de verdad se ha cobrado.
function renderPlanPagos(prestamo, pagosPrestamos) {
  const dias = pagosPrestamos
    .filter((pg) => pg.prestamo_id === prestamo.id)
    .sort((a, b) => (fromTimestamp(a.fecha) ?? 0) - (fromTimestamp(b.fecha) ?? 0));

  if (dias.length === 0) {
    return `<p class="entity-card__meta">Sin días configurados todavía — edita el préstamo o pide que se genere el plan.</p>`;
  }

  const pagados = dias.filter((pg) => pg.pagado).length;

  return `
    <div class="plan-pagos">
      <p class="prestamo-interes__label">Plan de pagos diario · ${pagados} de ${dias.length} días cobrados</p>
      <div class="pago-list">
        ${dias
          .map((pg) => {
            const fecha = fromTimestamp(pg.fecha);
            const attr = pg.pagado ? `data-dia-pagado="${pg.id}"` : `data-dia-pendiente="${pg.id}"`;
            return `
            <button type="button" class="mini-row" ${attr}>
              <div class="mini-row__body">
                <span class="mini-row__icon">${pg.pagado ? icon("check", { size: 16 }) : formatFecha(fecha).slice(0, 2)}</span>
                <div class="mini-row__main">
                  <span class="mini-row__title">${formatFecha(fecha)}</span>
                  <span class="mini-row__sub">${pg.pagado ? "Cobrado — toca para deshacer" : "Pendiente — toca para marcar"}</span>
                </div>
              </div>
              <span class="mini-row__amount ${pg.pagado ? "mini-row__amount--pos" : ""}">${formatEUR(pg.importe)}</span>
            </button>`;
          })
          .join("")}
      </div>
    </div>`;
}

// Marcar un día concreto del plan de pagos diario como cobrado: el importe
// es editable (por defecto, la cuota que toque ese día),
// porque un día puede pagarse de más o de menos que lo esperado.
function openDiaPagadoForm(pago, state) {
  const prestamo = state.prestamos.find((p) => p.id === pago.prestamo_id);
  const fecha = fromTimestamp(pago.fecha);

  openModal(
    `
    <h2 class="modal__title">Día pagado · ${formatFecha(fecha)}</h2>
    <form id="form-dia-pagado" class="form-grid">
      <label class="field">
        <span class="field__label">Importe</span>
        <input type="number" step="0.01" name="importe" required value="${Number(pago.importe ?? 0).toFixed(2)}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Cuenta</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: prestamo?.cuenta_id })}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Fecha del cobro</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <p class="field-error" id="form-dia-pagado-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Confirmar</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-dia-pagado").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          try {
            const importe = Number(f.importe.value);
            const movimiento = await addMovimiento({
              tipo: "Ingreso",
              importe,
              categoria_id: null,
              cuenta_id: f.cuenta_id.value,
              cuenta_destino_id: null,
              fecha: toTimestamp(f.fecha.value),
              subcategoria: `Plan de pagos · ${prestamo?.persona ?? ""} · ${formatFecha(fecha)}`,
              nota: "",
              prestamo_id: prestamo?.id ?? null,
            });
            await updatePagoPrestamo(pago.id, { pagado: true, importe, movimiento_id: movimiento.id });
            closeModal();
          } catch (err) {
            root.querySelector("#form-dia-pagado-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

// Deshace un día ya marcado como cobrado por error: borra el ingreso que se
// había registrado y vuelve a dejar el día como pendiente.
async function deshacerDiaPagado(pago) {
  if (!confirm("¿Deshacer este pago? Se borrará el ingreso registrado y el día volverá a quedar pendiente.")) return;
  if (pago.movimiento_id) {
    try {
      await deleteMovimiento(pago.movimiento_id);
    } catch (err) {
      console.error("No se pudo borrar el ingreso del día deshecho:", err);
    }
  }
  await updatePagoPrestamo(pago.id, { pagado: false, movimiento_id: null });
}

// Un pago: la persona devuelve una parte de lo que debe (30 € de una deuda
// de 120, por ejemplo). Nada de repartir entre interés y capital — el
// importe simplemente resta del total pendiente, y si con este pago llega
// a cero, el préstamo se cierra solo como Pagado.
function openAbonoForm(prestamo, state) {
  const pendiente = pendienteDe(prestamo);
  const total = totalDe(prestamo);

  const resumenDe = (importe) => {
    if (!(importe > 0)) {
      return `Debe <strong>${formatEUR(pendiente)}</strong>${pagadoDe(prestamo) > 0 ? ` (de ${formatEUR(total)} en total)` : ""}. Escribe cuánto ha pagado.`;
    }
    if (importe >= pendiente - 0.004) {
      return `Con ${formatEUR(importe)} queda <strong>todo saldado</strong>: el préstamo se cerrará como Pagado.`;
    }
    return `Quedarán por pagar <strong>${formatEUR(round2(pendiente - importe))}</strong>.`;
  };

  openModal(
    `
    <h2 class="modal__title">Abono · ${prestamo.persona}</h2>
    <form id="form-abono" class="form-grid">
      <label class="field">
        <span class="field__label">¿Cuánto ha pagado?</span>
        <input type="number" step="0.01" min="0.01" name="importe" required placeholder="30.00" />
      </label>
      <label class="field">
        <span class="field__label">¿A qué cuenta entra?</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: prestamo.cuenta_id })}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <p class="entity-card__meta field--full" id="abono-resumen">${resumenDe(0)}</p>
      <p class="field-error" id="form-abono-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Registrar el abono</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector('#form-abono [name="importe"]').addEventListener("input", (e) => {
          root.querySelector("#abono-resumen").innerHTML = resumenDe(Number(e.target.value || 0));
        });
        root.querySelector("#form-abono").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const importe = Number(f.importe.value);
          if (!(importe > 0)) return;
          try {
            await addMovimiento({
              tipo: "Ingreso",
              importe,
              categoria_id: null,
              cuenta_id: f.cuenta_id.value,
              cuenta_destino_id: null,
              fecha: toTimestamp(f.fecha.value),
              subcategoria: `Abono préstamo · ${prestamo.persona}`,
              nota: "",
              prestamo_id: prestamo.id,
            });
            // El pago solo suma a "pagado": el capital y el interés del
            // préstamo no se tocan, así el desglose siempre cuenta la
            // historia completa (prestado + interés − pagado = pendiente).
            const saldado = importe >= pendiente - 0.004;
            await updatePrestamo(prestamo.id, {
              pagado: round2(pagadoDe(prestamo) + importe),
              ...(saldado ? { estado: "Pagado" } : {}),
            });
            if (saldado) efectoDeCelebracion();
            closeModal();
          } catch (err) {
            root.querySelector("#form-abono-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

// Cuando la persona paga TODO de golpe (el capital pendiente + el interés
// actual), no basta con marcar el interés como pagado (eso solo mueve la
// La persona paga de golpe TODO lo que le queda: se registra un único
// ingreso por el pendiente y el préstamo se cierra como Pagado.
function openLiquidarForm(prestamo, state) {
  const planPagos = esPlanDePagos(prestamo);
  const total = planPagos ? restantePlanDePagos(prestamo, state.pagosPrestamos) : pendienteDe(prestamo);

  openModal(
    `
    <h2 class="modal__title">Liquidar deuda · ${prestamo.persona}</h2>
    <p class="entity-card__meta" style="margin-bottom:16px;">
      ${
        planPagos
          ? `Quedan ${formatEUR(total)} pendientes del plan de pagos diario.`
          : `Le quedan por pagar <strong>${formatEUR(total)}</strong>${pagadoDe(prestamo) > 0 ? ` (de ${formatEUR(totalDe(prestamo))} en total, ya había pagado ${formatEUR(pagadoDe(prestamo))})` : ` (capital + interés)`}.`
      }
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
              prestamo_id: prestamo.id,
            });
            // Pagado = el total: el desglose de la tarjeta queda contando
            // la historia completa aunque el préstamo esté cerrado.
            await updatePrestamo(prestamo.id, { pagado: planPagos ? pagadoDe(prestamo) : totalDe(prestamo), estado: "Pagado" });
            // El ingreso de arriba ya cubre TODO lo que quedaba, así que los
            // días pendientes del plan se marcan pagados sin crear un
            // ingreso por cada uno (ya está contado en el de golpe).
            if (planPagos) {
              const pendientes = state.pagosPrestamos.filter((pg) => pg.prestamo_id === prestamo.id && !pg.pagado);
              await Promise.all(pendientes.map((pg) => updatePagoPrestamo(pg.id, { pagado: true })));
            }
            // Saldar una deuda entera merece más que el destello de guardar
            // de siempre. Va antes de cerrar el modal para que se dispare
            // aunque el cierre tarde: closeModal detecta que hay una
            // celebración en marcha y se calla.
            efectoDeCelebracion();
            closeModal();
          } catch (err) {
            root.querySelector("#form-liquidar-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function openPrestamoForm(prestamo, state) {
  const isEdit = Boolean(prestamo);
  const capital = prestamo ? Number(prestamo.capital ?? prestamo.capital_inicial ?? 0) : "";
  const cuentas = state?.cuentas ?? [];
  // De dónde sale el dinero solo se pregunta al CREAR el préstamo. Al
  // editar uno que ya existe no aparece: el dinero ya salió en su día, y
  // volver a preguntarlo solo serviría para descontarlo dos veces.
  const preguntarOrigen = !isEdit && cuentas.length > 0;
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar préstamo" : "Nuevo préstamo"}</h2>
    <form id="form-prestamo" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Persona</span>
        <input type="text" name="persona" required value="${esc(prestamo?.persona ?? "")}" placeholder="Nombre de la persona" />
      </label>
      <label class="field">
        <span class="field__label">Capital prestado</span>
        <input type="number" step="0.01" name="capital" required value="${capital}" placeholder="100.00" />
      </label>
      ${
        preguntarOrigen
          ? `
      <label class="field">
        <span class="field__label">¿De qué cuenta sale el dinero?</span>
        <select name="cuenta_origen_id">
          ${optionsFrom(cuentas)}
          <option value="">No descontarlo de ninguna cuenta</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">¿Qué día se lo diste?</span>
        <input type="date" name="fecha_entrega" value="${todayISO()}" />
      </label>
      <p class="entity-card__meta field--full" style="margin:-4px 0 4px;">
        El capital sale de esa cuenta y cuenta como gasto del día: ese dinero
        ya no lo tienes. Cuando te lo devuelvan, entrará como ingreso.
      </p>`
          : ""
      }
      <label class="field">
        <span class="field__label">Interés (%)</span>
        <input type="number" step="0.01" name="interes_porcentaje" value="${prestamo?.interes_porcentaje ?? 0}" placeholder="20" />
      </label>
      <label class="field">
        <span class="field__label">Interés fijo (€, opcional)</span>
        <input type="number" step="0.01" name="interes_manual" value="${prestamo?.interes_manual ?? ""}" placeholder="Vacío = se calcula con el %" />
      </label>
      <p class="entity-card__meta field--full" id="prestamo-total-linea" style="margin:-4px 0 4px;"></p>
      ${
        isEdit
          ? `
      <label class="field">
        <span class="field__label">Ya pagado hasta ahora (€)</span>
        <input type="number" step="0.01" name="pagado" value="${pagadoDe(prestamo)}" placeholder="0.00" />
      </label>`
          : ""
      }
      <label class="field">
        <span class="field__label">¿Para cuándo debería pagarlo? (opcional)</span>
        <input type="date" name="fecha_interes" value="${prestamo?.fecha_interes ?? ""}" />
      </label>
      <label class="field">
        <span class="field__label">Estado</span>
        <select name="estado">${ESTADOS.map((e) => `<option ${prestamo?.estado === e ? "selected" : ""}>${e}</option>`).join("")}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Notas del préstamo (opcional)</span>
        <textarea name="notas" rows="3" placeholder="Los detalles para tenerlo controlado: qué acordasteis, cuándo prometió pagar, si dejó algo a cuenta…">${esc(prestamo?.notas ?? "")}</textarea>
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
        const form = root.querySelector("#form-prestamo");
        // La línea del total, en vivo: capital + interés = lo que debe.
        const pintarTotal = () => {
          const cap = Number(form.capital.value || 0);
          const manual = form.interes_manual.value !== "" ? Number(form.interes_manual.value) : null;
          const interes = manual !== null ? manual : round2(cap * (Number(form.interes_porcentaje.value || 0) / 100));
          root.querySelector("#prestamo-total-linea").innerHTML =
            cap > 0 ? `Total a devolver: <strong>${formatEUR(round2(cap + interes))}</strong>${interes > 0 ? ` (${formatEUR(cap)} + ${formatEUR(interes)} de interés)` : ""}. Cada pago resta de ahí hasta liquidar.` : "";
        };
        pintarTotal();
        ["capital", "interes_porcentaje", "interes_manual"].forEach((n) => form[n].addEventListener("input", pintarTotal));
        form.addEventListener("submit", async (e) => {
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
          // Al editar se puede corregir a mano cuánto lleva pagado (para
          // cuadrar préstamos antiguos); si con eso queda a cero, se cierra.
          if (isEdit && f.pagado) {
            data.pagado = Number(f.pagado.value || 0);
            const interes = data.interes_manual !== null ? data.interes_manual : round2(data.capital * (data.interes_porcentaje / 100));
            if (data.pagado >= round2(data.capital + interes) - 0.004 && data.pagado > 0) data.estado = "Pagado";
          }
          try {
            if (isEdit) {
              await updatePrestamo(prestamo.id, data);
            } else {
              const cuentaOrigen = preguntarOrigen ? f.cuenta_origen_id.value : "";
              if (cuentaOrigen) {
                // Se guarda como "Gasto": ese dinero ya no está, y así las
                // cuentas del mes cuadran con la realidad. La otra mitad de
                // la simetría ya existe — cada cobro (interés, plan,
                // liquidación) entra como "Ingreso" cuando llega.
                const categoriaPrestamos = (state?.categorias ?? []).find((c) => /pr[eé]stamo/i.test(c.nombre || ""));
                const movimiento = await addMovimiento({
                  tipo: "Gasto",
                  importe: data.capital,
                  categoria_id: categoriaPrestamos?.id ?? null,
                  cuenta_id: cuentaOrigen,
                  cuenta_destino_id: null,
                  fecha: toTimestamp(f.fecha_entrega.value || todayISO()),
                  subcategoria: `Préstamo a ${data.persona}`,
                  nota: "",
                });
                // La cuenta se queda apuntada en el préstamo: los cobros
                // (interés, días del plan, liquidación) ya la traen puesta
                // por defecto, que es donde suele volver el dinero.
                data.cuenta_id = cuentaOrigen;
                data.movimiento_origen_id = movimiento.id;
              }
              await addPrestamo(data);
            }
            closeModal();
          } catch (err) {
            root.querySelector("#form-prestamo-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
