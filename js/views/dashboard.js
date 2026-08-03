import {
  calcularSaldoCuenta,
  calcularSaldoTotal,
  gastosPorCategoriaDelMes,
  gastosPorSubcategoriaDelMes,
  formatEUR,
  formatFecha,
  fromTimestamp,
} from "../db.js?v=13";
import { initDashboardAnimations, countUpTo, animateProgressBars } from "../animations.js?v=13";
import { seedInitialData } from "../seed.js?v=13";
import {
  pendingCorrections,
  applyAugustCorrections,
  dismissCorrections,
  pendingPrestamosReset,
  resetPrestamos,
  dismissPrestamosReset,
  pendingGastosFijosAgosto,
  applyGastosFijosAgosto,
  dismissGastosFijosAgosto,
} from "../fixes.js?v=13";
import { icon, entityIcon, iconForCategoriaTipo, iconForCuentaTipo, iconForSuscripcion, initials, avatarColor } from "../icons.js?v=13";

let chartInstance = null;

// Mensaje legible para el error más probable en este banner: las reglas de
// Firestore todavía no incluyen la colección "configuracion" porque no se
// han vuelto a publicar tras la última actualización (ver SETUP.md 1.3).
function mensajeError(err) {
  if (err?.code === "permission-denied") {
    return "Sin permiso para guardar (¿has vuelto a publicar firestore.rules? Mira SETUP.md, sección 1.3).";
  }
  return `Error: ${err?.message || "inténtalo de nuevo"}`;
}

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
    document.getElementById("fix-banner-error").textContent = "";
    try {
      await applyAugustCorrections();
      await dismissCorrections();
      fixBtn.textContent = "Hecho ✓";
      document.getElementById("fix-banner")?.classList.add("is-hidden");
    } catch (err) {
      console.error("Error al aplicar correcciones:", err);
      fixBtn.textContent = "Reintentar";
      fixBtn.disabled = false;
      document.getElementById("fix-banner-error").textContent = mensajeError(err);
    }
  });

  const resetBtn = document.getElementById("btn-reset-prestamos");
  resetBtn?.addEventListener("click", async () => {
    resetBtn.disabled = true;
    resetBtn.textContent = "Aplicando…";
    document.getElementById("reset-prestamos-banner-error").textContent = "";
    try {
      await resetPrestamos();
      await dismissPrestamosReset();
      resetBtn.textContent = "Hecho ✓";
      document.getElementById("reset-prestamos-banner")?.classList.add("is-hidden");
    } catch (err) {
      console.error("Error al reiniciar préstamos:", err);
      resetBtn.textContent = "Reintentar";
      resetBtn.disabled = false;
      document.getElementById("reset-prestamos-banner-error").textContent = mensajeError(err);
    }
  });

  const gastosFijosBtn = document.getElementById("btn-gastos-fijos-agosto");
  gastosFijosBtn?.addEventListener("click", async () => {
    gastosFijosBtn.disabled = true;
    gastosFijosBtn.textContent = "Aplicando…";
    document.getElementById("gastos-fijos-agosto-banner-error").textContent = "";
    try {
      await applyGastosFijosAgosto();
      await dismissGastosFijosAgosto();
      gastosFijosBtn.textContent = "Hecho ✓";
      document.getElementById("gastos-fijos-agosto-banner")?.classList.add("is-hidden");
    } catch (err) {
      console.error("Error al marcar gastos fijos:", err);
      gastosFijosBtn.textContent = "Reintentar";
      gastosFijosBtn.disabled = false;
      document.getElementById("gastos-fijos-agosto-banner-error").textContent = mensajeError(err);
    }
  });
}

const CATEGORY_COLORS = ["#7a9b81", "#a8c3a0", "#8a9b6e", "#5f7a63", "#b6975f", "#7d8f8a", "#9c8a6f", "#6b8778"];

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

  const { cuentas, categorias, movimientos, suscripciones, prestamos } = state;

  const seedBanner = document.getElementById("seed-banner");
  if (seedBanner) seedBanner.classList.toggle("is-hidden", !(state.ready && cuentas.length === 0));

  const fixBanner = document.getElementById("fix-banner");
  if (fixBanner) fixBanner.classList.toggle("is-hidden", !(state.ready && pendingCorrections()));

  const resetBanner = document.getElementById("reset-prestamos-banner");
  if (resetBanner) resetBanner.classList.toggle("is-hidden", !(state.ready && pendingPrestamosReset()));

  const gastosFijosBanner = document.getElementById("gastos-fijos-agosto-banner");
  if (gastosFijosBanner) gastosFijosBanner.classList.toggle("is-hidden", !(state.ready && pendingGastosFijosAgosto()));

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
  renderPrestamos(prestamos);
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
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#9fada4", boxWidth: 10, padding: 14, font: { family: "Inter", size: 12 } },
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
              <span class="mini-row__title">${cuentaMap.get(m.cuenta_id) || "—"} → ${cuentaMap.get(m.cuenta_destino_id) || "—"}</span>
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

function renderPrestamos(prestamos) {
  const el = document.getElementById("prestamos-activos");
  const activos = prestamos.filter((p) => p.estado !== "Pagado");

  if (activos.length === 0) {
    el.innerHTML = `<p class="empty-state">No hay préstamos activos.</p>`;
    return;
  }

  el.innerHTML = activos
    .map((p) => {
      const capital = Number(p.capital ?? p.capital_inicial ?? 0);
      return `
        <div class="mini-row">
          <div class="mini-row__body">
            <span class="avatar" style="background:${avatarColor(p.persona)}">${initials(p.persona)}</span>
            <div class="mini-row__main">
              <span class="mini-row__title">${p.persona}</span>
              <span class="mini-row__sub">${p.interes_porcentaje ?? 0}% interés</span>
            </div>
          </div>
          <span class="mini-row__amount">${formatEUR(capital)}</span>
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
            <span class="mini-row__icon">${entityIcon(c, iconForCuentaTipo(c.tipo))}</span>
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
