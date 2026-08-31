// vida:inicio
// Cartera: las inversiones apuntadas a mano, presentadas como en Trade
// Republic — dos pestañas (Cuenta de valores / Criptomonedas), cada fila
// con su posición, su último precio y su variación, y un selector para ver
// la variación de hoy o desde la compra. Cada término técnico lleva una (i)
// que lo explica en cristiano. Las señales son reglas fijas, no consejo
// financiero.

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
} from "../vida.js?v=92";
import { formatEUR } from "../db.js?v=92";
import { openModal, closeModal } from "../modal.js?v=92";
import { colorTema } from "../tema.js?v=92";
import { efectoAlGuardar } from "../efectos.js?v=92";
import { initials, avatarColor } from "../icons.js?v=92";

// Un porcentaje y unas unidades a la española: coma decimal, no punto.
const pctTxt = (n) => Math.abs(n).toFixed(1).replace(".", ",");
const udsTxt = (n) => String(n).replace(".", ",");

let chartProyeccion = null;
let actualizando = false;
// Pestaña activa y qué variación se enseña; sobreviven a los repintados.
let tabActiva = "valores"; // "valores" | "cripto"
let vistaVariacion = "compra"; // "compra" | "hoy"
// La calculadora parte de lo que HAY invertido ahora mismo; la aportación
// mensual arranca a 0 para que la primera lectura sea "qué haría el
// mercado con lo mío", no un supuesto que nadie ha decidido.
const calc = { mensual: 0, pct: 7, anos: 10 };

const TIPOS_INV = { etf: "ETF", accion: "Acción", cripto: "Cripto" };

// Instrumentos conocidos para añadir en dos toques (los de la cartera que
// quiere copiar, más algún clásico). Los ETF europeos (UCITS) no cotizan en
// el plan gratuito de Finnhub: su precio se copia de Trade Republic a mano.
const CONOCIDOS = [
  { nombre: "Vanguard FTSE All-World (Acc)", tipo: "etf", simbolo: "", divisa: "EUR" },
  { nombre: "Vanguard FTSE All-World (Dist)", tipo: "etf", simbolo: "", divisa: "EUR" },
  { nombre: "iShares Core MSCI World (Acc)", tipo: "etf", simbolo: "", divisa: "EUR" },
  { nombre: "iShares Core S&P 500 (Acc)", tipo: "etf", simbolo: "", divisa: "EUR" },
  { nombre: "Vanguard S&P 500 (Acc)", tipo: "etf", simbolo: "", divisa: "EUR" },
  { nombre: "NASDAQ 100 (Acc)", tipo: "etf", simbolo: "", divisa: "EUR" },
  { nombre: "Amazon", tipo: "accion", simbolo: "AMZN", divisa: "USD" },
  { nombre: "McDonald's", tipo: "accion", simbolo: "MCD", divisa: "USD" },
  { nombre: "NVIDIA", tipo: "accion", simbolo: "NVDA", divisa: "USD" },
  { nombre: "Realty Income", tipo: "accion", simbolo: "O", divisa: "USD" },
  { nombre: "Apple", tipo: "accion", simbolo: "AAPL", divisa: "USD" },
  { nombre: "Bitcoin", tipo: "cripto", simbolo: "bitcoin", divisa: "EUR" },
  { nombre: "Ethereum", tipo: "cripto", simbolo: "ethereum", divisa: "EUR" },
];

// El glosario de las (i): cada término técnico, explicado como se lo
// contarías a alguien que no ha invertido nunca.
const GLOSARIO = {
  posicion: {
    titulo: "Posición",
    texto: "Cuántas participaciones tienes de esa cosa. Puede ser un número con decimales: 0,5 participaciones de un ETF es la mitad de una, y es completamente normal — se compra por euros, no por unidades enteras.",
  },
  ultimo_precio: {
    titulo: "Último precio",
    texto: "Lo que cuesta UNA participación ahora mismo. Tu dinero es este precio multiplicado por tu posición. Sube y baja constantemente; no hace falta mirarlo cada día.",
  },
  variacion: {
    titulo: "Variación",
    texto: "Cuánto ha cambiado el precio. 'Hoy' compara con ayer: es ruido, sube y baja sin razón que te importe. 'Desde la compra' compara con lo que pagaste: esa es la única que dice si vas ganando o perdiendo de verdad.",
  },
  etf: {
    titulo: "¿Qué es un ETF?",
    texto: "Una cesta con cientos o miles de empresas dentro. Comprar un ETF 'mundial' es comprar un trocito de las mayores empresas del planeta de golpe. Si una quiebra, ni lo notas. Por eso es la forma más tranquila de empezar: no hay que acertar cuál ganará.",
  },
  acc_dist: {
    titulo: "(Acc) y (Dist)",
    texto: "Acc = acumulación: los dividendos que pagan las empresas se reinvierten solos dentro del fondo, y crece más rápido. Dist = distribución: te los pagan en efectivo. Para acumular a largo plazo, Acc suele convenir más en España (no pagas impuestos por dividendos que no cobras).",
  },
  cripto: {
    titulo: "Criptomonedas",
    texto: "Lo más volátil de esta pantalla: puede caer un 50 % en meses y también subirlo. Regla simple: que sea solo una parte pequeña de la cartera y nunca dinero que puedas necesitar.",
  },
  proyeccion: {
    titulo: "¿Qué es esta estimación?",
    texto: "Parte de lo que tienes invertido AHORA MISMO y calcula qué haría el mercado con ello si diera de media ese % al año (interés compuesto). La aportación mensual es opcional: a 0 ves solo crecer lo tuyo; ponle algo para jugar con '¿y si además aporto?'. La bolsa mundial ha dado ~7 % anual de media histórica, con años de −20 % y de +25 % por el camino. Es para hacerse una idea, no una promesa.",
  },
  senales: {
    titulo: "Las señales",
    texto: "Reglas fijas sobre TUS números: concentración, caídas grandes, precios sin actualizar. No predicen nada — nadie puede — pero avisan de lo que a cualquiera se le pasaría por alto.",
  },
  simbolo: {
    titulo: "El símbolo",
    texto: "El código con el que la app busca el precio automáticamente. Acciones de EE. UU.: su ticker (AAPL, AMZN…) con la clave de Finnhub. Cripto: su id de CoinGecko en minúsculas (bitcoin, ethereum). Los ETF europeos no están en el plan gratuito: su precio se copia de Trade Republic con el lápiz, y todo lo demás se calcula igual.",
  },
};

function abrirInfo(clave) {
  const g = GLOSARIO[clave];
  if (!g) return;
  openModal(
    `
    <h2 class="modal__title">${g.titulo}</h2>
    <p style="font-size:0.92rem; line-height:1.6; margin:0 0 8px;">${g.texto}</p>
    <div class="modal__actions">
      <button type="button" class="btn btn--primary" id="btn-cerrar-info">Entendido</button>
    </div>
  `,
    { onMount: (root) => root.querySelector("#btn-cerrar-info").addEventListener("click", closeModal) }
  );
}

const info = (clave) => `<button type="button" class="info-btn" data-info="${clave}" title="¿Qué es esto?">i</button>`;

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
    const infoBtn = e.target.closest("[data-info]");
    if (infoBtn) {
      abrirInfo(infoBtn.dataset.info);
      return;
    }
    const tab = e.target.closest("[data-tab-cartera]");
    if (tab) {
      tabActiva = tab.dataset.tabCartera;
      renderVidaCartera(null);
      return;
    }
    if (e.target.closest("#btn-toggle-variacion")) {
      vistaVariacion = vistaVariacion === "compra" ? "hoy" : "compra";
      renderVidaCartera(null);
      return;
    }
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
      if (boton) boton.textContent = "Actualizando…";
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
        "Clave de Finnhub (gratis en finnhub.io → Get free API key). Se guarda una vez y sirve para refrescar acciones de EE. UU.:",
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

  const enPestana = r.posiciones.filter((p) => (tabActiva === "cripto" ? p.tipo === "cripto" : p.tipo !== "cripto"));

  const fila = (p) => {
    // La variación que toca según el selector: desde la compra (la de
    // verdad) o la de hoy (el ruido del día, si el refresco la trajo).
    const esHoy = vistaVariacion === "hoy";
    const valorPct = esHoy ? p.dia_pct : p.plPct;
    const tienePct = typeof valorPct === "number";
    const sube = (valorPct ?? 0) >= 0;
    return `
      <button type="button" class="tr-fila" data-editar-inversion="${p.id}">
        <span class="avatar avatar--sm" style="background:${avatarColor(p.nombre)}">${initials(p.nombre)}</span>
        <span class="tr-fila__main">
          <span class="tr-fila__nombre">${p.nombre}</span>
          <span class="tr-fila__sub">${udsTxt(p.unidades)} uds · ${formatEUR(Number(p.precio_actual ?? p.precio_compra ?? 0))}${
      p.precio_actualizado ? "" : " (precio de compra)"
    }</span>
        </span>
        <span class="tr-fila__fin">
          <span class="tr-fila__valor">${formatEUR(p.valor)}</span>
          <span class="tr-fila__pct ${tienePct ? (sube ? "cartera-pos" : "cartera-neg") : ""}">${
      tienePct ? `${sube ? "▲" : "▼"} ${pctTxt(valorPct)} %` : esHoy ? "— hoy sin dato" : "—"
    }</span>
        </span>
      </button>`;
  };

  el.innerHTML = `
    <div class="tr-cabecera">
      <div>
        <p class="tr-cabecera__valor">${formatEUR(r.valor)}</p>
        <p class="tr-cabecera__sub ${positivo ? "cartera-pos" : "cartera-neg"}">
          ${positivo ? "▲" : "▼"} ${formatEUR(Math.abs(r.pl))} (${pctTxt(r.plPct)} %) desde la compra
        </p>
      </div>
      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn--ghost btn--sm" id="btn-actualizar-precios">↻ Actualizar</button>
        <button type="button" class="btn btn--primary btn--sm" id="btn-add-inversion">+ Añadir</button>
      </div>
    </div>
    <p class="entity-card__meta" id="cartera-aviso"></p>

    <article class="card">
      <div class="tr-tabs">
        <button type="button" class="tr-tab ${tabActiva === "valores" ? "tr-tab--on" : ""}" data-tab-cartera="valores">Cuenta de valores</button>
        <button type="button" class="tr-tab ${tabActiva === "cripto" ? "tr-tab--on" : ""}" data-tab-cartera="cripto">Criptomonedas</button>
      </div>
      <div class="tr-lista-cabecera">
        <span>Instrumento ${info("posicion")}</span>
        <button type="button" class="tr-selector" id="btn-toggle-variacion">
          ${vistaVariacion === "compra" ? "Desde la compra" : "Variación hoy"} ${info("variacion")} <i class="ph-bold ph-caret-down" aria-hidden="true"></i>
        </button>
      </div>
      <div class="tr-lista">
        ${
          enPestana.length === 0
            ? `<p class="empty-state">${
                tabActiva === "cripto"
                  ? "Sin criptomonedas apuntadas. Si compras bitcoin en Trade Republic, apúntalo aquí y su precio se refresca solo."
                  : "Todavía nada. Cuando compres tu primer ETF o acción en Trade Republic, apúntalo con + Añadir: qué es, cuántas participaciones y a qué precio."
              }</p>`
            : enPestana.map(fila).join("")
        }
      </div>
      <p class="entity-card__meta" style="margin-top:10px;">
        Toca una fila para editarla. Último precio ${info("ultimo_precio")} ·
        ETF ${info("etf")} · (Acc)/(Dist) ${info("acc_dist")} · Cripto ${info("cripto")}
        ${vida.sistema.finnhub_key ? "" : ` · <button type="button" class="btn btn--ghost btn--sm" id="btn-clave-finnhub">poner clave de Finnhub</button>`}
      </p>
      ${
        senales.length
          ? `<h2 class="card__title" style="margin-top:14px;">Señales ${info("senales")}</h2>
        <div class="hoy-lista">${senales.map((s) => `<div class="cartera-senal"><i class="ph ph-lightbulb" aria-hidden="true"></i><span>${s}</span></div>`).join("")}</div>`
          : ""
      }
    </article>

    <article class="card" style="margin-top:16px;">
      <h2 class="card__title">¿Cuánto podría llegar a ser? ${info("proyeccion")}</h2>
      <p class="entity-card__meta" style="margin-top:-6px;">
        ${
          inicial > 0
            ? `Parte de lo que tienes invertido ahora mismo: <strong>${formatEUR(inicial)}</strong>. La aportación al mes es opcional — a 0, ves solo lo que haría el mercado con lo tuyo.`
            : `Todavía no hay nada invertido, así que de momento no hay nada que proyectar. En cuanto apuntes tu primera compra, aquí verás lo que podría llegar a ser con los años. Si quieres jugar mientras tanto, pon una aportación al mes.`
        }
      </p>
      <div class="form-grid" style="margin:10px 0;">
        <label class="field">
          <span class="field__label">Aportación al mes (€, opcional)</span>
          <input type="number" id="calc-mensual" value="${calc.mensual}" data-prefill="${calc.mensual}" />
        </label>
        <div class="field">
          <span class="field__label">Rentabilidad anual estimada</span>
          <div class="chips" style="margin:4px 0 0;">
            ${[3, 5, 7].map((p) => `<button type="button" class="chip ${calc.pct === p ? "chip--on" : ""}" data-calc-pct="${p}">${p} %</button>`).join("")}
          </div>
        </div>
      </div>
      <label class="field field--full" style="margin-bottom:10px;">
        <span class="field__label">Años: ${calc.anos}</span>
        <input type="range" min="1" max="30" id="calc-anos" value="${calc.anos}" />
      </label>
      ${
        inicial > 0 || calc.mensual > 0
          ? `<div class="chart-wrap" style="height:200px;"><canvas id="chart-proyeccion"></canvas></div>
      <p class="entity-card__meta" style="margin-top:10px;">
        ${
          calc.mensual > 0
            ? `Partiendo de ${formatEUR(inicial)} y aportando ${formatEUR(calc.mensual)} al mes: en ${calc.anos} años habrías aportado <strong>${formatEUR(final.aportado)}</strong> y tendrías <strong>${formatEUR(final.valor)}</strong> si el mercado diera un ${calc.pct} % anual de media.`
            : `Tus ${formatEUR(inicial)} de hoy, sin aportar nada más, serían <strong>${formatEUR(final.valor)}</strong> en ${calc.anos} años si el mercado diera un ${calc.pct} % anual de media.`
        }
      </p>`
          : ""
      }
    </article>
  `;

  if (inicial > 0 || calc.mensual > 0) pintarProyeccion(puntos);
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
      ${
        isEdit
          ? ""
          : `<label class="field field--full">
        <span class="field__label">Elegir de la lista (opcional)</span>
        <select id="inv-conocido">
          <option value="">— Escribir a mano —</option>
          ${CONOCIDOS.map((c, i) => `<option value="${i}">${c.nombre}</option>`).join("")}
        </select>
      </label>`
      }
      <label class="field field--full">
        <span class="field__label">Nombre</span>
        <input type="text" name="nombre" required value="${inv?.nombre ?? ""}" placeholder="Vanguard FTSE All-World…" />
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
        <span class="field__label">Símbolo (opcional) ${info("simbolo")}</span>
        <input type="text" name="simbolo" value="${inv?.simbolo ?? ""}" placeholder="AAPL / bitcoin" />
      </label>
      <label class="field">
        <span class="field__label">Participaciones</span>
        <input type="number" step="0.000001" min="0" name="unidades" required value="${inv?.unidades ?? ""}" placeholder="2.5" />
      </label>
      <label class="field">
        <span class="field__label">Precio de compra (€/ud)</span>
        <input type="number" step="0.0001" min="0" name="precio_compra" required value="${inv?.precio_compra ?? ""}" placeholder="112.40" />
      </label>
      <label class="field">
        <span class="field__label">Precio actual (€/ud)</span>
        <input type="number" step="0.0001" min="0" name="precio_actual" value="${inv?.precio_actual ?? ""}" placeholder="Vacío = el de compra" />
      </label>
      <label class="field" id="inv-divisa-campo">
        <span class="field__label">El símbolo cotiza en…</span>
        <select name="divisa">
          <option value="USD" ${(inv?.divisa ?? "USD") === "USD" ? "selected" : ""}>Dólares (EE. UU.)</option>
          <option value="EUR" ${inv?.divisa === "EUR" ? "selected" : ""}>Euros</option>
        </select>
      </label>
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
        root.querySelector("#inv-conocido")?.addEventListener("change", (e) => {
          const c = CONOCIDOS[Number(e.target.value)];
          if (!c) return;
          const f = root.querySelector("#form-inversion");
          f.nombre.value = c.nombre;
          f.tipo.value = c.tipo;
          f.simbolo.value = c.simbolo;
          f.divisa.value = c.divisa;
        });
        root.querySelectorAll("[data-info]").forEach((b) => b.addEventListener("click", () => abrirInfo(b.dataset.info)));
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
            // Si lo añadido es de la pestaña que no está a la vista, se
            // cambia: si no, parece que no se guardó.
            tabActiva = data.tipo === "cripto" ? "cripto" : "valores";
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
