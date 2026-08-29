import {
  movimientosEnRango,
  totalPorTipo,
  desglosePorCategoria,
  desglosePorSubcategoria,
  formatEUR,
  formatFecha,
  fromTimestamp,
} from "../db.js?v=82";
import { countUpTo, iniciarPaseDeRender } from "../animations.js?v=82";
import { icon, entityIcon, iconForCuentaTipo, iconForSuscripcion } from "../icons.js?v=82";
import { openModal, closeModal } from "../modal.js?v=82";
import { colorTema, paletaTema, conAlfa } from "../tema.js?v=82";

// Colores de respaldo (tema Original). Los de verdad los pone el tema
// activo — ver js/tema.js.
const GASTO_COLORS_BASE = ["#b06a63", "#c48b83", "#9c6a63", "#8a5850", "#a37c74", "#7d5a53"];
const INGRESO_COLORS_BASE = ["#7a9b81", "#a8c3a0", "#8a9b6e", "#5f7a63", "#6b8778", "#9cae8f"];
const GASTO_COLORS = () => paletaTema("--paleta-gastos", GASTO_COLORS_BASE);
const INGRESO_COLORS = () => paletaTema("--paleta-ingresos", INGRESO_COLORS_BASE);

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

  document.getElementById("gf-mes-prev")?.addEventListener("click", () => {
    mesGastosFijos = new Date(mesGastosFijos.getFullYear(), mesGastosFijos.getMonth() - 1, 1);
    if (currentState) renderGastosFijosPorCuenta(currentState);
  });
  document.getElementById("gf-mes-next")?.addEventListener("click", () => {
    mesGastosFijos = new Date(mesGastosFijos.getFullYear(), mesGastosFijos.getMonth() + 1, 1);
    if (currentState) renderGastosFijosPorCuenta(currentState);
  });
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

  renderGastosFijosPorCuenta(state);
  renderDonut("chart-gastos-cat", desglosePorCategoria(filtrados, categorias, "Gasto"), GASTO_COLORS);
  renderDonut("chart-ingresos-cat", desglosePorCategoria(filtrados, categorias, "Ingreso"), INGRESO_COLORS);
  renderListaSubcategorias(filtrados);
}

// ---------------- Gastos fijos por cuenta (mes a mes) ----------------
// Este bloque es una réplica visual del apartado "Gastos fijos": para cada
// gasto fijo activo se toma lo que realmente se cobró ese mes si ya está
// marcado como pagado y, si no, su precio habitual. Con esa única regla
// salen los tres casos sin lógica aparte:
//   · meses pasados y el mes actual → el coste del mes (lo pagado + lo que
//     todavía queda pendiente)
//   · meses futuros → la estimación, porque ahí nadie ha pagado nada aún y
//     todo cae en el precio configurado
// Por eso la estimación se ajusta editando el gasto fijo en su apartado
// (su precio y su cuenta), no desde aquí: esa es la única fuente de verdad.
let mesGastosFijos = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function pagosDeSuscripcionEnMes(movimientos, suscripcionId, mes) {
  return movimientos.filter((m) => {
    if (m.suscripcion_id !== suscripcionId) return false;
    const d = fromTimestamp(m.fecha);
    return d && d.getFullYear() === mes.getFullYear() && d.getMonth() === mes.getMonth();
  });
}

function importeDelMes(s, movimientos, mes) {
  const pagos = pagosDeSuscripcionEnMes(movimientos, s.id, mes);
  return pagos.length > 0
    ? pagos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0)
    : Number(s.precio ?? 0);
}

function renderGastosFijosPorCuenta(state) {
  const { suscripciones, cuentas, movimientos } = state;
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));

  // Solo cuentas que de verdad tienen algún gasto fijo ese mes: si una
  // cuenta no carga nada, no pinta nada en el gráfico.
  const totales = new Map();
  suscripciones
    .filter((s) => s.activa !== false)
    .forEach((s) => {
      const importe = importeDelMes(s, movimientos, mesGastosFijos);
      if (importe > 0) totales.set(s.cuenta_id, (totales.get(s.cuenta_id) || 0) + importe);
    });

  document.getElementById("gf-mes-label").textContent = etiquetaMes();

  const entradas = [...totales.entries()].sort((a, b) => b[1] - a[1]);
  renderChartGastosFijosCuenta(
    entradas.map(([id]) => cuentaMap.get(id)?.nombre ?? "Sin cuenta"),
    entradas.map(([, total]) => total),
    esMesFuturo()
  );
  renderTotalesPorCuenta(entradas, cuentaMap);
}

function etiquetaMes() {
  const label = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(mesGastosFijos);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function esMesFuturo() {
  const hoy = new Date();
  return mesGastosFijos > new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

function renderChartGastosFijosCuenta(labels, valores, esFuturo) {
  const canvas = document.getElementById("chart-gastos-fijos-cuenta");
  if (!canvas || typeof Chart === "undefined") return;

  if (charts.gastosFijosCuenta) charts.gastosFijosCuenta.destroy();

  if (labels.length === 0) {
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Barras, no líneas: cada cuenta es una categoría independiente, no un
  // punto de una serie temporal — unirlas con una línea daba a entender una
  // progresión de Imagin a Efectivo que no significa nada.
  charts.gastosFijosCuenta = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: esFuturo ? "Estimado" : "Gastos fijos",
          data: valores,
          backgroundColor: conAlfa(colorTema(esFuturo ? "--warning" : "--accent"), esFuturo ? 0.5 : 0.6),
          borderColor: colorTema(esFuturo ? "--warning" : "--accent"),
          borderWidth: 1.5,
          borderRadius: 6,
          maxBarThickness: 72,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => formatEUR(ctx.parsed.y) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: colorTema("--chart-eje", "#6d7a72"), font: { size: 11 } } },
        y: {
          beginAtZero: true,
          grid: { color: colorTema("--chart-rejilla", "rgba(233,238,234,0.06)") },
          ticks: { color: colorTema("--chart-eje", "#6d7a72"), font: { size: 11 }, callback: (v) => formatEUR(v).replace(",00", "") },
        },
      },
    },
  });
}

// Debajo del gráfico, lo mismo en texto: cada cuenta con su total del mes
// (de mayor a menor) y la suma de todas al final.
function renderTotalesPorCuenta(entradas, cuentaMap) {
  const el = document.getElementById("gf-totales-cuenta");
  if (!el) return;

  if (entradas.length === 0) {
    el.innerHTML = `<p class="empty-state">Ninguna cuenta tiene gastos fijos este mes.</p>`;
    return;
  }

  const total = entradas.reduce((acc, [, valor]) => acc + valor, 0);

  el.innerHTML =
    entradas
      .map(([cuentaId, valor]) => {
        const cuenta = cuentaMap.get(cuentaId);
        return `
        <button type="button" class="mini-row" data-gf-cuenta="${cuentaId}">
          <div class="mini-row__body">
            <span class="mini-row__icon">${cuenta ? entityIcon(cuenta, iconForCuentaTipo(cuenta.tipo)) : icon("otra")}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${cuenta?.nombre ?? "Sin cuenta asignada"}</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(valor)}</span>
        </button>`;
      })
      .join("") +
    `<div class="mini-row" style="border-top: 1px solid var(--border-strong); margin-top: 6px; padding-top: 12px;">
      <div class="mini-row__main"><span class="mini-row__title">Total</span></div>
      <span class="mini-row__amount">${formatEUR(total)}</span>
    </div>`;

  el.querySelectorAll("[data-gf-cuenta]").forEach((btn) =>
    btn.addEventListener("click", () => openDesgloseCuenta(btn.dataset.gfCuenta))
  );
}

// Al tocar una cuenta: qué gastos fijos concretos componen ese total, con el
// estado de cada uno en ese mes.
function openDesgloseCuenta(cuentaId) {
  if (!currentState) return;
  const { suscripciones, cuentas, movimientos } = currentState;
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const esFuturo = esMesFuturo();

  const filas = suscripciones
    .filter((s) => s.activa !== false && s.cuenta_id === cuentaId)
    .map((s) => {
      const pagos = pagosDeSuscripcionEnMes(movimientos, s.id, mesGastosFijos);
      const pagado = pagos.length > 0;
      return {
        nombre: s.nombre,
        pagado,
        importe: pagado
          ? pagos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0)
          : Number(s.precio ?? 0),
      };
    })
    .filter((f) => f.importe > 0)
    .sort((a, b) => b.importe - a.importe);

  const total = filas.reduce((acc, f) => acc + f.importe, 0);

  openModal(
    `
    <h2 class="modal__title">${cuenta?.nombre ?? "Sin cuenta"} · ${etiquetaMes()}</h2>
    <div class="mini-list">
      ${filas
        .map(
          (f) => `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="mini-row__icon">${icon(iconForSuscripcion(f.nombre))}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${f.nombre}</span>
              <span class="mini-row__sub">${esFuturo ? "Estimado" : f.pagado ? "Pagado" : "Pendiente"}</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(f.importe)}</span>
        </div>`
        )
        .join("")}
      <div class="mini-row" style="border-top: 1px solid var(--border-strong); margin-top: 6px; padding-top: 12px;">
        <div class="mini-row__main"><span class="mini-row__title">Total</span></div>
        <span class="mini-row__amount">${formatEUR(total)}</span>
      </div>
    </div>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="btn-cerrar-desglose">Cerrar</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cerrar-desglose").addEventListener("click", closeModal);
      },
    }
  );
}

// paleta: función que devuelve la lista de colores del tema activo. Se
// pasa como función y no como lista ya hecha porque los colores cambian
// al cambiar de tema, y este render se vuelve a llamar entonces.
function renderDonut(canvasId, datos, paleta) {
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
          backgroundColor: (() => {
            const colores = paleta();
            return datos.map((_, i) => colores[i % colores.length]);
          })(),
          borderColor: colorTema("--chart-borde", "#131a16"),
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
          labels: { color: colorTema("--chart-leyenda", "#9fada4"), boxWidth: 8, padding: 8, font: { family: "Inter", size: 10.5 } },
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
