import {
  calcularSaldoCuenta,
  calcularSaldoTotal,
  gastosPorCategoriaDelMes,
  formatEUR,
  formatFecha,
  fromTimestamp,
} from "../db.js";
import { initDashboardAnimations, countUpTo, animateProgressBars } from "../animations.js";
import { seedInitialData } from "../seed.js";
import { pendingCorrections, applyAugustCorrections } from "../fixes.js";
import { icon, iconForCategoriaTipo, iconForCuentaTipo, iconForSuscripcion, initials, avatarColor } from "../icons.js";

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

  const fixBtn = document.getElementById("btn-apply-fixes");
  fixBtn?.addEventListener("click", async () => {
    fixBtn.disabled = true;
    fixBtn.textContent = "Aplicando…";
    try {
      const results = await applyAugustCorrections();
      fixBtn.textContent = results.length ? "Hecho ✓" : "No había nada pendiente";
    } catch (err) {
      fixBtn.textContent = "Error, inténtalo de nuevo";
      fixBtn.disabled = false;
    }
  });
}

const CATEGORY_COLORS = ["#7a9b81", "#a8c3a0", "#8a9b6e", "#5f7a63", "#b6975f", "#7d8f8a", "#9c8a6f", "#6b8778"];

function capitalActual(prestamo, pagos) {
  const capitalPagado = pagos
    .filter((p) => p.prestamo_id === prestamo.id && p.pagado)
    .reduce((acc, p) => {
      if (p.tipo === "Capital") return acc + Number(p.importe ?? 0);
      if (p.tipo === "Ambos") return acc + Number(p.importe_capital ?? 0);
      return acc;
    }, 0);
  return Number(prestamo.capital_inicial ?? 0) - capitalPagado;
}

export function renderDashboard(state) {
  const { cuentas, categorias, movimientos, suscripciones, prestamos, pagosPrestamos } = state;

  const seedBanner = document.getElementById("seed-banner");
  if (seedBanner) seedBanner.classList.toggle("is-hidden", !(state.ready && cuentas.length === 0));

  const fixBanner = document.getElementById("fix-banner");
  if (fixBanner) fixBanner.classList.toggle("is-hidden", !(state.ready && pendingCorrections()));

  document.getElementById("hero-fecha").textContent = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  countUpTo(document.getElementById("saldo-total"), calcularSaldoTotal(cuentas, movimientos), formatEUR);

  renderChart(movimientos, categorias);
  renderLimites(movimientos, categorias);
  renderRecientes(movimientos, categorias, cuentas);
  renderPrestamos(prestamos, pagosPrestamos);
  renderSuscripciones(suscripciones, cuentas);
  renderCuentasResumen(cuentas, movimientos);

  initDashboardAnimations();
}

function renderChart(movimientos, categorias) {
  const canvas = document.getElementById("chart-categorias");
  if (!canvas || typeof Chart === "undefined") return;

  const datos = gastosPorCategoriaDelMes(movimientos, categorias).filter((d) => d.total > 0);

  if (chartInstance) chartInstance.destroy();

  if (datos.length === 0) {
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  chartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: datos.map((d) => d.categoria.nombre),
      datasets: [
        {
          data: datos.map((d) => d.total),
          backgroundColor: datos.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
          borderColor: "#131a16",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#9fada4", boxWidth: 10, padding: 16, font: { family: "Inter", size: 12 } },
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

function renderRecientes(movimientos, categorias, cuentas) {
  const el = document.getElementById("movimientos-recientes");
  const catMap = new Map(categorias.map((c) => [c.id, c]));

  const recientes = [...movimientos]
    .sort((a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0))
    .slice(0, 6);

  if (recientes.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no hay movimientos.</p>`;
    return;
  }

  el.innerHTML = recientes
    .map((m) => {
      const cat = catMap.get(m.categoria_id);
      const signo = m.tipo === "Ingreso" ? "+" : "−";
      const cls = m.tipo === "Ingreso" ? "mini-row__amount--pos" : "mini-row__amount--neg";
      return `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="mini-row__icon">${icon(iconForCategoriaTipo(cat?.tipo))}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${m.nota || cat?.nombre || "Movimiento"}</span>
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
  const activos = prestamos.filter((p) => p.estado === "Activo");

  if (activos.length === 0) {
    el.innerHTML = `<p class="empty-state">No hay préstamos activos.</p>`;
    return;
  }

  el.innerHTML = activos
    .map((p) => {
      const restante = capitalActual(p, pagosPrestamos);
      return `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="avatar" style="background:${avatarColor(p.persona)}">${initials(p.persona)}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${p.persona}</span>
              <span class="mini-row__sub">Prestado ${formatEUR(p.capital_inicial)} · ${p.interes_porcentaje}% interés</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(restante)}</span>
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

function renderCuentasResumen(cuentas, movimientos) {
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
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="mini-row__icon">${icon(iconForCuentaTipo(c.tipo))}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${c.nombre}</span>
              <span class="mini-row__sub">${c.tipo}</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(saldo)}</span>
        </div>`;
    })
    .join("");
}

export { capitalActual };
