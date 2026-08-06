import {
  movimientosEnRango,
  totalPorTipo,
  desglosePorCategoria,
  desglosePorSubcategoria,
  evolucionMensual,
  updateSuscripcion,
  formatEUR,
  formatFecha,
  fromTimestamp,
} from "../db.js?v=33";
import { countUpTo, iniciarPaseDeRender } from "../animations.js?v=33";

const GASTO_COLORS = ["#b06a63", "#c48b83", "#9c6a63", "#8a5850", "#a37c74", "#7d5a53"];
const INGRESO_COLORS = ["#7a9b81", "#a8c3a0", "#8a9b6e", "#5f7a63", "#6b8778", "#9cae8f"];

let rango = "mes";
let filtroTexto = "";
let currentState = null;
const charts = {};

export function mountGraficos() {
  document.querySelectorAll("#graficos-rango .segmented__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("is-active")) return;
      rango = btn.dataset.rango;
      document.querySelectorAll("#graficos-rango .segmented__btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      if (currentState) renderGraficos(currentState);
    });
  });

  document.getElementById("filtro-subcategoria")?.addEventListener("input", (e) => {
    filtroTexto = e.target.value;
    if (currentState) renderListaSubcategorias(movimientosEnRango(currentState.movimientos, rango));
  });

  document.getElementById("btn-guardar-estimacion")?.addEventListener("click", guardarEstimaciones);
}

export function renderGraficos(state) {
  currentState = state;
  // Igual que el Dashboard: marca si este pase llega pegado al anterior
  // (ráfaga de Firestore) antes de tocar los contadores de arriba.
  iniciarPaseDeRender();
  const { movimientos, categorias } = state;
  const filtrados = movimientosEnRango(movimientos, rango);

  const ingresos = totalPorTipo(filtrados, "Ingreso");
  const gastos = totalPorTipo(filtrados, "Gasto");
  countUpTo(document.getElementById("kpi-ingresos"), ingresos, formatEUR);
  countUpTo(document.getElementById("kpi-gastos"), gastos, formatEUR);

  renderEvolucion(movimientos);
  renderGastosFijosPorCuenta(state);
  renderDonut("chart-gastos-cat", desglosePorCategoria(filtrados, categorias, "Gasto"), GASTO_COLORS);
  renderDonut("chart-ingresos-cat", desglosePorCategoria(filtrados, categorias, "Ingreso"), INGRESO_COLORS);
  renderListaSubcategorias(filtrados);
}

// Gastos fijos que ya se cobraron este mes (calendario real, no el mes que
// se esté viendo en otra vista), agrupados por cuenta — y la estimación de
// lo que tocará el mes que viene, asumiendo por defecto que un gasto fijo
// cobra lo mismo (solo cambia si se le guarda una estimación distinta a
// mano, ver guardarEstimaciones()).
function pagosDelMesReal(movimientos, suscripcionId) {
  const hoy = new Date();
  return movimientos.filter((m) => {
    if (m.suscripcion_id !== suscripcionId) return false;
    const d = fromTimestamp(m.fecha);
    return d && d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
  });
}

function importeEsteMes(s, movimientos) {
  const pagos = pagosDelMesReal(movimientos, s.id);
  return pagos.length > 0 ? pagos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0) : Number(s.precio ?? 0);
}

function importeEstimado(s) {
  return Number(s.estimado_proximo_mes ?? s.precio ?? 0);
}

function renderGastosFijosPorCuenta(state) {
  const { suscripciones, cuentas, movimientos } = state;
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));
  const activas = suscripciones.filter((s) => s.activa !== false);

  const esteMesPorCuenta = new Map();
  const estimadoPorCuenta = new Map();
  activas.forEach((s) => {
    esteMesPorCuenta.set(s.cuenta_id, (esteMesPorCuenta.get(s.cuenta_id) || 0) + importeEsteMes(s, movimientos));
    estimadoPorCuenta.set(s.cuenta_id, (estimadoPorCuenta.get(s.cuenta_id) || 0) + importeEstimado(s));
  });

  const cuentaIds = [...new Set([...esteMesPorCuenta.keys(), ...estimadoPorCuenta.keys()])].sort(
    (a, b) => (esteMesPorCuenta.get(b) || 0) - (esteMesPorCuenta.get(a) || 0)
  );

  renderChartGastosFijosCuenta(
    cuentaIds.map((id) => cuentaMap.get(id)?.nombre ?? "Sin cuenta"),
    cuentaIds.map((id) => esteMesPorCuenta.get(id) || 0),
    cuentaIds.map((id) => estimadoPorCuenta.get(id) || 0)
  );

  renderListaEstimacion(activas, cuentaMap, movimientos);
}

function renderChartGastosFijosCuenta(labels, esteMes, estimado) {
  const canvas = document.getElementById("chart-gastos-fijos-cuenta");
  if (!canvas || typeof Chart === "undefined") return;

  if (charts.gastosFijosCuenta) charts.gastosFijosCuenta.destroy();

  if (labels.length === 0) {
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  charts.gastosFijosCuenta = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Este mes",
          data: esteMes,
          borderColor: "#7a9b81",
          backgroundColor: "rgba(122,155,129,0.15)",
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#7a9b81",
          borderWidth: 2,
        },
        {
          label: "Próximo mes (estimado)",
          data: estimado,
          borderColor: "#b6975f",
          backgroundColor: "rgba(182,151,95,0.12)",
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#b6975f",
          borderDash: [6, 4],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { color: "#9fada4", boxWidth: 8, font: { family: "Inter", size: 11 } },
        },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatEUR(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#6d7a72", font: { size: 11 } } },
        y: {
          grid: { color: "rgba(233,238,234,0.06)" },
          ticks: { color: "#6d7a72", font: { size: 11 }, callback: (v) => formatEUR(v).replace(",00", "") },
        },
      },
    },
  });
}

function renderListaEstimacion(activas, cuentaMap, movimientos) {
  const el = document.getElementById("gastos-fijos-estimacion-lista");
  if (!el) return;

  if (activas.length === 0) {
    el.innerHTML = `<p class="empty-state">No hay gastos fijos activos.</p>`;
    return;
  }

  el.innerHTML = activas
    .map((s) => {
      const cuenta = cuentaMap.get(s.cuenta_id);
      const esteMes = importeEsteMes(s, movimientos);
      return `
        <div class="mini-row" data-estimacion-row="${s.id}">
          <div class="mini-row__main">
            <span class="mini-row__title">${s.nombre}</span>
            <span class="mini-row__sub">${cuenta?.nombre ?? "Sin cuenta"} · este mes ${formatEUR(esteMes)}</span>
          </div>
          <input
            type="number"
            step="0.01"
            class="estimacion-input"
            data-estimacion-input="${s.id}"
            value="${s.estimado_proximo_mes ?? ""}"
            placeholder="${formatEUR(s.precio ?? 0)} (igual)"
          />
        </div>`;
    })
    .join("");
}

async function guardarEstimaciones() {
  const btn = document.getElementById("btn-guardar-estimacion");
  const msg = document.getElementById("gastos-fijos-estimacion-msg");
  if (!currentState) return;
  btn.disabled = true;
  msg.textContent = "";
  try {
    const inputs = document.querySelectorAll("[data-estimacion-input]");
    for (const input of inputs) {
      const s = currentState.suscripciones.find((x) => x.id === input.dataset.estimacionInput);
      if (!s) continue;
      const nuevo = input.value === "" ? null : Number(input.value);
      const actual = s.estimado_proximo_mes ?? null;
      if (nuevo !== actual) {
        await updateSuscripcion(s.id, { estimado_proximo_mes: nuevo });
      }
    }
    msg.style.color = "var(--success)";
    msg.textContent = "Estimaciones guardadas.";
  } catch (err) {
    console.error("Error al guardar estimaciones:", err);
    msg.style.color = "var(--danger)";
    msg.textContent = "No se pudo guardar. Inténtalo de nuevo.";
  } finally {
    btn.disabled = false;
  }
}

function renderEvolucion(movimientos) {
  const canvas = document.getElementById("chart-evolucion");
  if (!canvas || typeof Chart === "undefined") return;

  const buckets = evolucionMensual(movimientos, 12);

  if (charts.evolucion) charts.evolucion.destroy();

  charts.evolucion = new Chart(canvas, {
    type: "line",
    data: {
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: "Ingresos",
          data: buckets.map((b) => b.ingresos),
          borderColor: "#7a9b81",
          backgroundColor: "rgba(122,155,129,0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: "Gastos",
          data: buckets.map((b) => b.gastos),
          borderColor: "#b06a63",
          backgroundColor: "rgba(176,106,99,0.1)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { color: "#9fada4", boxWidth: 8, font: { family: "Inter", size: 11 } },
        },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatEUR(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#6d7a72", font: { size: 11 } } },
        y: {
          grid: { color: "rgba(233,238,234,0.06)" },
          ticks: { color: "#6d7a72", font: { size: 11 }, callback: (v) => formatEUR(v).replace(",00", "") },
        },
      },
    },
  });
}

function renderDonut(canvasId, datos, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  if (charts[canvasId]) charts[canvasId].destroy();

  if (datos.length === 0) {
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  charts[canvasId] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: datos.map((d) => d.categoria.nombre),
      datasets: [
        {
          data: datos.map((d) => d.total),
          backgroundColor: datos.map((_, i) => colors[i % colors.length]),
          borderColor: "#131a16",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#9fada4", boxWidth: 8, padding: 8, font: { family: "Inter", size: 10.5 } },
        },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.label}: ${formatEUR(ctx.parsed)}` },
        },
      },
    },
  });
}

function renderListaSubcategorias(movimientos) {
  const el = document.getElementById("lista-subcategorias");

  // Sin búsqueda: el resumen habitual, un total por sitio. Buscando algo
  // (p. ej. "Five Guys"), en cambio, se listan todos los gastos que
  // coinciden uno a uno (con su fecha) y se suman al final — así se ve
  // el detalle, no solo el número agregado.
  if (filtroTexto.trim()) {
    const texto = filtroTexto.trim().toLowerCase();
    const coincidencias = movimientos
      .filter((m) => m.tipo === "Gasto" && m.subcategoria && m.subcategoria.toLowerCase().includes(texto))
      .sort((a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0));

    if (coincidencias.length === 0) {
      el.innerHTML = `<p class="empty-state">Sin resultados.</p>`;
      return;
    }

    const total = coincidencias.reduce((acc, m) => acc + Number(m.importe ?? 0), 0);
    el.innerHTML =
      coincidencias
        .map(
          (m) => `
        <div class="mini-row">
          <div class="mini-row__main">
            <span class="mini-row__title">${m.subcategoria}</span>
            <span class="mini-row__sub">${formatFecha(fromTimestamp(m.fecha))}</span>
          </div>
          <span class="mini-row__amount">${formatEUR(Number(m.importe))}</span>
        </div>`
        )
        .join("") +
      `<div class="mini-row" style="border-top: 1px solid var(--border-strong); margin-top: 6px; padding-top: 12px;">
        <div class="mini-row__main"><span class="mini-row__title">Total (${coincidencias.length})</span></div>
        <span class="mini-row__amount">${formatEUR(total)}</span>
      </div>`;
    return;
  }

  const datos = desglosePorSubcategoria(movimientos, "Gasto", "");

  if (datos.length === 0) {
    el.innerHTML = `<p class="empty-state">Añade una subcategoría a tus gastos para verlos aquí.</p>`;
    return;
  }

  el.innerHTML = datos
    .map(
      ({ subcategoria, total }) => `
        <div class="mini-row">
          <div class="mini-row__main"><span class="mini-row__title">${subcategoria}</span></div>
          <span class="mini-row__amount">${formatEUR(total)}</span>
        </div>`
    )
    .join("");
}
