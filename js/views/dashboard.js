import {
  calcularSaldoCuenta,
  calcularSaldoTotal,
  gastosPorCategoriaDelMes,
  gastosPorSubcategoriaDelMes,
  formatEUR,
  formatFecha,
  fromTimestamp,
  destinoTransferencia,
  esPlanDePagos,
  restantePlanDePagos,
  nombreDeCuenta,
} from "../db.js?v=67";
import { initDashboardAnimations, iniciarPaseDeRender, countUpTo, animateProgressBars, estaAsentando } from "../animations.js?v=67";
import { seedInitialData } from "../seed.js?v=67";
import { icon, entityIcon, iconForCategoriaTipo, iconForCuentaTipo, iconForSuscripcion, initials, avatarColor } from "../icons.js?v=67";
import { openHistorial } from "./cuentas.js?v=67";
import { colorTema, paletaTema } from "../tema.js?v=67";

let chartInstance = null;

export function mountDashboard() {
  const btn = document.getElementById("btn-seed");
  btn?.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Importando…";
    try {
      await seedInitialData();
    } catch (err) {
      btn.textContent = "Error al importar, inténtalo de nuevo";
      btn.disabled = false;
    }
  });

}

// Los colores salen del tema activo (js/tema.js), no de una lista fija:
// así el donut cambia junto con el resto de la app.
const CATEGORY_COLORS_BASE = ["#7a9b81", "#a8c3a0", "#8a9b6e", "#5f7a63", "#b6975f", "#7d8f8a", "#9c8a6f", "#6b8778"];
const categoryColors = () => paletaTema("--paleta-categorias", CATEGORY_COLORS_BASE);

export function renderDashboard(state) {
  const loadingEl = document.getElementById("dashboard-loading");
  const contentEl = document.getElementById("dashboard-content");

  if (!state.ready) {
    loadingEl?.classList.remove("is-hidden");
    contentEl?.classList.add("is-hidden");
    return;
  }
  loadingEl?.classList.add("is-hidden");
  contentEl?.classList.remove("is-hidden");

  // Marca si este renderizado llega pegado al anterior (ráfaga de
  // Firestore por una modificación, o varias colecciones asentándose) antes
  // de tocar ningún número o gráfico — countUpTo/renderChart, más abajo,
  // consultan ese resultado para decidir si animan o aplican al instante.
  iniciarPaseDeRender();

  const { cuentas, categorias, movimientos, suscripciones, prestamos, pagosPrestamos } = state;

  const seedBanner = document.getElementById("seed-banner");
  if (seedBanner) seedBanner.classList.toggle("is-hidden", !(state.ready && cuentas.length === 0));

  document.getElementById("hero-fecha").textContent = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  countUpTo(document.getElementById("saldo-total"), calcularSaldoTotal(cuentas, movimientos), formatEUR);

  renderChart(movimientos, categorias);
  renderLimites(movimientos, categorias);
  renderTopLugares(movimientos);
  renderRecientes(movimientos, categorias, cuentas);
  renderPrestamos(prestamos, pagosPrestamos);
  renderSuscripciones(suscripciones, cuentas);
  renderCuentasResumen(state);

  initDashboardAnimations();
}

function renderChart(movimientos, categorias) {
  const canvas = document.getElementById("chart-categorias");
  if (!canvas || typeof Chart === "undefined") return;

  const datos = gastosPorCategoriaDelMes(movimientos, categorias).filter((d) => d.total > 0);

  if (datos.length === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const labels = datos.map((d) => d.categoria.nombre);
  const values = datos.map((d) => d.total);
  const paleta = categoryColors();
  const colors = datos.map((_, i) => paleta[i % paleta.length]);

  // El Dashboard se vuelve a renderizar con cada actualización de Firestore
  // (no solo al entrar en la vista) — destruir y recrear el gráfico cada vez
  // hacía que se viera "parpadear"/rehacerse de golpe repetidamente. Si ya
  // existe, se actualizan sus datos en el sitio (Chart.js anima la
  // transición entre valores por su cuenta); solo se crea desde cero la
  // primera vez.
  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = values;
    chartInstance.data.datasets[0].backgroundColor = colors;
    // Mientras los datos se están asentando (ver animations.js), se aplica
    // sin animar — si no, cada corrección que llega desde Firestore hace
    // que el donut se redibuje "compitiendo" con la anterior.
    chartInstance.update(estaAsentando() ? "none" : undefined);
    return;
  }

  chartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: colorTema("--chart-borde", "#131a16"),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: colorTema("--chart-leyenda", "#9fada4"), boxWidth: 10, padding: 14, font: { family: "Inter", size: 12 } },
        },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.label}: ${formatEUR(ctx.parsed)}` },
        },
      },
    },
  });
}

function renderLimites(movimientos, categorias) {
  const el = document.getElementById("limites-list");
  const conLimite = categorias.filter((c) => Number(c.limite_mensual) > 0);

  if (conLimite.length === 0) {
    el.innerHTML = `<p class="empty-state">Añade un límite mensual a alguna categoría para verlo aquí.</p>`;
    return;
  }

  const gastos = gastosPorCategoriaDelMes(movimientos, categorias);
  const totalByCat = new Map(gastos.map((g) => [g.categoria.id, g.total]));

  el.innerHTML = conLimite
    .map((c) => {
      const gastado = totalByCat.get(c.id) || 0;
      const limite = Number(c.limite_mensual);
      const pct = Math.min(100, Math.round((gastado / limite) * 100));
      const cls = pct >= 100 ? "progress-fill--danger" : pct >= 75 ? "progress-fill--warning" : "";
      return `
        <div class="limite-row">
          <div class="limite-row__labels">
            <span class="name">${c.nombre}</span>
            <span class="value">${formatEUR(gastado)} / ${formatEUR(limite)}</span>
          </div>
          <div class="progress-track"><div class="progress-fill ${cls}" data-target-width="${pct}%"></div></div>
        </div>`;
    })
    .join("");

  animateProgressBars(el);
}

function renderTopLugares(movimientos) {
  const el = document.getElementById("top-lugares");
  if (!el) return;

  const top = gastosPorSubcategoriaDelMes(movimientos);

  if (top.length === 0) {
    el.innerHTML = `<p class="empty-state">Añade una subcategoría (ej. "Five Guys") a tus gastos para verlos aquí.</p>`;
    return;
  }

  el.innerHTML = top
    .map(
      ({ subcategoria, total }) => `
        <div class="mini-row">
          <div class="mini-row__main">
            <span class="mini-row__title">${subcategoria}</span>
          </div>
          <span class="mini-row__amount">${formatEUR(total)}</span>
        </div>`
    )
    .join("");
}

function renderRecientes(movimientos, categorias, cuentas) {
  const el = document.getElementById("movimientos-recientes");
  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c.nombre]));

  const recientes = [...movimientos]
    .sort((a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0))
    .slice(0, 6);

  if (recientes.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no hay movimientos.</p>`;
    return;
  }

  el.innerHTML = recientes
    .map((m) => {
      if (m.tipo === "Transferencia") {
        return `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="mini-row__icon">${icon("movimientos")}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${nombreDeCuenta(cuentaMap, m.cuenta_id)} → ${destinoTransferencia(m, cuentaMap)}</span>
              <span class="mini-row__sub">Transferencia · ${formatFecha(fromTimestamp(m.fecha))}</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(Math.abs(Number(m.importe)))}</span>
        </div>`;
      }
      const cat = catMap.get(m.categoria_id);
      const signo = m.tipo === "Ingreso" ? "+" : "−";
      const cls = m.tipo === "Ingreso" ? "mini-row__amount--pos" : "mini-row__amount--neg";
      return `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="mini-row__icon">${entityIcon(cat, iconForCategoriaTipo(cat?.tipo))}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${m.subcategoria || m.nota || cat?.nombre || "Movimiento"}</span>
              <span class="mini-row__sub">${cat?.nombre || ""} · ${formatFecha(fromTimestamp(m.fecha))}</span>
            </div>
          </div>
          <span class="mini-row__amount ${cls}">${signo} ${formatEUR(Math.abs(Number(m.importe)))}</span>
        </div>`;
    })
    .join("");
}

function renderPrestamos(prestamos, pagosPrestamos) {
  const el = document.getElementById("prestamos-activos");
  const activos = prestamos.filter((p) => p.estado !== "Pagado");

  if (activos.length === 0) {
    el.innerHTML = `<p class="empty-state">No hay préstamos activos.</p>`;
    return;
  }

  el.innerHTML = activos
    .map((p) => {
      const planPagos = esPlanDePagos(p);
      const monto = planPagos ? restantePlanDePagos(p, pagosPrestamos) : Number(p.capital ?? p.capital_inicial ?? 0);
      const sub = planPagos
        ? "plan de pagos diario"
        : p.interes_manual != null && p.interes_manual !== ""
        ? "interés fijo"
        : `${p.interes_porcentaje ?? 0}% interés`;
      return `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="avatar" style="background:${avatarColor(p.persona)}">${initials(p.persona)}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${p.persona}</span>
              <span class="mini-row__sub">${sub}</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(monto)}</span>
        </div>`;
    })
    .join("");
}

function renderSuscripciones(suscripciones, cuentas) {
  const el = document.getElementById("suscripciones-activas");
  const activas = suscripciones.filter((s) => s.activa !== false);

  if (activas.length === 0) {
    el.innerHTML = `<p class="empty-state">No hay suscripciones activas.</p>`;
    return;
  }

  el.innerHTML = activas
    .map(
      (s) => `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="mini-row__icon">${icon(iconForSuscripcion(s.nombre))}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${s.nombre}</span>
              <span class="mini-row__sub">${s.frecuencia}${s.proximo_pago ? " · próximo " + formatFecha(new Date(s.proximo_pago)) : ""}</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(s.precio)}</span>
        </div>`
    )
    .join("");
}

function renderCuentasResumen(state) {
  const { cuentas, movimientos } = state;
  const el = document.getElementById("cuentas-resumen");
  const activas = cuentas.filter((c) => c.activa !== false);

  if (activas.length === 0) {
    el.innerHTML = `<p class="empty-state">Añade tu primera cuenta.</p>`;
    return;
  }

  el.innerHTML = activas
    .map((c) => {
      const saldo = calcularSaldoCuenta(c, movimientos);
      return `
        <button type="button" class="mini-row" data-cuenta="${c.id}">
          <div class="mini-row__body">
            <span class="mini-row__icon">${entityIcon(c, iconForCuentaTipo(c.tipo))}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${c.nombre}</span>
              <span class="mini-row__sub">${c.tipo}</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(saldo)}</span>
        </button>`;
    })
    .join("");

  // Al tocar una cuenta se abre su historial completo (más reciente
  // primero) — el mismo modal que usa la vista de Cuentas, para no tener
  // dos formas distintas de ver lo mismo.
  el.querySelectorAll("[data-cuenta]").forEach((btn) =>
    btn.addEventListener("click", () => openHistorial(activas.find((c) => c.id === btn.dataset.cuenta), state))
  );
}
