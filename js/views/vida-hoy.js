// vida:inicio
// Hoy: la pantalla con la que abre la app. Los 4 innegociables, los 4
// bonus, los puntos del día y el botón de cerrar. Debajo, qué toca hoy.
//
// El checklist se apunta en un borrador local y solo se escribe en
// Firestore al pulsar "Cerrar el día": así marcar casillas es instantáneo
// y no dispara un render por cada toque.

import {
  vida,
  INNEGOCIABLES,
  BONUS,
  SEMANA_TIPO,
  puntosDeDia,
  esCumplido,
  diaPorFecha,
  etiquetaSueno,
  calcularRacha,
  guardarDia,
  sugerenciaDelDia,
  ROTACION_COMIDAS,
  ROTACION_CENAS,
  FASES_ESTUDIO,
  faseEstudio,
} from "../vida.js?v=59";
import { fechaISO, formatFecha } from "../db.js?v=59";
import { efectoDeCelebracion } from "../efectos.js?v=59";

let currentState = null;
// La fecha que se está editando: hoy, o ayer si quedó sin cerrar.
let fechaEditando = null;
// Borradores por fecha: lo marcado que aún no se ha guardado.
const borradores = new Map();

function ayerISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fechaISO(d);
}

function borradorDe(fechaId) {
  if (!borradores.has(fechaId)) {
    const guardado = diaPorFecha(fechaId);
    const entrenoHecho = vida.entrenos.some((e) => e.fecha === fechaId);
    borradores.set(fechaId, {
      innegociables: { ...(guardado?.innegociables || {}), ...(guardado ? {} : entrenoHecho ? { entreno: true } : {}) },
      bonus: { ...(guardado?.bonus || {}) },
      peso_kg: guardado?.peso_kg ?? "",
      cadera: guardado?.cadera ?? "",
    });
  }
  return borradores.get(fechaId);
}

export function mountVidaHoy() {
  // Todo el enganche va por delegación sobre la sección, porque el
  // contenido se repinta entero con cada render.
  const root = document.getElementById("view-hoy");
  // Lo tecleado va al borrador al momento: si llega un dato de Firestore y
  // la pantalla se repinta a mitad de escribir, no se pierde nada.
  root.addEventListener("input", (e) => {
    const b = borradorDe(fechaEditando ?? fechaISO());
    if (e.target.id === "hoy-peso") b.peso_kg = e.target.value;
    if (e.target.id === "hoy-cadera") b.cadera = e.target.value;
  });
  root.addEventListener("click", async (e) => {
    const toggle = e.target.closest("[data-check]");
    if (toggle) {
      const [grupo, id] = toggle.dataset.check.split(":");
      const b = borradorDe(fechaEditando);
      b[grupo][id] = !b[grupo][id];
      renderVidaHoy(currentState);
      return;
    }
    if (e.target.closest("#btn-editar-ayer")) {
      fechaEditando = ayerISO();
      renderVidaHoy(currentState);
      return;
    }
    if (e.target.closest("#btn-volver-hoy")) {
      fechaEditando = fechaISO();
      renderVidaHoy(currentState);
      return;
    }
    if (e.target.closest("#btn-corregir-dia")) {
      borradores.delete(fechaEditando);
      const b = borradorDe(fechaEditando);
      b.editando = true;
      renderVidaHoy(currentState);
      return;
    }
    if (e.target.closest("#btn-cerrar-dia")) {
      const b = borradorDe(fechaEditando);
      const peso = document.getElementById("hoy-peso")?.value ?? "";
      const cadera = document.getElementById("hoy-cadera")?.value ?? "";
      const cumplido = esCumplido(b.innegociables);
      try {
        await guardarDia(fechaEditando, {
          fecha: fechaEditando,
          innegociables: { ...b.innegociables },
          bonus: { ...b.bonus },
          puntos: puntosDeDia(b.innegociables, b.bonus),
          cumplido,
          peso_kg: peso !== "" ? Number(peso) : null,
          cadera: cadera !== "" ? Number(cadera) : null,
          cerrado: true,
        });
        borradores.delete(fechaEditando);
        if (fechaEditando !== fechaISO()) fechaEditando = fechaISO();
        if (cumplido) efectoDeCelebracion();
      } catch (err) {
        const aviso = document.getElementById("hoy-error");
        if (aviso) aviso.textContent = "No se pudo guardar. ¿Están publicadas las reglas nuevas de Firebase?";
      }
      return;
    }
  });
}

export function renderVidaHoy(state) {
  currentState = state;
  if (!fechaEditando) fechaEditando = fechaISO();
  const el = document.getElementById("hoy-content");
  if (!el) return;

  const hoyId = fechaISO();
  const editandoAyer = fechaEditando !== hoyId;
  const fecha = new Date(fechaEditando + "T12:00:00");
  const guardado = diaPorFecha(fechaEditando);
  const b = borradorDe(fechaEditando);
  const cerradoSinEditar = Boolean(guardado?.cerrado) && !b.editando;
  const puntos = puntosDeDia(b.innegociables, b.bonus);
  const { actual: racha } = calcularRacha();
  const entrenoDelDia = SEMANA_TIPO[fecha.getDay()];
  const entrenoRegistrado = vida.entrenos.some((e) => e.fecha === fechaEditando);
  const fase = faseEstudio();
  // Solo avisa de que ayer quedó sin cerrar si el sistema ya estaba en uso
  // ANTES de ayer: el primer día de todos no hay ningún ayer que cerrar.
  const ayerAbierto = !diaPorFecha(ayerISO()) && vida.dias.some((d) => d.id < ayerISO()) && !editandoAyer;

  const tituloFecha = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(fecha);

  const filaCheck = (grupo, item, marcado, extra = "") => `
    <button type="button" class="hoy-check ${marcado ? "hoy-check--on" : ""} ${grupo === "bonus" ? "hoy-check--bonus" : ""}" data-check="${grupo}:${item.id}" ${cerradoSinEditar ? "disabled" : ""}>
      <span class="hoy-check__icon"><i class="ph ph-${item.icono}" aria-hidden="true"></i></span>
      <span class="hoy-check__nombre">${item.nombre}${extra}</span>
      <span class="hoy-check__marca"><i class="ph-bold ph-check" aria-hidden="true"></i></span>
    </button>`;

  el.innerHTML = `
    ${
      vida.sinPermisos
        ? `<div class="card hoy-aviso">
      <h2 class="card__title">Falta un paso en Firebase</h2>
      <p class="entity-card__meta">
        Este apartado guarda en tres colecciones nuevas y tus reglas de
        Firestore aún no las permiten. Entra en <strong>Firebase Console →
        Firestore Database → Reglas</strong>, pega el archivo
        <code>firestore.rules</code> actualizado y pulsa <strong>Publicar</strong>.
        Hasta entonces, lo que marques aquí no se puede guardar.
      </p>
    </div>`
        : ""
    }
    ${
      ayerAbierto
        ? `<div class="card hoy-aviso"><p class="entity-card__meta" style="margin:0;">
        Ayer quedó sin cerrar. <button type="button" class="btn btn--ghost btn--sm" id="btn-editar-ayer">Cerrar ayer</button>
      </p></div>`
        : ""
    }

    <div class="hoy-cabecera">
      <div>
        <p class="hoy-cabecera__fecha">${editandoAyer ? "Cerrando AYER · " : ""}${tituloFecha.charAt(0).toUpperCase() + tituloFecha.slice(1)}</p>
        <p class="hoy-cabecera__racha"><i class="ph-fill ph-flame" aria-hidden="true"></i> Racha: <strong>${racha}</strong> ${racha === 1 ? "día" : "días"}</p>
      </div>
      <div class="hoy-puntos ${puntos >= 100 ? "hoy-puntos--pleno" : ""}">
        <span class="hoy-puntos__num">${puntos}</span>
        <span class="hoy-puntos__max">/ 120</span>
      </div>
    </div>
    ${editandoAyer ? `<button type="button" class="btn btn--ghost btn--sm" id="btn-volver-hoy" style="margin-bottom:12px;">← Volver a hoy</button>` : ""}

    <div class="grid grid--hoy">
      <article class="card">
        <h2 class="card__title">Los 4 innegociables</h2>
        <p class="entity-card__meta" style="margin-top:-8px;">Los cuatro = día cumplido. No hay medias tintas.</p>
        <div class="hoy-lista">
          ${INNEGOCIABLES.map((i) => {
            let extra = "";
            let item = i;
            if (i.id === "sueno") item = { ...i, nombre: etiquetaSueno(fecha) };
            if (i.id === "estudio") extra = ` <span class="hoy-check__detalle">· ${FASES_ESTUDIO[fase]} min (fase ${fase})</span>`;
            if (i.id === "entreno" && entrenoRegistrado) extra = ` <span class="hoy-check__detalle">· registrado ✓</span>`;
            return filaCheck("innegociables", item, Boolean(b.innegociables[i.id]), extra);
          }).join("")}
        </div>
        <h2 class="card__title" style="margin-top:18px;">Bonus</h2>
        <div class="hoy-lista">
          ${BONUS.map((i) => filaCheck("bonus", i, Boolean(b.bonus[i.id]))).join("")}
        </div>

        <details class="hoy-extra" ${b.peso_kg !== "" || b.cadera !== "" ? "open" : ""}>
          <summary>Apuntes del día (opcional)</summary>
          <div class="form-grid" style="margin-top:10px;">
            <label class="field">
              <span class="field__label">Peso (kg) — 1 vez por semana basta</span>
              <input type="number" step="0.1" id="hoy-peso" value="${b.peso_kg}" placeholder="—" ${cerradoSinEditar ? "disabled" : ""} />
            </label>
            <label class="field">
              <span class="field__label">Ingle al acabar el día (0–10)</span>
              <input type="number" min="0" max="10" id="hoy-cadera" value="${b.cadera}" placeholder="0" ${cerradoSinEditar ? "disabled" : ""} />
            </label>
          </div>
        </details>

        <p class="field-error" id="hoy-error"></p>
        ${
          cerradoSinEditar
            ? `<div class="hoy-cerrado">
                <p>${guardado.cumplido ? "✓ Día cumplido · " : "Día cerrado · "}${guardado.puntos} puntos</p>
                <button type="button" class="btn btn--ghost btn--sm" id="btn-corregir-dia">Corregir</button>
              </div>`
            : `<button type="button" class="btn btn--primary btn--block hoy-cerrar" id="btn-cerrar-dia">
                ${guardado?.cerrado ? "Guardar cambios" : "Cerrar el día"}
              </button>`
        }
      </article>

      <article class="card">
        <h2 class="card__title">Qué toca hoy</h2>
        <div class="hoy-toca">
          <a class="hoy-toca__fila" href="#/entreno">
            <span class="hoy-check__icon"><i class="ph ph-barbell" aria-hidden="true"></i></span>
            <span><strong>${entrenoDelDia.nombre}</strong><br /><span class="entity-card__meta">Tocar para registrarlo</span></span>
          </a>
          <div class="hoy-toca__fila">
            <span class="hoy-check__icon"><i class="ph ph-cooking-pot" aria-hidden="true"></i></span>
            <span><strong>Comida:</strong> ${sugerenciaDelDia(ROTACION_COMIDAS, fecha)}<br />
            <strong>Cena:</strong> ${sugerenciaDelDia(ROTACION_CENAS, fecha)} <span class="entity-card__meta">(déjala hecha por la mañana)</span></span>
          </div>
          <div class="hoy-toca__fila">
            <span class="hoy-check__icon"><i class="ph ph-orange-slice" aria-hidden="true"></i></span>
            <span><strong>Fruta:</strong> 11:00 · postre de la comida · camino al gym · postre de la cena</span>
          </div>
          <div class="hoy-toca__fila">
            <span class="hoy-check__icon"><i class="ph ph-graduation-cap" aria-hidden="true"></i></span>
            <span><strong>Estudio:</strong> ${FASES_ESTUDIO[fase]} min después de comer (15:40)</span>
          </div>
        </div>
        <a class="btn btn--ghost btn--sm btn--block" href="#/progreso" style="margin-top:14px;">Ver mi progreso y el bote →</a>
      </article>
    </div>
  `;
}
// vida:fin
