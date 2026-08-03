import {
  movimientosEnRango,
  totalPorTipo,
  desglosePorCategoria,
  desglosePorSubcategoria,
  interesGeneradoPorPrestamo,
  evolucionMensual,
  formatEUR,
  formatFecha,
  fromTimestamp,
} from "../db.js?v=9";
import { countUpTo } from "../animations.js?v=9";
import { initials, avatarColor } from "../icons.js?v=9";

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
}

export function renderGraficos(state) {
  currentState = state;
  const { movimientos, categorias, prestamos, pagosPrestamos } = state;
  const filtrados = movimientosEnRango(movimientos, rango);

  const ingresos = totalPorTipo(filtrados, "Ingreso");
  const gastos = totalPorTipo(filtrados, "Gasto");
  countUpTo(document.getElementById("kpi-ingresos"), ingresos, formatEUR);
  countUpTo(document.getElementById("kpi-gastos"), gastos, formatEUR);

  const datosIntereses = interesGeneradoPorPrestamo(prestamos, pagosPrestamos);
  const totalIntereses = datosIntereses.reduce((acc, x) => acc + x.interes, 0);
  countUpTo(document.getElementById("kpi-intereses"), totalIntereses, formatEUR);

  renderEvolucion(movimientos);
  renderDonut("chart-gastos-cat", desglosePorCategoria(filtrados, categorias, "Gasto"), GASTO_COLORS);
  renderDonut("chart-ingresos-cat", desglosePorCategoria(filtrados, categorias, "Ingreso"), INGRESO_COLORS);
  renderListaSubcategorias(filtrados);
  renderListaPrestamos(datosIntereses, totalIntereses);
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

function renderListaPrestamos(datos, total) {
  const el = document.getElementById("lista-prestamos-interes");

  if (datos.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no hay intereses cobrados.</p>`;
    return;
  }

  el.innerHTML =
    datos
      .map(
        ({ prestamo, interes }) => `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="avatar" style="background:${avatarColor(prestamo.persona)}">${initials(prestamo.persona)}</span>
            <div class="mini-row__main"><span class="mini-row__title">${prestamo.persona}</span></div>
          </div>
          <span class="mini-row__amount mini-row__amount--pos">${formatEUR(interes)}</span>
        </div>`
      )
      .join("") +
    `<div class="mini-row" style="border-top: 1px solid var(--border-strong); margin-top: 6px; padding-top: 12px;">
        <div class="mini-row__main"><span class="mini-row__title">Total</span></div>
        <span class="mini-row__amount mini-row__amount--pos">${formatEUR(total)}</span>
      </div>`;
}
