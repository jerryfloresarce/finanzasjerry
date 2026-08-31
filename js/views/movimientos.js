import {
  addMovimiento,
  updateMovimiento,
  deleteMovimiento,
  formatEUR,
  formatFecha,
  fromTimestamp,
  toTimestamp,
  fechaISO,
  destinoTransferencia,
  textoPeriodo,
  nombreDeCuenta,
} from "../db.js?v=102";
import { openModal, closeModal, optionsFrom, todayISO, esc } from "../modal.js?v=102";
import { icon, entityIcon, iconForCategoriaTipo } from "../icons.js?v=102";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=102";
import { colorTema } from "../tema.js?v=102";

let currentState = null;
// Primer día del mes que se está viendo en el calendario.
let mesActual = firstOfMonth(new Date());
let chartComparativa = null;

function firstOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function mismoDia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function mountMovimientos() {
  document.getElementById("btn-add-movimiento").addEventListener("click", () => openForm(null, currentState));
  document.getElementById("cal-mes-prev").addEventListener("click", () => {
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1);
    if (currentState) renderMovimientos(currentState);
  });
  document.getElementById("cal-mes-next").addEventListener("click", () => {
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
    if (currentState) renderMovimientos(currentState);
  });
}

export function renderMovimientos(state) {
  currentState = state;
  const { movimientos, categorias, cuentas } = state;

  const mesLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(mesActual);
  document.getElementById("cal-mes-label").textContent = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  const delMes = movimientos.filter((m) => {
    const d = fromTimestamp(m.fecha);
    return d && d.getFullYear() === mesActual.getFullYear() && d.getMonth() === mesActual.getMonth();
  });

  const ingresosMes = delMes.filter((m) => m.tipo === "Ingreso").reduce((acc, m) => acc + Number(m.importe ?? 0), 0);
  const gastosMes = delMes.filter((m) => m.tipo === "Gasto").reduce((acc, m) => acc + Number(m.importe ?? 0), 0);

  document.getElementById("mov-kpi-ingresos").textContent = formatEUR(ingresosMes);
  document.getElementById("mov-kpi-gastos").textContent = formatEUR(gastosMes);
  const diferenciaEl = document.getElementById("mov-kpi-diferencia");
  diferenciaEl.textContent = formatEUR(ingresosMes - gastosMes);
  diferenciaEl.classList.toggle("kpi-tile__value--pos", ingresosMes - gastosMes >= 0);

  renderComparativa(ingresosMes, gastosMes);
  renderCalendario(delMes, categorias, cuentas);

  // Si hay un día abierto en el modal, se repinta con los datos recién
  // llegados. Sin esto, al borrar un movimiento desde dentro del modal la
  // fila seguía ahí (solo se repintaba el calendario de detrás), y parecía
  // que el borrado no había funcionado hasta cerrar y volver a abrir.
  if (diaAbierto) openDiaDetalle(diaAbierto, state);
}

function renderComparativa(ingresos, gastos) {
  const canvas = document.getElementById("chart-mov-comparativa");
  if (!canvas || typeof Chart === "undefined") return;
  if (chartComparativa) chartComparativa.destroy();

  chartComparativa = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Este mes"],
      datasets: [
        { label: "Ingresos", data: [ingresos], backgroundColor: colorTema("--success", "#7a9b81"), borderRadius: 6, maxBarThickness: 40 },
        { label: "Gastos", data: [gastos], backgroundColor: colorTema("--danger", "#b06a63"), borderRadius: 6, maxBarThickness: 40 },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", align: "end", labels: { color: colorTema("--chart-leyenda", "#9fada4"), boxWidth: 8, font: { family: "Inter", size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatEUR(ctx.parsed.x)}` } },
      },
      scales: {
        x: {
          grid: { color: colorTema("--chart-rejilla", "rgba(233,238,234,0.06)") },
          ticks: { color: colorTema("--chart-eje", "#6d7a72"), font: { size: 11 }, callback: (v) => formatEUR(v).replace(",00", "") },
        },
        y: { grid: { display: false }, ticks: { color: colorTema("--chart-leyenda", "#9fada4"), font: { size: 12 } } },
      },
    },
  });
}

// Una transferencia entre cuentas propias no es gasto ni ingreso: es mover
// dinero de sitio. Pero si la cuenta de destino no es de las tuyas (un
// Bizum a otra persona), ese dinero SE VA de verdad — y al revés, el que
// llega desde una cuenta que no es tuya, entra de verdad. El calendario
// las cuenta así. Cuando todas las cuentas son tuyas, nada cambia.
export function sentidoDeTransferencia(m, idsVisibles) {
  if (m.tipo !== "Transferencia" || !m.cuenta_destino_id) return null;
  const origenMio = idsVisibles.has(m.cuenta_id);
  const destinoMio = idsVisibles.has(m.cuenta_destino_id);
  if (origenMio && !destinoMio) return "Gasto";
  if (!origenMio && destinoMio) return "Ingreso";
  return null;
}

function renderCalendario(movimientosMes, categorias, cuentas) {
  const el = document.getElementById("calendar-grid");
  const year = mesActual.getFullYear();
  const month = mesActual.getMonth();
  const primerDia = new Date(year, month, 1);
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const offset = (primerDia.getDay() + 6) % 7; // lunes = 0 ... domingo = 6
  const hoy = new Date();
  const idsVisibles = new Set(cuentas.map((c) => c.id));

  const porDia = new Map();
  movimientosMes.forEach((m) => {
    let tipo = m.tipo;
    if (m.tipo === "Transferencia") {
      tipo = sentidoDeTransferencia(m, idsVisibles);
      if (!tipo) return;
    }
    const d = fromTimestamp(m.fecha);
    if (!d) return;
    const key = d.getDate();
    if (!porDia.has(key)) porDia.set(key, { gasto: 0, ingreso: 0 });
    const acc = porDia.get(key);
    if (tipo === "Gasto") acc.gasto += Number(m.importe ?? 0);
    else if (tipo === "Ingreso") acc.ingreso += Number(m.importe ?? 0);
  });

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(`<div class="cal-cell cal-cell--vacia"></div>`);
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const totales = porDia.get(dia);
    const esHoy = hoy.getFullYear() === year && hoy.getMonth() === month && hoy.getDate() === dia;
    // Un solo número por día: el balance (ingresos − gastos). Con 100 de
    // ingreso y 10 de gasto, el día dice +90 — el desglose completo está
    // al tocar el día.
    const neto = (totales?.ingreso ?? 0) - (totales?.gasto ?? 0);
    celdas.push(`
      <button type="button" class="cal-cell ${esHoy ? "cal-cell--hoy" : ""}" data-dia="${dia}">
        <span class="cal-cell__num">${dia}</span>
        ${totales ? `<span class="${neto >= 0 ? "cal-cell__ingreso" : "cal-cell__gasto"}">${neto >= 0 ? "+" : "−"}${formatEUR(Math.abs(neto))}</span>` : ""}
      </button>`);
  }

  el.innerHTML = `
    <div class="cal-weekdays">
      <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
    </div>
    <div class="cal-days">${celdas.join("")}</div>`;

  el.querySelectorAll("[data-dia]").forEach((btn) =>
    btn.addEventListener("click", () => openDiaDetalle(new Date(year, month, Number(btn.dataset.dia)), currentState))
  );
}

// Día que se está viendo en el modal de detalle, o null si está cerrado.
// renderMovimientos lo consulta para repintar el modal cuando cambian los
// datos mientras sigue abierto.
let diaAbierto = null;

function openDiaDetalle(fecha, state) {
  diaAbierto = fecha;
  const { movimientos, categorias, cuentas } = state;
  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c.nombre]));

  const delDia = movimientos
    .filter((m) => {
      const d = fromTimestamp(m.fecha);
      return d && mismoDia(d, fecha);
    })
    .sort((a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0));

  // Cada movimiento del día cae en su grupo: gastos, ingresos, o los que
  // solo mueven dinero entre cuentas propias. Los Bizum hacia fuera / desde
  // fuera cuentan como gasto/ingreso, igual que en la celda del calendario.
  const grupoDe = (m) => {
    if (m.tipo === "Gasto") return "gastos";
    if (m.tipo === "Ingreso") return "ingresos";
    const sentido = sentidoDeTransferencia(m, new Set(cuentaMap.keys()));
    return sentido === "Gasto" ? "gastos" : sentido === "Ingreso" ? "ingresos" : "neutros";
  };

  const filaDe = (m) => {
    const esTransferencia = m.tipo === "Transferencia";
    let titulo, sub, amountClass, amountSign, iconHTML;
    if (esTransferencia) {
      iconHTML = icon("movimientos", { size: 16 });
      titulo = `${nombreDeCuenta(cuentaMap, m.cuenta_id)} → ${destinoTransferencia(m, cuentaMap)}`;
      sub = "Transferencia" + (m.nota ? " · " + m.nota : "");
      const sentido = sentidoDeTransferencia(m, new Set(cuentaMap.keys()));
      amountClass = sentido === "Gasto" ? "mini-row__amount--neg" : sentido === "Ingreso" ? "mini-row__amount--pos" : "";
      amountSign = sentido === "Gasto" ? "− " : sentido === "Ingreso" ? "+ " : "";
    } else {
      const cat = catMap.get(m.categoria_id);
      iconHTML = entityIcon(cat, iconForCategoriaTipo(cat?.tipo), { size: 16 });
      titulo = m.subcategoria || cat?.nombre || "Movimiento";
      const periodo = textoPeriodo(m);
      sub = `${cat?.nombre || "—"} · ${nombreDeCuenta(cuentaMap, m.cuenta_id)}${periodo ? " · " + periodo : ""}${m.nota ? " · " + m.nota : ""}`;
      amountClass = m.tipo === "Ingreso" ? "mini-row__amount--pos" : "mini-row__amount--neg";
      amountSign = m.tipo === "Ingreso" ? "+ " : "− ";
    }
    return wrapSwipe(
      `
        <div class="mini-row">
          <div class="mini-row__body" style="flex:1; min-width:0;">
            <span class="mini-row__icon">${iconHTML}</span>
            <span class="mini-row__main">
              <span class="mini-row__title"><strong>${esc(titulo)}</strong></span>
              <span class="mini-row__sub">${sub}</span>
            </span>
          </div>
          <span class="mini-row__amount ${amountClass}">${amountSign}${formatEUR(Math.abs(Number(m.importe)))}</span>
          <button type="button" class="row-edit-btn" data-edit="${m.id}" title="Editar">${icon("edit", { size: 15 })}</button>
        </div>`,
      m.id
    );
  };

  // El resumen del día: los gastos con su total, los ingresos con el suyo,
  // los movimientos entre cuentas aparte, y el balance al final.
  const gastos = delDia.filter((m) => grupoDe(m) === "gastos");
  const ingresos = delDia.filter((m) => grupoDe(m) === "ingresos");
  const neutros = delDia.filter((m) => grupoDe(m) === "neutros");
  const totalGastos = gastos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0);
  const totalIngresos = ingresos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0);
  const neto = totalIngresos - totalGastos;

  const filas = [
    gastos.length
      ? `<p class="dia-seccion">Gastos</p>${gastos.map(filaDe).join("")}
         <p class="dia-total"><span>Total de gastos</span><span class="mini-row__amount--neg">− ${formatEUR(totalGastos)}</span></p>`
      : "",
    ingresos.length
      ? `<p class="dia-seccion">Ingresos</p>${ingresos.map(filaDe).join("")}
         <p class="dia-total"><span>Total de ingresos</span><span class="mini-row__amount--pos">+ ${formatEUR(totalIngresos)}</span></p>`
      : "",
    neutros.length ? `<p class="dia-seccion">Entre cuentas</p>${neutros.map(filaDe).join("")}` : "",
    gastos.length && ingresos.length
      ? `<p class="dia-total dia-total--balance"><span>Balance del día</span><span class="${neto >= 0 ? "mini-row__amount--pos" : "mini-row__amount--neg"}">${neto >= 0 ? "+" : "−"} ${formatEUR(Math.abs(neto))}</span></p>`
      : "",
  ].join("");

  openModal(
    `
    <h2 class="modal__title">${formatFecha(fecha)}</h2>
    ${delDia.length === 0 ? `<p class="empty-state">Sin movimientos este día.</p>` : `<div class="mini-list">${filas}</div>`}
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="btn-cerrar-dia">Cerrar</button>
      <button type="button" class="btn btn--primary" id="btn-add-dia">+ Añadir</button>
    </div>
  `,
    {
      wide: true,
      onClose: () => {
        diaAbierto = null;
      },
      onMount: (root) => {
        root.querySelector("#btn-cerrar-dia").addEventListener("click", closeModal);
        // Al abrir el formulario encima, este modal deja de estar en
        // pantalla: si no se soltara `diaAbierto`, la siguiente
        // actualización de datos lo repintaría por encima del formulario
        // que el usuario está rellenando.
        root.querySelector("#btn-add-dia").addEventListener("click", () => {
          diaAbierto = null;
          openForm(null, state, fecha);
        });
        root.querySelectorAll("[data-edit]").forEach((btn) =>
          btn.addEventListener("click", () => {
            diaAbierto = null;
            openForm(movimientos.find((m) => m.id === btn.dataset.edit), state);
          })
        );
        const lista = root.querySelector(".mini-list");
        if (lista) {
          attachSwipe(lista, (id) => deleteMovimiento(id), {
            confirmar: "¿Eliminar este movimiento?",
          });
        }
      },
    }
  );
}

function openForm(movimiento, state, fechaPrefill) {
  const isEdit = Boolean(movimiento);
  // fechaISO y no toISOString: las dos fechas de aquí son LOCALES —la del
  // movimiento ya viene normalizada a mediodía, y la del calendario es la
  // medianoche local del día que se pulsó—, y pasarlas por UTC restaba un
  // día en España. Pulsabas el 15 y el formulario ponía el 14.
  const fechaValue = movimiento
    ? fechaISO(fromTimestamp(movimiento.fecha))
    : fechaPrefill
    ? fechaISO(fechaPrefill)
    : todayISO();
  // El dinero que sale al dar un préstamo se guarda como transferencia SIN
  // cuenta de destino (se lo lleva la persona, no va a otra cuenta propia).
  // Al editarlo desde aquí no se le puede exigir una cuenta de destino ni
  // borrarle el "Préstamo a X": eso haría aparecer ese dinero entrando en
  // otra cuenta suya y le cuadraría mal el saldo.
  const esPrestamoDado = Boolean(
    movimiento?.tipo === "Transferencia" && !movimiento.cuenta_destino_id && movimiento.subcategoria
  );

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
        <input type="text" name="subcategoria" value="${esc(movimiento?.subcategoria ?? "")}" placeholder="Five Guys, Zara…" />
      </label>
      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="nota" value="${esc(movimiento?.nota ?? "")}" placeholder="Mercadona, Glovo, nómina…" />
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
          const pideDestino = esTransferencia && !esPrestamoDado;
          campoCategoria.classList.toggle("is-hidden", esTransferencia);
          campoCuentaDestino.classList.toggle("is-hidden", !pideDestino);
          campoSubcategoria.classList.toggle("is-hidden", esTransferencia && !esPrestamoDado);
          etiquetaCuenta.textContent = esTransferencia ? "Cuenta origen" : "Cuenta";
          root.querySelector("[name=categoria_id]").required = !esTransferencia;
          root.querySelector("[name=cuenta_destino_id]").required = pideDestino;
        }
        tipoSelect.addEventListener("change", toggleCampos);
        toggleCampos();

        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-movimiento").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const esTransferencia = f.tipo.value === "Transferencia";
          const guardaDestino = esTransferencia && !esPrestamoDado;
          const data = {
            tipo: f.tipo.value,
            importe: Number(f.importe.value),
            categoria_id: esTransferencia ? null : f.categoria_id.value,
            cuenta_id: f.cuenta_id.value,
            cuenta_destino_id: guardaDestino ? f.cuenta_destino_id.value : null,
            fecha: toTimestamp(f.fecha.value),
            subcategoria: guardaDestino ? "" : f.subcategoria.value.trim(),
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
