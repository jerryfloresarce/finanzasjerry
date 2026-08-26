// vida:inicio
// Cartera: las inversiones de Trade Republic, apuntadas a mano y con los
// precios refrescables. Enseña cuánto has puesto, cuánto vale hoy y si vas
// ganando o perdiendo — sin abrir Trade Republic. Las señales de abajo son
// reglas fijas y transparentes, no consejo financiero.

import {
  vida,
  resumenCartera,
  senalesCartera,
  proyeccion,
  actualizarPrecios,
  addInversion,
  updateInversion,
  deleteInversion,
  guardarSistema,
} from "../vida.js?v=61";
import { formatEUR } from "../db.js?v=61";
import { openModal, closeModal } from "../modal.js?v=61";
import { colorTema } from "../tema.js?v=61";
import { efectoAlGuardar } from "../efectos.js?v=61";

// Un porcentaje y unas unidades a la española: coma decimal, no punto.
const pctTxt = (n) => Math.abs(n).toFixed(1).replace(".", ",");
const udsTxt = (n) => String(n).replace(".", ",");

let chartProyeccion = null;
let actualizando = false;
// Parámetros de la calculadora de proyección; sobreviven a los repintados.
const calc = { mensual: 100, pct: 7, anos: 10 };

const TIPOS_INV = { etf: "ETF", accion: "Acción", cripto: "Cripto" };

export function mountVidaCartera() {
  const root = document.getElementById("view-cartera");
  root.addEventListener("input", (e) => {
    if (e.target.id === "calc-mensual") calc.mensual = Number(e.target.value || 0);
    if (e.target.id === "calc-anos") {
      calc.anos = Number(e.target.value);
      renderVidaCartera(null);
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.id === "calc-mensual") renderVidaCartera(null);
  });
  root.addEventListener("click", async (e) => {
    const pct = e.target.closest("[data-calc-pct]");
    if (pct) {
      calc.pct = Number(pct.dataset.calcPct);
      renderVidaCartera(null);
      return;
    }
    if (e.target.closest("#btn-add-inversion")) {
      openFormInversion(null);
      return;
    }
    const editar = e.target.closest("[data-editar-inversion]");
    if (editar) {
      openFormInversion(vida.inversiones.find((p) => p.id === editar.dataset.editarInversion));
      return;
    }
    if (e.target.closest("#btn-actualizar-precios")) {
      if (actualizando) return;
      actualizando = true;
      const boton = document.getElementById("btn-actualizar-precios");
      boton.textContent = "Actualizando…";
      const { actualizadas, errores } = await actualizarPrecios();
      actualizando = false;
      const aviso = document.getElementById("cartera-aviso");
      if (aviso) {
        aviso.innerHTML = [
          actualizadas ? `✓ ${actualizadas} ${actualizadas === 1 ? "precio actualizado" : "precios actualizados"}.` : "",
          ...errores,
        ]
          .filter(Boolean)
          .join("<br />");
      }
      renderVidaCartera(null);
      return;
    }
    if (e.target.closest("#btn-clave-finnhub")) {
      const clave = prompt(
        "Clave de Finnhub (gratis en finnhub.io → Get free API key). Se guarda una vez y sirve para refrescar acciones y ETF:",
        vida.sistema.finnhub_key || ""
      );
      if (clave !== null) await guardarSistema({ finnhub_key: clave.trim() || null });
      return;
    }
  });
}

export function renderVidaCartera(_state) {
  const el = document.getElementById("cartera-content");
  if (!el) return;

  const r = resumenCartera();
  const senales = senalesCartera();
  const positivo = r.pl >= 0;
  const inicial = Math.round(r.valor);
  const puntos = proyeccion(inicial, calc.mensual, calc.pct, calc.anos);
  const final = puntos[puntos.length - 1];

  el.innerHTML = `
    <div class="progreso-kpis">
      <div class="kpi-tile"><span class="kpi-tile__label">Invertido</span><span class="kpi-tile__value">${formatEUR(r.invertido)}</span></div>
      <div class="kpi-tile"><span class="kpi-tile__label">Vale hoy</span><span class="kpi-tile__value">${formatEUR(r.valor)}</span></div>
      <div class="kpi-tile"><span class="kpi-tile__label">Resultado</span><span class="kpi-tile__value ${positivo ? "kpi-tile__value--pos" : "cartera-neg"}">${positivo ? "+" : "−"}${formatEUR(Math.abs(r.pl))}</span><span class="entity-card__meta">${positivo ? "+" : "−"}${pctTxt(r.plPct)} %</span></div>
      <div class="kpi-tile"><span class="kpi-tile__label">Posiciones</span><span class="kpi-tile__value">${r.posiciones.length}</span></div>
    </div>

    <div class="grid grid--hoy">
      <article class="card">
        <div class="view-header" style="margin-bottom:8px;">
          <h2 class="card__title" style="margin:0;">Posiciones</h2>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn--ghost btn--sm" id="btn-actualizar-precios">↻ Actualizar precios</button>
            <button type="button" class="btn btn--primary btn--sm" id="btn-add-inversion">+ Añadir</button>
          </div>
        </div>
        <p class="entity-card__meta" id="cartera-aviso"></p>
        <div class="mini-list">
          ${
            r.posiciones.length === 0
              ? `<p class="empty-state">Apunta aquí lo que compres en Trade Republic: qué es, cuántas participaciones y a qué precio. La app te dirá cuánto vale y si vas ganando.</p>`
              : r.posiciones
                  .map((p) => {
                    const pos = p.pl >= 0;
                    return `
              <button type="button" class="susc-pago-editar" data-editar-inversion="${p.id}" style="padding:10px 0; border-bottom:1px solid var(--border);">
                <span class="mini-row__main" style="flex:1; min-width:0;">
                  <span class="mini-row__title">${p.nombre} <span class="entity-card__meta">· ${TIPOS_INV[p.tipo] || p.tipo}</span></span>
                  <span class="mini-row__sub">${udsTxt(p.unidades)} × ${formatEUR(Number(p.precio_actual ?? p.precio_compra ?? 0))}${p.precio_actualizado ? ` · precio del ${p.precio_actualizado.slice(8, 10)}/${p.precio_actualizado.slice(5, 7)}` : " · precio de compra"}</span>
                </span>
                <span class="mini-row__main" style="text-align:right;">
                  <span class="mini-row__amount">${formatEUR(p.valor)}</span>
                  <span class="mini-row__sub ${pos ? "cartera-pos" : "cartera-neg"}">${pos ? "+" : "−"}${formatEUR(Math.abs(p.pl))} (${pos ? "+" : "−"}${pctTxt(p.plPct)} %)</span>
                </span>
              </button>`;
                  })
                  .join("")
          }
        </div>
        <p class="entity-card__meta" style="margin-top:10px;">
          Cripto se actualiza sola (CoinGecko). Acciones y ETF necesitan una clave gratuita:
          <button type="button" class="btn btn--ghost btn--sm" id="btn-clave-finnhub">${vida.sistema.finnhub_key ? "cambiar clave de Finnhub" : "poner clave de Finnhub"}</button>
        </p>

        ${
          senales.length
            ? `<h2 class="card__title" style="margin-top:16px;">Señales</h2>
          <div class="hoy-lista">${senales.map((s) => `<div class="cartera-senal"><i class="ph ph-lightbulb" aria-hidden="true"></i><span>${s}</span></div>`).join("")}</div>`
            : ""
        }
        <p class="entity-card__meta" style="margin-top:12px;">
          Las señales son reglas fijas sobre tus propios números, no consejo
          financiero: nadie sabe qué hará el mercado, tampoco esta app.
        </p>
      </article>

      <article class="card">
        <h2 class="card__title">¿Y si sigo aportando?</h2>
        <p class="entity-card__meta" style="margin-top:-8px;">
          Partiendo de lo que vale hoy tu cartera (${formatEUR(inicial)}),
          aportando cada mes, a una rentabilidad media estimada:
        </p>
        <div class="form-grid" style="margin:10px 0;">
          <label class="field">
            <span class="field__label">Aportación al mes (€)</span>
            <input type="number" id="calc-mensual" value="${calc.mensual}" data-prefill="${calc.mensual}" />
          </label>
          <div class="field">
            <span class="field__label">Rentabilidad anual</span>
            <div class="chips" style="margin:4px 0 0;">
              ${[3, 5, 7].map((p) => `<button type="button" class="chip ${calc.pct === p ? "chip--on" : ""}" data-calc-pct="${p}">${p} %</button>`).join("")}
            </div>
          </div>
        </div>
        <label class="field field--full" style="margin-bottom:10px;">
          <span class="field__label">Años: ${calc.anos}</span>
          <input type="range" min="1" max="30" id="calc-anos" value="${calc.anos}" />
        </label>
        <div class="chart-wrap" style="height:200px;"><canvas id="chart-proyeccion"></canvas></div>
        <p class="entity-card__meta" style="margin-top:10px;">
          En ${calc.anos} años habrías aportado <strong>${formatEUR(final.aportado)}</strong> y
          tendrías <strong>${formatEUR(final.valor)}</strong> si el mercado diera
          un ${calc.pct} % anual de media. Es una estimación con interés
          compuesto, no una promesa: la bolsa mundial ha dado ~7 % anual de
          media histórica, pero con años de −20 % y de +25 % por el camino.
        </p>
      </article>
    </div>
  `;

  pintarProyeccion(puntos);
}

function pintarProyeccion(puntos) {
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById("chart-proyeccion");
  if (!canvas) return;
  if (chartProyeccion) chartProyeccion.destroy();
  const linea = colorTema("--success", "#7a9b81");
  const eje = colorTema("--chart-eje", "#6d7a72");
  const rejilla = colorTema("--chart-rejilla", "rgba(233,238,234,0.06)");
  chartProyeccion = new Chart(canvas, {
    type: "line",
    data: {
      labels: puntos.map((p) => (p.ano === 0 ? "hoy" : `${p.ano} a`)),
      datasets: [
        { label: "Con el mercado", data: puntos.map((p) => Math.round(p.valor)), borderColor: linea, tension: 0.25, pointRadius: 0, fill: false },
        { label: "Solo aportado", data: puntos.map((p) => Math.round(p.aportado)), borderColor: eje, borderDash: [6, 6], pointRadius: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", align: "end", labels: { color: eje, boxWidth: 8, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatEUR(ctx.parsed.y)}` } },
      },
      scales: { x: { grid: { color: rejilla }, ticks: { color: eje } }, y: { grid: { color: rejilla }, ticks: { color: eje, callback: (v) => formatEUR(v).replace(",00", "") } } },
    },
  });
}

function openFormInversion(inv) {
  const isEdit = Boolean(inv);
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar posición" : "Nueva posición"}</h2>
    <form id="form-inversion" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Nombre</span>
        <input type="text" name="nombre" required value="${inv?.nombre ?? ""}" placeholder="MSCI World, Bitcoin…" />
      </label>
      <label class="field">
        <span class="field__label">Tipo</span>
        <select name="tipo" id="inv-tipo">
          <option value="etf" ${inv?.tipo === "etf" ? "selected" : ""}>ETF / fondo</option>
          <option value="accion" ${inv?.tipo === "accion" ? "selected" : ""}>Acción</option>
          <option value="cripto" ${inv?.tipo === "cripto" ? "selected" : ""}>Cripto</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label" id="inv-simbolo-label">Símbolo (opcional)</span>
        <input type="text" name="simbolo" value="${inv?.simbolo ?? ""}" placeholder="AAPL" />
      </label>
      <label class="field">
        <span class="field__label">Participaciones / unidades</span>
        <input type="number" step="0.000001" min="0" name="unidades" required value="${inv?.unidades ?? ""}" placeholder="2.5" />
      </label>
      <label class="field">
        <span class="field__label">Precio de compra (€/unidad)</span>
        <input type="number" step="0.0001" min="0" name="precio_compra" required value="${inv?.precio_compra ?? ""}" placeholder="85.20" />
      </label>
      <label class="field">
        <span class="field__label">Precio actual (€/unidad)</span>
        <input type="number" step="0.0001" min="0" name="precio_actual" value="${inv?.precio_actual ?? ""}" placeholder="Vacío = el de compra" />
      </label>
      <label class="field" id="inv-divisa-campo">
        <span class="field__label">La cotización del símbolo va en…</span>
        <select name="divisa">
          <option value="USD" ${(inv?.divisa ?? "USD") === "USD" ? "selected" : ""}>Dólares (EE. UU.)</option>
          <option value="EUR" ${inv?.divisa === "EUR" ? "selected" : ""}>Euros</option>
        </select>
      </label>
      <p class="entity-card__meta field--full" id="inv-ayuda"></p>
      <p class="field-error" id="form-inversion-error"></p>
      <div class="modal__actions field--full">
        ${isEdit ? `<button type="button" class="btn btn--ghost" id="btn-borrar-inversion" style="margin-right:auto;">Eliminar</button>` : ""}
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Guardar" : "Añadir"}</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        const tipoSel = root.querySelector("#inv-tipo");
        const ayuda = root.querySelector("#inv-ayuda");
        const divisaCampo = root.querySelector("#inv-divisa-campo");
        const actualizarAyuda = () => {
          const esCripto = tipoSel.value === "cripto";
          divisaCampo.classList.toggle("is-hidden", esCripto);
          ayuda.textContent = esCripto
            ? 'Para que el precio se actualice solo, el símbolo es el id de CoinGecko en minúsculas: "bitcoin", "ethereum", "solana"…'
            : "Para refrescar el precio hace falta el símbolo (el de EE. UU., p. ej. AAPL o VOO) y la clave gratuita de Finnhub. Sin símbolo, el precio se pone a mano y todo lo demás funciona igual.";
        };
        tipoSel.addEventListener("change", actualizarAyuda);
        actualizarAyuda();

        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#btn-borrar-inversion")?.addEventListener("click", async () => {
          if (!confirm("¿Eliminar esta posición de la cartera?")) return;
          await deleteInversion(inv.id);
          closeModal();
          renderVidaCartera(null);
        });
        root.querySelector("#form-inversion").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            nombre: f.nombre.value.trim(),
            tipo: f.tipo.value,
            simbolo: f.simbolo.value.trim() || null,
            unidades: Number(f.unidades.value),
            precio_compra: Number(f.precio_compra.value),
            precio_actual: f.precio_actual.value !== "" ? Number(f.precio_actual.value) : Number(f.precio_compra.value),
            divisa: f.tipo.value === "cripto" ? "EUR" : f.divisa.value,
          };
          try {
            if (isEdit) await updateInversion(inv.id, data);
            else await addInversion(data);
            efectoAlGuardar();
            closeModal();
            renderVidaCartera(null);
          } catch (err) {
            root.querySelector("#form-inversion-error").textContent = "No se pudo guardar. ¿Están publicadas las reglas nuevas de Firebase?";
          }
        });
      },
    }
  );
}
// vida:fin
