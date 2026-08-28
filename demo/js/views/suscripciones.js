import {
  addSuscripcion,
  updateSuscripcion,
  deleteSuscripcion,
  addMovimiento,
  updateMovimiento,
  deleteMovimiento,
  formatEUR,
  formatFecha,
  fromTimestamp,
  toTimestamp,
  fechaISO,
  textoPeriodo,
} from "../db.js?v=81";
import { openModal, closeModal, optionsFrom, todayISO } from "../modal.js?v=81";
import { icon, iconForSuscripcion } from "../icons.js?v=81";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=81";

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
// suscripcion_id) que caen dentro de un mes — así se sabe si esa
// suscripción ya está "pagada" ese periodo sin necesitar un estado aparte
// que se pueda desincronizar del movimiento real.
//
// Son varios y no uno: un recibo se puede pagar a trozos y desde sitios
// distintos (40 € en efectivo y 1,49 € con la tarjeta), y cada trozo es su
// propio movimiento porque sale de una cuenta distinta.
function pagosDeMes(movimientos, suscripcionId, mes) {
  return movimientos.filter((m) => {
    if (m.suscripcion_id !== suscripcionId) return false;
    const d = fromTimestamp(m.fecha);
    return d && d.getFullYear() === mes.getFullYear() && d.getMonth() === mes.getMonth();
  });
}

function pagosDelMes(movimientos, suscripcionId) {
  return pagosDeMes(movimientos, suscripcionId, mesActual);
}

function sumaPagos(pagos) {
  return pagos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0);
}

// Cada cuántos meses toca pagar cada frecuencia.
const MESES_POR_FRECUENCIA = { Mensual: 1, Bimensual: 2, Anual: 12 };

function cadaCuantosMeses(suscripcion) {
  return MESES_POR_FRECUENCIA[suscripcion?.frecuencia] ?? 1;
}

// ¿Toca pagar esto en el mes que se está viendo?
//
// Lo mensual, siempre. Lo bimensual o anual, solo si no se ha pagado ya
// dentro de su ciclo: el agua que se pagó en julio no vuelve a tocar en
// agosto, toca en septiembre. Sin esto, un recibo de cada dos meses salía
// como pendiente todos los meses e inflaba el total de abajo.
function tocaEsteMes(suscripcion, movimientos) {
  const cada = cadaCuantosMeses(suscripcion);
  if (cada === 1) return true;
  return mesDelUltimoPagoDelCiclo(suscripcion, movimientos) === null;
}

// El mes, dentro del ciclo que acaba en el mes visible, en el que ya se
// pagó. null si no se pagó en ninguno.
function mesDelUltimoPagoDelCiclo(suscripcion, movimientos) {
  const cada = cadaCuantosMeses(suscripcion);
  for (let atras = 1; atras < cada; atras++) {
    const mes = new Date(mesActual.getFullYear(), mesActual.getMonth() - atras, 1);
    if (pagosDeMes(movimientos, suscripcion.id, mes).length > 0) return mes;
  }
  return null;
}

function nombreDeMes(fecha) {
  const t = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(fecha);
  return t.charAt(0).toUpperCase() + t.slice(1);
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
  let tocanCount = 0;

  el.innerHTML = ordenadas
    .map((s) => {
      const pagos = pagosDelMes(movimientos, s.id);
      const pagada = pagos.length > 0;
      // Si ya se pagó este mes, cuenta como que tocaba: lo que manda es lo
      // que pasó de verdad, no lo que decía la frecuencia.
      const toca = pagada || tocaEsteMes(s, movimientos);
      const importeReal = pagada ? sumaPagos(pagos) : Number(s.precio ?? 0);
      const activa = s.activa !== false;
      if (activa && toca) {
        tocanCount++;
        if (pagada) {
          pagadoTotal += importeReal;
          pagadasCount++;
        } else pendienteTotal += importeReal;
      }

      // Debajo del nombre: en qué se gasta y de dónde sale. Si ya está
      // pagado se cambia por lo que pasó de verdad —de qué cuentas salió y
      // qué periodo cubre la factura—, que es lo que interesa mirar.
      let sub;
      if (!activa) {
        sub = `${catMap.get(s.categoria_id) || "—"} · Inactiva`;
      } else if (pagada) {
        // Con una sola factura cabe el desglose entero (de qué cuenta salió
        // cada trozo). Con dos o más no cabe, y lo que importa saber de un
        // vistazo es justo eso: que este mes han llegado dos recibos.
        const facturas = agruparPorFactura(pagos);
        if (facturas.length > 1) {
          sub = `${facturas.length} facturas · ${facturas.map((f) => textoPeriodo({ periodo_desde: f.desde, periodo_hasta: f.hasta }) || "sin periodo").join(" y ")}`;
        } else {
          const desglose = pagos.map((m) => `${formatEUR(Number(m.importe ?? 0))} ${cuentaMap.get(m.cuenta_id) || "—"}`).join(" + ");
          const periodo = textoPeriodo(pagos.find((m) => textoPeriodo(m)) ?? {});
          sub = `${desglose}${periodo ? ` · ${periodo}` : ""}`;
        }
      } else if (!toca) {
        const proximo = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
        sub = `Cada ${cadaCuantosMeses(s)} meses · ya pagado, toca en ${nombreDeMes(proximo).toLowerCase()}`;
      } else {
        sub = `${catMap.get(s.categoria_id) || "—"} · ${cuentaMap.get(s.cuenta_id) || "—"}`;
      }

      return wrapSwipe(
        `
        <div class="mini-row susc-row ${!activa || !toca ? "susc-row--inactiva" : ""}">
          <label class="field-check" style="flex:1; min-width:0;">
            <input type="checkbox" data-toggle-susc="${s.id}" ${pagada ? "checked" : ""} ${!activa || !toca ? "disabled" : ""} />
            <span class="mini-row__body" style="min-width:0;">
              <span class="mini-row__icon">${icon(iconForSuscripcion(s.nombre))}</span>
              <span class="mini-row__main">
                <span class="mini-row__title">${s.nombre}</span>
                <span class="mini-row__sub">${sub}</span>
              </span>
            </span>
          </label>
          ${
            pagada
              ? `<button type="button" class="mini-row__amount susc-row__pagos" data-pagos="${s.id}" title="Ver los pagos de este mes">${formatEUR(importeReal)}</button>`
              : `<span class="mini-row__amount">${toca ? formatEUR(importeReal) : "—"}</span>`
          }
          <button type="button" class="row-edit-btn" data-edit="${s.id}" title="Editar">${icon("edit", { size: 15 })}</button>
        </div>`,
        s.id
      );
    })
    .join("");

  document.getElementById("susc-resumen").textContent =
    `Pagado este mes: ${formatEUR(pagadoTotal)} (${pagadasCount}/${tocanCount}) · Pendiente: ${formatEUR(pendienteTotal)}`;

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(suscripciones.find((s) => s.id === btn.dataset.edit), currentState))
  );
  el.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("¿Eliminar este gasto fijo? No se borrarán los gastos ya registrados.")) deleteSuscripcion(btn.dataset.delete);
    })
  );
  el.querySelectorAll("[data-pagos]").forEach((btn) =>
    btn.addEventListener("click", () => openPagosDelMes(suscripciones.find((s) => s.id === btn.dataset.pagos), currentState))
  );
  el.querySelectorAll("[data-toggle-susc]").forEach((input) =>
    input.addEventListener("change", () => {
      const s = suscripciones.find((x) => x.id === input.dataset.toggleSusc);
      if (input.checked) openMarcarPagado(s, currentState, input);
      else {
        input.checked = true; // se revierte visualmente hasta que se confirme el borrado
        const pagos = pagosDelMes(movimientos, s.id);
        const aviso =
          pagos.length > 1
            ? `¿Deshacer el pago de "${s.nombre}" este mes? Se borrarán los ${pagos.length} gastos registrados. Para borrar solo uno, toca el importe.`
            : `¿Deshacer el pago de "${s.nombre}" este mes? Se borrará el gasto registrado.`;
        if (pagos.length > 0 && confirm(aviso)) {
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
// yaPagado: lo que ya se ha pagado de este recibo este mes, cuando se está
// añadiendo un segundo trozo (40 € en efectivo y el resto con la tarjeta).
// El importe viene puesto con lo que falta, que es lo que se va a escribir
// nueve de cada diez veces.
// pago: un pago ya apuntado que se está CORRIGIENDO. Poder corregirlo
// importa porque el importe viene puesto con el precio habitual, y una luz
// o un agua casi nunca cuesta lo mismo dos meses seguidos: es facilísimo
// guardar la estimación en vez de lo que se pagó de verdad. Antes eso solo
// se podía deshacer borrando el pago entero.
function openMarcarPagado(suscripcion, state, checkboxInput, { yaPagado = 0, periodo = {}, pago = null } = {}) {
  let saved = false;
  const editando = Boolean(pago);
  const esOtroTrozo = !editando && yaPagado > 0;
  // Redondeado a céntimos: restar decimales en JavaScript da cosas como
  // 1.490000000000002, y eso es lo que aparecería escrito en la casilla.
  const restante = Math.max(0, Math.round((Number(suscripcion.precio ?? 0) - yaPagado) * 100) / 100);
  openModal(
    `
    <h2 class="modal__title">${
      editando ? `Corregir pago de "${suscripcion.nombre}"` : esOtroTrozo ? `Otro pago de "${suscripcion.nombre}"` : `Marcar "${suscripcion.nombre}" como pagado`
    }</h2>
    <form id="form-susc-pago" class="form-grid">
      ${
        esOtroTrozo
          ? `<p class="entity-card__meta field--full" style="margin:0 0 4px;">
        De la factura ${textoPeriodo({ periodo_desde: periodo.desde, periodo_hasta: periodo.hasta }) || "sin periodo"} ya
        llevas ${formatEUR(yaPagado)} pagados. Apunta aquí lo que hayas pagado
        desde otro sitio.
      </p>`
          : ""
      }
      <label class="field">
        <span class="field__label">${esOtroTrozo ? "¿Cuánto más?" : "Importe"}</span>
        <input type="number" step="0.01" name="importe" required value="${
          editando ? pago.importe : esOtroTrozo ? restante || "" : suscripcion.precio ?? ""
        }" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">¿De qué cuenta sale?</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: editando ? pago.cuenta_id : suscripcion.cuenta_id })}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">¿Qué día lo pagaste?</span>
        <input type="date" name="fecha" value="${editando ? fechaISO(fromTimestamp(pago.fecha)) : todayISO()}" required />
      </label>
      <p class="entity-card__meta field--full" style="margin:4px 0 -4px;">
        Periodo que cubre la factura (opcional), el que viene en el recibo.
      </p>
      <label class="field">
        <span class="field__label">Desde</span>
        <input type="date" name="periodo_desde" value="${editando ? pago.periodo_desde ?? "" : periodo.desde ?? ""}" />
      </label>
      <label class="field">
        <span class="field__label">Hasta</span>
        <input type="date" name="periodo_hasta" value="${editando ? pago.periodo_hasta ?? "" : periodo.hasta ?? ""}" />
      </label>
      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="nota" value="${editando ? pago.nota ?? "" : ""}" placeholder="Factura de julio" />
      </label>
      <label class="field-check field--full">
        <input type="checkbox" name="no_afecta_saldo" ${editando && pago.afecta_saldo === false ? "checked" : ""} />
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
            // La nota sirve para decir QUÉ recibo es este pago ("factura de
            // julio"), que con la luz o el agua casi nunca es el mes en el
            // que se paga. Va en `nota` y no en `subcategoria` a propósito:
            // la subcategoría es la que agrupa en "Dónde más gastas", y si
            // cambiara cada mes la luz saldría partida en doce trozos.
            nota: f.nota.value.trim(),
            periodo_desde: f.periodo_desde.value || null,
            periodo_hasta: f.periodo_hasta.value || null,
            suscripcion_id: suscripcion.id,
            afecta_saldo: !f.no_afecta_saldo.checked,
          };
          try {
            if (editando) await updateMovimiento(pago.id, data);
            else await addMovimiento(data);
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

// Los pagos agrupados por factura. Dos recibos de la luz pueden caer en el
// mismo mes (llega el de junio y a los días el de julio), y cada uno se
// puede pagar desde varios sitios. Lo que hace de "factura" es el periodo
// que cubre: los pagos que cubren el mismo tramo son el mismo recibo.
// Los pagos sin periodo se quedan juntos en un grupo aparte.
function agruparPorFactura(pagos) {
  const grupos = new Map();
  pagos.forEach((m) => {
    const clave = `${m.periodo_desde ?? ""}|${m.periodo_hasta ?? ""}`;
    if (!grupos.has(clave)) grupos.set(clave, { clave, desde: m.periodo_desde ?? "", hasta: m.periodo_hasta ?? "", pagos: [] });
    grupos.get(clave).pagos.push(m);
  });
  // Por el principio del periodo, y las que no tienen periodo al final.
  return [...grupos.values()].sort((a, b) => (a.desde || "9999").localeCompare(b.desde || "9999"));
}

// Las facturas de este recibo en el mes que se está viendo, cada una con
// sus pagos. Aquí se ve cuántos recibos han llegado, cuánto suma cada uno y
// de qué cuenta salió cada trozo; se puede corregir un pago, borrarlo,
// añadir otro a una factura, o dar de alta otra factura del mismo mes.
function openPagosDelMes(suscripcion, state) {
  const { movimientos, cuentas } = state;
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c.nombre]));
  const pagos = pagosDelMes(movimientos, suscripcion.id).sort((a, b) => (fromTimestamp(a.fecha) ?? 0) - (fromTimestamp(b.fecha) ?? 0));
  const facturas = agruparPorFactura(pagos);
  const total = sumaPagos(pagos);
  const mesLabel = nombreDeMes(mesActual);

  openModal(
    `
    <h2 class="modal__title">${suscripcion.nombre} · ${mesLabel}</h2>
    <p class="entity-card__meta" style="margin:-12px 0 14px;">
      ${facturas.length === 1 ? "1 factura" : `${facturas.length} facturas`} este mes ·
      <strong>${formatEUR(total)}</strong> en total. Toca un pago para corregirlo.
    </p>
    ${facturas
      .map(
        (f) => `
      <div class="factura">
        <div class="factura__cabecera">
          <span class="factura__periodo">${textoPeriodo({ periodo_desde: f.desde, periodo_hasta: f.hasta }) || "Sin periodo apuntado"}</span>
          <span class="factura__total">${formatEUR(sumaPagos(f.pagos))}</span>
        </div>
        <div class="pago-list">
          ${f.pagos
            .map(
              (m) => `
            <div class="mini-row">
              <button type="button" class="susc-pago-editar" data-editar-pago="${m.id}">
                <span class="mini-row__main">
                  <span class="mini-row__title">${cuentaMap.get(m.cuenta_id) || "—"}</span>
                  <span class="mini-row__sub">${formatFecha(fromTimestamp(m.fecha))}${m.nota ? ` · ${m.nota}` : ""}</span>
                </span>
                <span class="mini-row__amount">${formatEUR(Number(m.importe ?? 0))}</span>
              </button>
              <button type="button" class="row-edit-btn" data-borrar-pago="${m.id}" title="Borrar este pago">${icon("trash", { size: 15 })}</button>
            </div>`
            )
            .join("")}
        </div>
        <button type="button" class="btn btn--ghost btn--sm btn--block" data-pago-a-factura="${f.clave}">
          + Añadir un pago a esta factura
        </button>
      </div>`
      )
      .join("")}
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="btn-cerrar-pagos">Cerrar</button>
      <button type="button" class="btn btn--primary" id="btn-otra-factura">+ Otra factura</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cerrar-pagos").addEventListener("click", closeModal);
        // Otra factura del mismo mes: empieza de cero, con su propio periodo
        // y el precio habitual de guía.
        root.querySelector("#btn-otra-factura").addEventListener("click", () => {
          closeModal();
          openMarcarPagado(suscripcion, state, null, {});
        });
        root.querySelectorAll("[data-pago-a-factura]").forEach((btn) =>
          btn.addEventListener("click", () => {
            const f = facturas.find((x) => x.clave === btn.dataset.pagoAFactura);
            closeModal();
            openMarcarPagado(suscripcion, state, null, {
              yaPagado: sumaPagos(f.pagos),
              periodo: { desde: f.desde, hasta: f.hasta },
            });
          })
        );
        root.querySelectorAll("[data-editar-pago]").forEach((btn) =>
          btn.addEventListener("click", () => {
            closeModal();
            openMarcarPagado(suscripcion, state, null, { pago: pagos.find((m) => m.id === btn.dataset.editarPago) });
          })
        );
        root.querySelectorAll("[data-borrar-pago]").forEach((btn) =>
          btn.addEventListener("click", async () => {
            if (!confirm("¿Borrar este pago? El dinero volverá a la cuenta de la que salió.")) return;
            await deleteMovimiento(btn.dataset.borrarPago);
            closeModal();
          })
        );
      },
    }
  );
}

function openForm(suscripcion, state) {
  const isEdit = Boolean(suscripcion);
  // Esta pantalla es la FICHA del gasto fijo (cómo se llama, cuánto suele
  // costar), no un pago, así que aquí no hay fecha ni la va a haber. Pero es
  // donde se entra buscando "hacer algo con la luz", así que lleva un atajo
  // a apuntar el pago del mes, que es lo que se suele venir a hacer.
  const pagosDeEsteMes = isEdit ? pagosDelMes(state.movimientos, suscripcion.id) : [];
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar gasto fijo" : "Nuevo gasto fijo"}</h2>
    ${
      isEdit
        ? `<p class="entity-card__meta" style="margin:-6px 0 8px;">
      Esto es la ficha: cómo se llama y lo que suele costar. Lo que pagas cada
      mes, con su fecha y el periodo de la factura, se apunta aparte.
    </p>
    <button type="button" class="btn btn--ghost btn--sm btn--block" id="btn-ir-a-pagar" style="margin-bottom:14px;">${
      pagosDeEsteMes.length > 0 ? "Ver los pagos de este mes" : "Apuntar el pago de este mes"
    }</button>`
        : ""
    }
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
        root.querySelector("#btn-ir-a-pagar")?.addEventListener("click", () => {
          closeModal();
          // Si ya hay algo pagado este mes se abre la lista de pagos (desde
          // ahí se añade otro trozo); si no, directo a apuntar el primero.
          if (pagosDeEsteMes.length > 0) openPagosDelMes(suscripcion, state);
          else openMarcarPagado(suscripcion, state, null);
        });
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
