// Metas de ahorro: huchas con nombre y objetivo — un viaje, una reparación
// de casa, un capricho grande. Cada aportación se apunta a mano: es dinero
// que ya tienes en tus cuentas, solo que apartado mentalmente para algo.
// Por eso una aportación NO toca el saldo de ninguna cuenta: no es un
// gasto, es una etiqueta encima de dinero que sigue siendo tuyo.

import { addMetaAhorro, updateMetaAhorro, deleteMetaAhorro, formatEUR, formatFecha, fechaISO } from "../db.js?v=66";
import { openModal, closeModal, todayISO } from "../modal.js?v=66";
import { icon } from "../icons.js?v=66";
import { emojiFieldHTML, attachEmojiPicker } from "../emoji-picker.js?v=66";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=66";
import { efectoDeCelebracion } from "../efectos.js?v=66";

const META_EMOJIS = ["✈️", "🏠", "🔧", "🚗", "🏍️", "💻", "🎁", "💍", "🎓", "🛋️", "📱", "🐷"];

let currentState = null;

const ahorradoDe = (m) => (m.aportaciones || []).reduce((acc, a) => acc + Number(a.importe ?? 0), 0);

export function mountMetas() {
  document.getElementById("btn-add-meta").addEventListener("click", () => openForm(null));
}

export function renderMetas(state) {
  currentState = state;
  const el = document.getElementById("metas-grid");
  const { metasAhorro } = state;

  if (metasAhorro.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no tienes ninguna meta. Un viaje, una reparación de casa, un capricho grande… ponle nombre y una cantidad, y ve apartando.</p>`;
    return;
  }

  const ordenadas = [...metasAhorro].sort((a, b) => {
    const compA = ahorradoDe(a) >= Number(a.objetivo ?? 0);
    const compB = ahorradoDe(b) >= Number(b.objetivo ?? 0);
    return compA - compB || (a.nombre || "").localeCompare(b.nombre || "");
  });

  el.innerHTML = ordenadas
    .map((m) => {
      const objetivo = Number(m.objetivo ?? 0);
      const ahorrado = ahorradoDe(m);
      const pct = objetivo > 0 ? Math.min(100, Math.round((ahorrado / objetivo) * 100)) : 0;
      const completada = objetivo > 0 && ahorrado >= objetivo;
      const restante = Math.max(0, objetivo - ahorrado);

      // Si tiene fecha objetivo, se traduce a un ritmo mensual: "aparta
      // tanto al mes y llegas". Es más accionable que un porcentaje.
      let ritmo = "";
      if (!completada && m.fecha_objetivo) {
        const hoy = new Date();
        const fin = new Date(m.fecha_objetivo + "T12:00:00");
        const meses = Math.max(1, (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth()));
        ritmo = ` · ${formatEUR(restante / meses)}/mes hasta ${formatFecha(fin)}`;
      }

      return wrapSwipe(
        `
        <article class="entity-card ${completada ? "meta--completada" : ""}">
          <div class="entity-card__top">
            <div class="entity-card__heading">
              <span class="icon-badge">${m.icono || "🐷"}</span>
              <p class="entity-card__name">${m.nombre}</p>
            </div>
            <div class="entity-card__top-actions">
              ${completada ? `<span class="entity-card__tag entity-card__tag--activo">¡Conseguida!</span>` : ""}
              <button type="button" class="row-edit-btn" data-edit="${m.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>
          </div>
          <p class="entity-card__amount">${formatEUR(ahorrado)} <span style="font-size:0.9rem;color:var(--text-muted);font-family:var(--font-body)">de ${formatEUR(objetivo)}</span></p>
          <div class="progress-track"><div class="progress-fill ${completada ? "" : ""}" style="width:${pct}%"></div></div>
          <p class="entity-card__meta" style="margin-top:6px;">${completada ? "Objetivo cumplido 🎉" : `Te faltan ${formatEUR(restante)}${ritmo}`}</p>
          <div class="entity-card__actions">
            <button class="btn btn--primary btn--sm" data-aportar="${m.id}">+ Añadir dinero</button>
            <button class="btn btn--ghost btn--sm" data-historial-meta="${m.id}">Historial</button>
          </div>
        </article>`,
        m.id
      );
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(state.metasAhorro.find((m) => m.id === btn.dataset.edit)))
  );
  el.querySelectorAll("[data-aportar]").forEach((btn) =>
    btn.addEventListener("click", () => openAportar(state.metasAhorro.find((m) => m.id === btn.dataset.aportar)))
  );
  el.querySelectorAll("[data-historial-meta]").forEach((btn) =>
    btn.addEventListener("click", () => openHistorialMeta(state.metasAhorro.find((m) => m.id === btn.dataset.historialMeta)))
  );
  attachSwipe(el, (id) => deleteMetaAhorro(id), {
    confirmar: "¿Eliminar esta meta? El dinero sigue en tus cuentas — solo se borra la hucha.",
  });
}

function openForm(meta) {
  const isEdit = Boolean(meta);
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar meta" : "Nueva meta"}</h2>
    <form id="form-meta" class="form-grid">
      <label class="field field--full">
        <span class="field__label">¿Para qué ahorras?</span>
        <input type="text" name="nombre" required value="${meta?.nombre ?? ""}" placeholder="Viaje a Bolivia, arreglar el baño…" />
      </label>
      <label class="field">
        <span class="field__label">¿Cuánto necesitas?</span>
        <input type="number" step="0.01" min="0" name="objetivo" required value="${meta?.objetivo ?? ""}" placeholder="1500" />
      </label>
      <label class="field">
        <span class="field__label">¿Para cuándo? (opcional)</span>
        <input type="date" name="fecha_objetivo" value="${meta?.fecha_objetivo ?? ""}" />
      </label>
      ${emojiFieldHTML(meta?.icono, META_EMOJIS)}
      <p class="field-error" id="form-meta-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Guardar" : "Crear la meta"}</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        attachEmojiPicker(root);
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-meta").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            nombre: f.nombre.value.trim(),
            objetivo: Number(f.objetivo.value),
            fecha_objetivo: f.fecha_objetivo.value || null,
            icono: f.icono.value.trim() || null,
          };
          try {
            if (isEdit) await updateMetaAhorro(meta.id, data);
            else await addMetaAhorro({ ...data, aportaciones: [], creada: fechaISO() });
            closeModal();
          } catch (err) {
            root.querySelector("#form-meta-error").textContent = "No se pudo guardar. ¿Están publicadas las reglas nuevas de Firebase?";
          }
        });
      },
    }
  );
}

function openAportar(meta) {
  const ahorrado = ahorradoDe(meta);
  const restante = Math.max(0, Number(meta.objetivo ?? 0) - ahorrado);
  openModal(
    `
    <h2 class="modal__title">Añadir dinero a "${meta.nombre}"</h2>
    <p class="entity-card__meta" style="margin:-10px 0 12px;">
      Llevas ${formatEUR(ahorrado)}${restante > 0 ? ` · te faltan ${formatEUR(restante)}` : ""}.
      Esto no toca el saldo de tus cuentas: es dinero tuyo que apartas para esta meta.
    </p>
    <form id="form-aportar" class="form-grid">
      <label class="field">
        <span class="field__label">¿Cuánto apartas?</span>
        <input type="number" step="0.01" min="0" name="importe" required placeholder="50" />
      </label>
      <label class="field">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="nota" placeholder="Del bote de recompensas" />
      </label>
      <p class="field-error" id="form-aportar-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Apartar</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-aportar").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const importe = Number(f.importe.value);
          if (!importe) return;
          const aportaciones = [...(meta.aportaciones || []), { fecha: f.fecha.value, importe, nota: f.nota.value.trim() }];
          const antes = ahorradoDe(meta);
          try {
            await updateMetaAhorro(meta.id, { aportaciones });
            closeModal();
            // La celebración solo al CRUZAR el objetivo, no en cada
            // aportación de una meta ya conseguida.
            const objetivo = Number(meta.objetivo ?? 0);
            if (objetivo > 0 && antes < objetivo && antes + importe >= objetivo) efectoDeCelebracion();
          } catch (err) {
            root.querySelector("#form-aportar-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function openHistorialMeta(meta) {
  const aportaciones = [...(meta.aportaciones || [])].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  openModal(
    `
    <h2 class="modal__title">${meta.icono || "🐷"} ${meta.nombre}</h2>
    ${
      aportaciones.length === 0
        ? `<p class="empty-state">Todavía no has apartado nada.</p>`
        : `<div class="mini-list">${aportaciones
            .map(
              (a, i) => `
          <div class="mini-row">
            <div class="mini-row__main" style="flex:1; min-width:0;">
              <span class="mini-row__title">${formatFecha(new Date(a.fecha + "T12:00:00"))}</span>
              ${a.nota ? `<span class="mini-row__sub">${a.nota}</span>` : ""}
            </div>
            <span class="mini-row__amount">${formatEUR(Number(a.importe ?? 0))}</span>
            <button type="button" class="row-edit-btn" data-borrar-aporte="${i}" title="Borrar">${icon("trash", { size: 15 })}</button>
          </div>`
            )
            .join("")}</div>`
    }
    <p class="entity-card__meta">Total: <strong>${formatEUR(ahorradoDe(meta))}</strong> de ${formatEUR(Number(meta.objetivo ?? 0))}</p>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="btn-cerrar-hist-meta">Cerrar</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cerrar-hist-meta").addEventListener("click", closeModal);
        root.querySelectorAll("[data-borrar-aporte]").forEach((btn) =>
          btn.addEventListener("click", async () => {
            if (!confirm("¿Borrar esta aportación?")) return;
            const restantes = aportaciones.filter((_, i) => i !== Number(btn.dataset.borrarAporte));
            await updateMetaAhorro(meta.id, { aportaciones: restantes });
            closeModal();
          })
        );
      },
    }
  );
}
