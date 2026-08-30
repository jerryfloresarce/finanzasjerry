// vida:inicio
// Menú semanal DE CASA: uno solo para los dos, porque desayunan, comen y
// cenan lo mismo — así nadie cocina dos veces. Se marcan los ingredientes
// que gustan a ambos, el menú se genera priorizando platos rápidos
// (AirFryer, horno o pocos pasos), y cada día se puede editar a mano:
// cambiar un plato, poner "En casa de mamá" el domingo, o un plato vuestro.

import {
  vida,
  INGREDIENTES,
  GRUPOS_INGREDIENTES,
  INGREDIENTES_POR_DEFECTO,
  RECETAS,
  PLATOS_ESPECIALES,
  platosPropios,
  recetaPorId,
  recetasDisponibles,
  generarMenuSemana,
  guardarMenu,
  lunesDe,
} from "../vida.js?v=88";
import { openModal, closeModal, esc } from "../modal.js?v=88";
import { efectoAlGuardar } from "../efectos.js?v=88";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MOMENTOS = [
  { campo: "desayunos", momento: "desayuno", nombre: "Desayuno" },
  { campo: "comidas", momento: "comida", nombre: "Comida" },
  { campo: "cenas", momento: "cena", nombre: "Cena" },
];

function marcados() {
  return vida.menu?.ingredientes ?? INGREDIENTES_POR_DEFECTO;
}

// La guía rápida de un plato. Exportada: la pantalla Hoy también la abre al
// tocar la comida o la cena del día.
export function abrirReceta(recetaId) {
  const r = recetaPorId(recetaId);
  if (!r) return;
  const cabecera = r.especial
    ? "Día sin cocinar"
    : `${r.momento === "desayuno" ? "Desayuno" : r.momento === "cena" ? "Cena" : "Comida"}${
        r.proteina ? ` · ≈ ${r.proteina} g de proteína por ración` : ""
      }${r.propio ? " · plato vuestro" : ""}`;
  openModal(
    `
    <h2 class="modal__title">${esc(r.nombre)}</h2>
    <p class="entity-card__meta" style="margin:-10px 0 12px;">
      ${cabecera}
      ${r.aire ? ' · <span class="chip-aire">AirFryer</span>' : ""}
    </p>
    <ol class="receta-pasos">
      ${(r.pasos || []).map((p) => `<li>${p}</li>`).join("")}
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

// ---------- Editar un día del menú ----------

// Las opciones de un momento del día: los especiales (casa de mamá, fuera),
// los platos vuestros de ese momento y todas las recetas de ese momento —
// primero las que salen con lo marcado, luego el resto por si apetece igual.
function opcionesDe(momento, elegido) {
  const disponibles = new Set(recetasDisponibles(marcados()).map((r) => r.id));
  const propias = platosPropios().filter((r) => r.momento === momento);
  const recetas = RECETAS.filter((r) => r.momento === momento);
  const opcion = (r) => `<option value="${r.id}" ${r.id === elegido ? "selected" : ""}>${esc(r.nombre)}${r.aire ? " (AirFryer)" : ""}</option>`;
  return `
    <option value="" ${!elegido ? "selected" : ""}>— Nada apuntado</option>
    <optgroup label="Días sin cocinar">${PLATOS_ESPECIALES.map(opcion).join("")}</optgroup>
    ${propias.length ? `<optgroup label="Platos vuestros">${propias.map(opcion).join("")}</optgroup>` : ""}
    <optgroup label="Con lo que tenéis marcado">${recetas.filter((r) => disponibles.has(r.id)).map(opcion).join("")}</optgroup>
    <optgroup label="El resto de recetas">${recetas.filter((r) => !disponibles.has(r.id)).map(opcion).join("")}</optgroup>`;
}

function abrirEditorDia(d) {
  const menu = vida.menu?.lunes === lunesDe(new Date()) ? vida.menu : { desayunos: {}, comidas: {}, cenas: {} };
  openModal(
    `
    <h2 class="modal__title">${DIAS[d - 1]}: ¿qué coméis?</h2>
    <p class="entity-card__meta" style="margin:-8px 0 12px;">
      Cambia lo que os apetezca: otro plato, uno vuestro, o un día sin
      cocinar (como los domingos en casa de mamá).
    </p>
    <form id="form-dia-menu" class="form-grid">
      ${MOMENTOS.map(
        (m) => `
        <label class="field field--full">
          <span class="field__label">${m.nombre}</span>
          <select name="${m.campo}">${opcionesDe(m.momento, menu[m.campo]?.[d])}</select>
        </label>`
      ).join("")}
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancelar-dia">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar el día</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancelar-dia").addEventListener("click", closeModal);
        root.querySelector("#form-dia-menu").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          // Se guardan los tres mapas ENTEROS (no solo el día tocado):
          // así funciona igual se mire como se mire el merge de Firestore.
          const datos = { lunes: lunesDe(new Date()) };
          for (const m of MOMENTOS) {
            const mapa = { ...(menu[m.campo] || {}) };
            const valor = f.get(m.campo);
            if (valor) mapa[d] = valor;
            else delete mapa[d];
            datos[m.campo] = mapa;
          }
          await guardarMenu(datos).catch(() => {});
          closeModal();
          efectoAlGuardar();
        });
      },
    }
  );
}

// ---------- Platos vuestros ----------

function abrirEditorPlato(plato) {
  const esNuevo = !plato;
  openModal(
    `
    <h2 class="modal__title">${esNuevo ? "Un plato vuestro" : `Editar «${esc(plato.nombre)}»`}</h2>
    <p class="entity-card__meta" style="margin:-8px 0 12px;">
      Lo que os gusta y no está en la lista: se guarda para los dos y entra
      en el menú como cualquier receta.
    </p>
    <form id="form-plato" class="form-grid">
      <label class="field">
        <span class="field__label">¿Cómo se llama?</span>
        <input type="text" name="nombre" required maxlength="60" value="${esc(plato?.nombre || "")}" placeholder="Nuggets caseros" />
      </label>
      <label class="field">
        <span class="field__label">¿Cuándo?</span>
        <select name="momento">
          <option value="desayuno" ${plato?.momento === "desayuno" ? "selected" : ""}>Desayuno</option>
          <option value="comida" ${!plato || plato.momento === "comida" ? "selected" : ""}>Comida</option>
          <option value="cena" ${plato?.momento === "cena" ? "selected" : ""}>Cena</option>
        </select>
      </label>
      <label class="field field--full">
        <span class="field__label">¿Cómo se hace? (opcional, una línea por paso)</span>
        <textarea name="pasos" rows="3" placeholder="Al AirFryer 12 min a 200 °C&#10;Salsa al gusto">${esc((plato?.pasos || []).join("\n"))}</textarea>
      </label>
      <label class="field-check field--full">
        <input type="checkbox" name="aire" ${plato?.aire ? "checked" : ""} />
        <span>Se hace en la AirFryer o el horno</span>
      </label>
      <div class="modal__actions field--full">
        ${esNuevo ? "" : '<button type="button" class="btn btn--ghost" id="btn-borrar-plato">Borrar</button>'}
        <button type="button" class="btn btn--ghost" id="btn-cancelar-plato">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancelar-plato").addEventListener("click", closeModal);
        root.querySelector("#btn-borrar-plato")?.addEventListener("click", async () => {
          const lista = (vida.menu?.platos || []).filter((p) => p.id !== plato.id);
          await guardarMenu({ platos: lista }).catch(() => {});
          closeModal();
        });
        root.querySelector("#form-plato").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          const nombre = String(f.get("nombre") || "").trim();
          if (!nombre) return;
          const nuevo = {
            id: plato?.id || "p_" + Date.now().toString(36),
            nombre,
            momento: String(f.get("momento")),
            pasos: String(f.get("pasos") || "")
              .split("\n")
              .map((p) => p.trim())
              .filter(Boolean),
            aire: f.get("aire") === "on",
          };
          const lista = [...(vida.menu?.platos || [])];
          const idx = lista.findIndex((p) => p.id === nuevo.id);
          if (idx >= 0) lista[idx] = nuevo;
          else lista.push(nuevo);
          await guardarMenu({ platos: lista }).catch(() => {});
          closeModal();
          efectoAlGuardar();
        });
      },
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
    if (e.target.closest("#btn-nuevo-plato")) {
      abrirEditorPlato(null);
      return;
    }
    const platoPropio = e.target.closest("[data-editar-plato]");
    if (platoPropio) {
      abrirEditorPlato((vida.menu?.platos || []).find((p) => p.id === platoPropio.dataset.editarPlato));
      return;
    }
    const dia = e.target.closest("[data-editar-dia]");
    if (dia) {
      abrirEditorDia(Number(dia.dataset.editarDia));
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
  const propios = platosPropios();

  el.innerHTML = `
    <div class="grid grid--hoy">
      <article class="card">
        <h2 class="card__title">¿Qué coméis en casa esta semana?</h2>
        <p class="entity-card__meta" style="margin-top:-8px;">
          El menú es <strong>de casa</strong>: el mismo para los dos, se
          mire desde la app que se mire — nadie cocina dos veces. Marcad
          juntos lo que os apetezca: con lo marcado salen ahora
          <strong>${nDesayunos} desayunos, ${nComidas} comidas y ${nCenas} cenas</strong> posibles.
        </p>
        ${GRUPOS_INGREDIENTES.map(
          (grupo) => `
          <p class="progreso-grupo">${grupo}</p>
          <div class="ingredientes-grid">
            ${INGREDIENTES.filter((i) => i.grupo === grupo)
              .map(
                (i) => `
              <button type="button" class="chip ${lista.has(i.id) ? "chip--on" : ""}" data-ingrediente="${i.id}">${esc(i.nombre)}</button>`
              )
              .join("")}
          </div>`
        ).join("")}
        <p class="progreso-grupo">Platos vuestros</p>
        <div class="ingredientes-grid">
          ${propios
            .map((p) => `<button type="button" class="chip chip--on" data-editar-plato="${p.id}">${esc(p.nombre)}${p.aire ? " ♨️" : ""}</button>`)
            .join("")}
          <button type="button" class="chip chip--nueva" id="btn-nuevo-plato">＋ Plato vuestro</button>
        </div>
        <p class="field-error" id="menu-aviso"></p>
        <button type="button" class="btn btn--primary btn--block hoy-cerrar" id="btn-generar-menu">
          ${menuVigente ? "Rehacer el menú de esta semana" : "Hacer el menú de esta semana"}
        </button>
      </article>

      <article class="card">
        <h2 class="card__title">El menú de la semana</h2>
        ${
          !menuVigente
            ? `<p class="empty-state">Todavía no hay menú para esta semana. Marcad los ingredientes y dadle al botón: saldrá priorizando lo rápido (AirFryer, horno o pocos pasos), y luego cada día se puede retocar con el lápiz.</p>`
            : `<div class="mini-list">
            ${DIAS.map((nombre, idx) => {
              const d = idx + 1;
              const desayuno = recetaPorId(menuVigente.desayunos?.[d]);
              const comida = recetaPorId(menuVigente.comidas?.[d]);
              const cena = recetaPorId(menuVigente.cenas?.[d]);
              const esHoy = ((new Date().getDay() + 6) % 7) + 1 === d;
              const plato = (r, icono) =>
                r
                  ? `<button type="button" class="menu-dia__plato" data-receta="${r.id}"><i class="ph ${icono}" aria-hidden="true"></i> ${esc(r.nombre)}${
                      r.especial ? " 🏠" : r.aire ? " ♨️" : ""
                    }</button>`
                  : "";
              return `
              <div class="menu-dia ${esHoy ? "menu-dia--hoy" : ""}">
                <p class="menu-dia__nombre">${nombre}${esHoy ? " · hoy" : ""}
                  <button type="button" class="menu-dia__editar" data-editar-dia="${d}" title="Cambiar los platos de este día">✎</button>
                </p>
                ${plato(desayuno, "ph-sun")}
                ${plato(comida, "ph-fork-knife")}
                ${plato(cena, "ph-moon-stars")}
              </div>`;
            }).join("")}
          </div>
          <p class="entity-card__meta" style="margin-top:10px;">
            Toca un plato y sale la guía rápida; con el ✎ cambias cualquier
            día (otro plato, uno vuestro, o "En casa de mamá" el domingo).
            Las comidas se dejan hechas el domingo y las cenas por la mañana.
          </p>`
        }
      </article>
    </div>
  `;
}
// vida:fin
