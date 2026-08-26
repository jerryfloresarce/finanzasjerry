// vida:inicio
// Menú semanal: Jerry marca qué ingredientes comería esta semana y el menú
// se genera solo con recetas que se pueden hacer con eso. Cada plato lleva
// su guía rápida de cocina. Sin garbanzos ni atún de serie, y la verdura
// solo camuflada — las peleas con la comida no se ganan por obligación.

import {
  vida,
  INGREDIENTES,
  GRUPOS_INGREDIENTES,
  INGREDIENTES_POR_DEFECTO,
  RECETAS,
  recetaPorId,
  recetasDisponibles,
  generarMenuSemana,
  guardarMenu,
  lunesDe,
} from "../vida.js?v=67";
import { openModal, closeModal } from "../modal.js?v=67";
import { efectoAlGuardar } from "../efectos.js?v=67";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function marcados() {
  return vida.menu?.ingredientes ?? INGREDIENTES_POR_DEFECTO;
}

// La guía rápida de un plato. Exportada: la pantalla Hoy también la abre al
// tocar la comida o la cena del día.
export function abrirReceta(recetaId) {
  const r = recetaPorId(recetaId);
  if (!r) return;
  openModal(
    `
    <h2 class="modal__title">${r.nombre}</h2>
    <p class="entity-card__meta" style="margin:-10px 0 12px;">
      ${r.momento === "desayuno" ? "Desayuno" : r.momento === "comida" ? "Comida" : "Cena"} · ≈ ${r.proteina} g de proteína por ración
      ${r.aire ? ' · <span class="chip-aire">AirFryer</span>' : ""}
    </p>
    <ol class="receta-pasos">
      ${r.pasos.map((p) => `<li>${p}</li>`).join("")}
    </ol>
    <div class="modal__actions">
      <button type="button" class="btn btn--primary" id="btn-cerrar-receta">Listo</button>
    </div>
  `,
    {
      onMount: (root) => root.querySelector("#btn-cerrar-receta").addEventListener("click", closeModal),
    }
  );
}

export function mountVidaMenu() {
  const root = document.getElementById("view-menu");
  root.addEventListener("click", async (e) => {
    const ing = e.target.closest("[data-ingrediente]");
    if (ing) {
      const id = ing.dataset.ingrediente;
      const lista = new Set(marcados());
      if (lista.has(id)) lista.delete(id);
      else lista.add(id);
      await guardarMenu({ ingredientes: [...lista] }).catch(() => {});
      return;
    }
    if (e.target.closest("#btn-generar-menu")) {
      const lunes = lunesDe(new Date());
      const menu = generarMenuSemana(lunes, marcados());
      const aviso = document.getElementById("menu-aviso");
      if (!menu) {
        if (aviso) aviso.textContent = "Con tan pocos ingredientes marcados no salen platos suficientes. Marca al menos una proteína, un hidrato y huevos.";
        return;
      }
      await guardarMenu(menu).catch(() => {
        if (aviso) aviso.textContent = "No se pudo guardar el menú. Inténtalo de nuevo.";
      });
      efectoAlGuardar();
      return;
    }
    const receta = e.target.closest("[data-receta]");
    if (receta) {
      abrirReceta(receta.dataset.receta);
      return;
    }
  });
}

export function renderVidaMenu(_state) {
  const el = document.getElementById("menu-content");
  if (!el) return;

  const lista = new Set(marcados());
  const disponibles = recetasDisponibles([...lista]);
  const nDesayunos = disponibles.filter((r) => r.momento === "desayuno").length;
  const nComidas = disponibles.filter((r) => r.momento === "comida").length;
  const nCenas = disponibles.filter((r) => r.momento === "cena").length;
  const lunesActual = lunesDe(new Date());
  const menuVigente = vida.menu?.lunes === lunesActual ? vida.menu : null;

  el.innerHTML = `
    <div class="grid grid--hoy">
      <article class="card">
        <h2 class="card__title">¿Qué comerías esta semana?</h2>
        <p class="entity-card__meta" style="margin-top:-8px;">
          Marca y desmarca lo que te apetezca. Con lo marcado salen ahora
          <strong>${nDesayunos} desayunos, ${nComidas} comidas y ${nCenas} cenas</strong> posibles.
        </p>
        ${GRUPOS_INGREDIENTES.map(
          (grupo) => `
          <p class="progreso-grupo">${grupo}</p>
          <div class="ingredientes-grid">
            ${INGREDIENTES.filter((i) => i.grupo === grupo)
              .map(
                (i) => `
              <button type="button" class="chip ${lista.has(i.id) ? "chip--on" : ""}" data-ingrediente="${i.id}">${i.nombre}</button>`
              )
              .join("")}
          </div>`
        ).join("")}
        <p class="field-error" id="menu-aviso"></p>
        <button type="button" class="btn btn--primary btn--block hoy-cerrar" id="btn-generar-menu">
          ${menuVigente ? "Rehacer el menú de esta semana" : "Hacer el menú de esta semana"}
        </button>
      </article>

      <article class="card">
        <h2 class="card__title">El menú de la semana</h2>
        ${
          !menuVigente
            ? `<p class="empty-state">Todavía no hay menú para esta semana. Marca los ingredientes y dale al botón: cada plato saldrá con su guía rápida de cocina.</p>`
            : `<div class="mini-list">
            ${DIAS.map((nombre, idx) => {
              const d = idx + 1;
              const desayuno = recetaPorId(menuVigente.desayunos?.[d]);
              const comida = recetaPorId(menuVigente.comidas?.[d]);
              const cena = recetaPorId(menuVigente.cenas?.[d]);
              const esHoy = ((new Date().getDay() + 6) % 7) + 1 === d;
              return `
              <div class="menu-dia ${esHoy ? "menu-dia--hoy" : ""}">
                <p class="menu-dia__nombre">${nombre}${esHoy ? " · hoy" : ""}</p>
                ${desayuno ? `<button type="button" class="menu-dia__plato" data-receta="${desayuno.id}"><i class="ph ph-sun" aria-hidden="true"></i> ${desayuno.nombre}</button>` : ""}
                ${comida ? `<button type="button" class="menu-dia__plato" data-receta="${comida.id}"><i class="ph ph-fork-knife" aria-hidden="true"></i> ${comida.nombre}</button>` : ""}
                ${cena ? `<button type="button" class="menu-dia__plato" data-receta="${cena.id}"><i class="ph ph-moon-stars" aria-hidden="true"></i> ${cena.nombre}</button>` : ""}
              </div>`;
            }).join("")}
          </div>
          <p class="entity-card__meta" style="margin-top:10px;">
            Toca un plato y sale la guía rápida. Las comidas se dejan hechas
            el domingo (batch cooking) y las cenas por la mañana.
          </p>`
        }
      </article>
    </div>
  `;
}
// vida:fin
