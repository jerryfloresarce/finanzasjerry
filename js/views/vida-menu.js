// vida:inicio
// Menú semanal DE CASA: uno solo para los dos, porque desayunan, comen y
// cenan lo mismo — así nadie cocina dos veces. Se marcan los ingredientes
// que gustan a ambos, el menú se genera priorizando platos rápidos
// (AirFryer, horno o pocos pasos), y cada día se puede editar a mano:
// cambiar un plato, poner "En casa de mamá" el domingo, o un plato vuestro.

import {
  vida,
  GRUPOS_INGREDIENTES,
  INGREDIENTES_POR_DEFECTO,
  RECETAS,
  PLATOS_ESPECIALES,
  ingredientesPropios,
  todosLosIngredientes,
  ingredientePorId,
  platosPropios,
  recetaPorId,
  recetasDisponibles,
  generarMenuSemana,
  repararMenu,
  guardarMenu,
  lunesDe,
  lunesObjetivo,
  conservarRestoDeSemana,
  pasarMenuALaCompra,
  cambiosDeFecha,
  guardarCambiosDeFecha,
  platoDePlantilla,
} from "../vida.js?v=136";
import { fechaISO } from "../db.js?v=136";
import { openModal, closeModal, esc } from "../modal.js?v=136";
import { efectoAlGuardar } from "../efectos.js?v=136";
import { localeActual } from "../idioma.js?v=136";

// Lo último que dijo el botón de pasar el menú a la compra: se repinta con
// la pantalla (guardar la compra la vuelve a pintar) y se olvida a los pocos
// segundos.
let avisoCompra = "";

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
    ${
      r.propio && r.req.length
        ? `<p class="entity-card__meta" style="margin:0 0 10px;">Lleva: ${r.req.map((i) => esc(ingredientePorId(i)?.nombre || i)).join(", ")}.</p>`
        : ""
    }
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
function opcionesDe(momento, elegido, etiquetaVacia = "— Nada apuntado") {
  const disponibles = new Set(recetasDisponibles(marcados()).map((r) => r.id));
  const propias = platosPropios().filter((r) => r.momento === momento);
  const recetas = RECETAS.filter((r) => r.momento === momento);
  const opcion = (r) => `<option value="${r.id}" ${r.id === elegido ? "selected" : ""}>${esc(r.nombre)}${r.aire ? " (AirFryer)" : ""}</option>`;
  return `
    <option value="" ${!elegido ? "selected" : ""}>${etiquetaVacia}</option>
    <optgroup label="Días sin cocinar">${PLATOS_ESPECIALES.map(opcion).join("")}</optgroup>
    ${propias.length ? `<optgroup label="Platos vuestros">${propias.map(opcion).join("")}</optgroup>` : ""}
    <optgroup label="Con lo que tenéis marcado">${recetas.filter((r) => disponibles.has(r.id)).map(opcion).join("")}</optgroup>
    <optgroup label="El resto de recetas">${recetas.filter((r) => !disponibles.has(r.id)).map(opcion).join("")}</optgroup>`;
}

function abrirEditorDia(d) {
  // El menú guardado, sea de la semana que sea: partir de mapas vacíos
  // cuando cambiaba la semana hacía que guardar un día machacara el menú
  // entero con la nada. El menú vive hasta que se rehace a propósito.
  const menu = vida.menu?.lunes ? vida.menu : { desayunos: {}, comidas: {}, cenas: {} };
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
          const datos = { lunes: menu.lunes || lunesDe(new Date()) };
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

// El editor de UNA fecha concreta: "las hamburguesas mejor mañana, que se
// ponen malas". Cambia solo ese día del calendario — la plantilla semanal
// no se toca y la semana siguiente todo vuelve a su sitio. Exportada: se
// abre desde la pantalla Hoy.
export function abrirCambioFecha(fechaId = fechaISO()) {
  const selectsDe = (fid) => {
    const cambio = cambiosDeFecha(fid) || {};
    return MOMENTOS.map(
      (m) => `
        <label class="field field--full">
          <span class="field__label">${m.nombre}</span>
          <select name="${m.momento}" data-plantilla="${platoDePlantilla(fid, m.campo)}">${opcionesDe(m.momento, cambio[m.momento] || platoDePlantilla(fid, m.campo), "— Nada")}</select>
        </label>`
    ).join("");
  };
  openModal(
    `
    <h2 class="modal__title">Cambiar el menú de un día concreto</h2>
    <p class="entity-card__meta" style="margin:-8px 0 12px;">
      Para los "esto mejor mañana": cambia SOLO esa fecha. La plantilla de
      la semana se queda como está, y la semana que viene manda ella otra vez.
    </p>
    <form id="form-cambio-fecha" class="form-grid">
      <label class="field field--full">
        <span class="field__label">¿Qué día?</span>
        <input type="date" name="fecha" value="${fechaId}" />
      </label>
      <div id="cambio-selects" class="form-grid field--full" style="padding:0;">${selectsDe(fechaId)}</div>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancelar-cambio">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar ese día</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancelar-cambio").addEventListener("click", closeModal);
        const form = root.querySelector("#form-cambio-fecha");
        // Al cambiar la fecha, los tres platos se repintan con lo que toca
        // ESE día (su plantilla + sus cambios ya guardados, si los hay).
        form.fecha.addEventListener("change", () => {
          if (form.fecha.value) root.querySelector("#cambio-selects").innerHTML = selectsDe(form.fecha.value);
        });
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fid = form.fecha.value;
          if (!fid) return;
          // Solo lo que difiere de la plantilla es un cambio de verdad:
          // dejar un plato como estaba no apunta nada.
          const cambio = {};
          for (const m of MOMENTOS) {
            const sel = form.querySelector(`select[name="${m.momento}"]`);
            if (sel.value && sel.value !== sel.dataset.plantilla) cambio[m.momento] = sel.value;
          }
          await guardarCambiosDeFecha(fid, cambio).catch(() => {});
          closeModal();
          efectoAlGuardar();
        });
      },
    }
  );
}

// ---------- Vuestros ingredientes ----------

// Los chips de todos los ingredientes (de serie y vuestros), por grupo,
// para elegir lo que lleva un plato.
function chipsDeIngredientes(seleccion) {
  return GRUPOS_INGREDIENTES.map((grupo) => {
    const del = todosLosIngredientes().filter((i) => i.grupo === grupo);
    if (!del.length) return "";
    return `<span class="ingredientes-grid__grupo">${esc(grupo)}</span>${del
      .map((i) => `<button type="button" class="chip ${seleccion.has(i.id) ? "chip--on" : ""}" data-ing="${i.id}">${esc(i.nombre)}</button>`)
      .join("")}`;
  }).join("");
}

// Un ingrediente vuestro nuevo: id propio, su grupo, y se guarda en el
// menú de casa. Si ya existe uno con ese nombre, se devuelve ese.
async function crearIngrediente(nombre, grupo) {
  const normal = (t) => t.trim().toLowerCase();
  const existente = todosLosIngredientes().find((i) => normal(i.nombre) === normal(nombre));
  if (existente) return existente;
  const nuevo = { id: "i_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nombre: nombre.trim(), grupo: GRUPOS_INGREDIENTES.includes(grupo) ? grupo : "Lácteos y básicos" };
  const ingredientes_propios = [...(vida.menu?.ingredientes_propios || []), nuevo];
  // En local desde ya: el formulario que lo pidió lo enseña al momento, sin
  // esperar a que vuelva de la base de datos.
  vida.menu = { ...(vida.menu || {}), ingredientes_propios };
  await guardarMenu({ ingredientes_propios }).catch(() => {});
  return nuevo;
}

// El "＋" de cada grupo: apuntar un ingrediente vuestro en ese grupo (queda
// marcado para la semana) y, si hay, borrar los que ya no queráis.
function abrirEditorIngrediente(grupo) {
  const propiosDelGrupo = ingredientesPropios().filter((i) => i.grupo === grupo);
  openModal(
    `
    <h2 class="modal__title">Un ingrediente vuestro</h2>
    <p class="entity-card__meta" style="margin:-8px 0 12px;">
      Lo que coméis y no está en la lista. Se guarda para siempre: lo marcáis cada semana como los demás y entra en vuestros platos.
    </p>
    <form id="form-ingrediente" class="form-grid">
      <label class="field">
        <span class="field__label">¿Cómo se llama?</span>
        <input type="text" name="nombre" required maxlength="40" placeholder="Pavo picado" autocomplete="off" />
      </label>
      <label class="field">
        <span class="field__label">Grupo</span>
        <select name="grupo">${GRUPOS_INGREDIENTES.map((g) => `<option value="${g}" ${g === grupo ? "selected" : ""}>${g}</option>`).join("")}</select>
      </label>
      ${
        propiosDelGrupo.length
          ? `<div class="field field--full">
        <span class="field__label">Los vuestros en este grupo</span>
        <div class="ingredientes-grid">
          ${propiosDelGrupo.map((i) => `<button type="button" class="chip" data-borrar-ing="${i.id}" title="Borrar">${esc(i.nombre)} ✕</button>`).join("")}
        </div>
      </div>`
          : ""
      }
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancelar-ingrediente">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancelar-ingrediente").addEventListener("click", closeModal);
        root.querySelectorAll("[data-borrar-ing]").forEach((b) =>
          b.addEventListener("click", async () => {
            const id = b.dataset.borrarIng;
            const ing = ingredientePorId(id);
            if (!ing || !confirm(`¿Borrar "${ing.nombre}"? Los platos vuestros que lo llevaban dejan de pedirlo.`)) return;
            const platos = (vida.menu?.platos || []).map((p) => ({ ...p, req: (p.req || []).filter((i) => i !== id) }));
            await guardarMenu({
              ingredientes_propios: (vida.menu?.ingredientes_propios || []).filter((i) => i.id !== id),
              ingredientes: marcados().filter((i) => i !== id),
              platos,
            }).catch(() => {});
            closeModal();
          })
        );
        root.querySelector("#form-ingrediente").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          const nombre = String(f.get("nombre") || "").trim();
          if (!nombre) return;
          const creado = await crearIngrediente(nombre, String(f.get("grupo")));
          await guardarMenu({ ingredientes: [...new Set([...marcados(), creado.id])] }).catch(() => {});
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
      <label class="field-check field--full">
        <input type="checkbox" name="facil" ${!plato || plato.facil !== false ? "checked" : ""} />
        <span>Es fácil de hacer (pocos pasos, poco lío)</span>
      </label>
      <div class="field field--full">
        <span class="field__label">¿Qué lleva? (toca los ingredientes)</span>
        <p class="entity-card__meta" style="margin:0 0 8px;">Con lo que marques aquí, el plato entra en el menú cuando esos ingredientes estén marcados, y pasa a la lista de la compra con el resto.</p>
        <div class="ingredientes-grid" id="plato-ingredientes">${chipsDeIngredientes(new Set(plato?.req || []))}</div>
      </div>
      <div class="field field--full">
        <span class="field__label">¿Falta alguno? Apúntalo y queda para siempre</span>
        <div class="plato-nuevo-ing">
          <input type="text" id="plato-ing-nombre" maxlength="40" placeholder="Pavo picado" autocomplete="off" />
          <select id="plato-ing-grupo">${GRUPOS_INGREDIENTES.map((g) => `<option value="${g}">${g}</option>`).join("")}</select>
          <button type="button" class="btn btn--ghost btn--sm" id="btn-plato-ing">Añadir</button>
        </div>
      </div>
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
        const grid = root.querySelector("#plato-ingredientes");
        const marcadosDelPlato = () => new Set([...grid.querySelectorAll("[data-ing].chip--on")].map((b) => b.dataset.ing));
        grid.addEventListener("click", (e) => {
          const chip = e.target.closest("[data-ing]");
          if (chip) chip.classList.toggle("chip--on");
        });
        // Un ingrediente nuevo desde el propio plato: se guarda en casa (para
        // este y los platos que vengan) y queda marcado en el plato.
        root.querySelector("#btn-plato-ing").addEventListener("click", async () => {
          const nombre = root.querySelector("#plato-ing-nombre").value.trim();
          if (!nombre) return;
          const creado = await crearIngrediente(nombre, root.querySelector("#plato-ing-grupo").value);
          const seleccion = marcadosDelPlato();
          seleccion.add(creado.id);
          grid.innerHTML = chipsDeIngredientes(seleccion);
          root.querySelector("#plato-ing-nombre").value = "";
        });
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
            id: plato?.id || "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            nombre,
            momento: String(f.get("momento")),
            pasos: String(f.get("pasos") || "")
              .split("\n")
              .map((p) => p.trim())
              .filter(Boolean),
            aire: f.get("aire") === "on",
            facil: f.get("facil") === "on",
            req: [...marcadosDelPlato()],
          };
          const lista = [...(vida.menu?.platos || [])];
          const idx = lista.findIndex((p) => p.id === nuevo.id);
          if (idx >= 0) lista[idx] = nuevo;
          else lista.push(nuevo);
          // Lo que lleva el plato queda marcado en la semana: si no, el
          // plato recién apuntado no entraría nunca en el menú.
          const marcadosSemana = new Set(marcados());
          nuevo.req.forEach((i) => marcadosSemana.add(i));
          await guardarMenu({ platos: lista, ingredientes: [...marcadosSemana] }).catch(() => {});
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
      const quitando = lista.has(id);
      if (quitando) lista.delete(id);
      else lista.add(id);
      const datos = { ingredientes: [...lista] };
      // Quitar un ingrediente NO rehace la semana entera: solo se cambian
      // los platos que lo usaban; el resto del menú se queda tal cual.
      // Marcar uno nuevo no toca nada (los platos de antes siguen valiendo).
      if (quitando) Object.assign(datos, repararMenu([...lista]) || {});
      await guardarMenu(datos).catch(() => {});
      return;
    }
    if (e.target.closest("#btn-nuevo-plato")) {
      abrirEditorPlato(null);
      return;
    }
    const nuevoIng = e.target.closest("[data-nuevo-ingrediente]");
    if (nuevoIng) {
      abrirEditorIngrediente(nuevoIng.dataset.nuevoIngrediente);
      return;
    }
    if (e.target.closest("#btn-menu-a-compra")) {
      const { nuevos, yaEstaban } = await pasarMenuALaCompra().catch(() => ({ nuevos: 0, yaEstaban: 0 }));
      avisoCompra = nuevos
        ? `${nuevos} ingredientes añadidos a la lista de la compra (${yaEstaban} ya estaban).`
        : `Ya estaba todo en la lista de la compra (${yaEstaban} ingredientes).`;
      const aviso = document.getElementById("menu-compra-aviso");
      if (aviso) aviso.textContent = avisoCompra;
      setTimeout(() => {
        avisoCompra = "";
      }, 8000);
      efectoAlGuardar();
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
      // Con un menú en pie no se pisa sin preguntar: la compra de la
      // semana está hecha para ese menú.
      if (vida.menu?.lunes && !confirm("Ya hay un menú hecho (y la compra suele ir con él). ¿Lo sustituyo por uno nuevo?")) return;
      const lunes = lunesObjetivo(new Date());
      const menu = generarMenuSemana(lunes, marcados());
      const aviso = document.getElementById("menu-aviso");
      if (!menu) {
        if (aviso) aviso.textContent = "Con tan pocos ingredientes marcados no salen platos suficientes. Marca al menos una proteína, un hidrato y huevos.";
        return;
      }
      // Menú para la semana que viene con esta aún en marcha: lo que queda
      // de esta (de hoy al domingo) se conserva como cambios de fecha.
      if (vida.menu?.lunes && lunes > lunesDe(new Date())) menu.cambios = conservarRestoDeSemana(vida.menu, menu, new Date());
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
  // El menú guardado se enseña SIEMPRE — jamás desaparece al cambiar de
  // semana. Si es de una semana anterior, se dice con una nota, sin más.
  const menuVigente = vida.menu?.lunes ? vida.menu : null;
  const menuDeOtraSemana = menuVigente && menuVigente.lunes < lunesActual;
  const menuDeLaQueViene = menuVigente && menuVigente.lunes > lunesActual;
  const paraLaQueViene = lunesObjetivo(new Date()) !== lunesActual;
  const propios = platosPropios();
  const fechaLarga = (iso) => new Intl.DateTimeFormat(localeActual(), { day: "numeric", month: "long" }).format(new Date(iso + "T12:00:00"));

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
            ${todosLosIngredientes()
              .filter((i) => i.grupo === grupo)
              .map(
                (i) => `
              <button type="button" class="chip ${lista.has(i.id) ? "chip--on" : ""}${i.propio ? " chip--propio" : ""}" data-ingrediente="${i.id}">${esc(i.nombre)}</button>`
              )
              .join("")}
            <button type="button" class="chip chip--nueva" data-nuevo-ingrediente="${esc(grupo)}" title="Apuntar un ingrediente vuestro">＋</button>
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
          ${paraLaQueViene ? (menuVigente ? "Rehacer el menú para la semana que viene" : "Hacer el menú de la semana que viene") : menuVigente ? "Rehacer el menú de esta semana" : "Hacer el menú de esta semana"}
        </button>
        ${paraLaQueViene ? `<p class="entity-card__meta" style="margin-top:8px;">Es fin de semana: el menú se hace para la semana que viene. Lo de hoy y el fin de semana se queda como está.</p>` : ""}
      </article>

      <article class="card">
        <h2 class="card__title">El menú de la semana</h2>
        ${
          menuDeOtraSemana
            ? `<p class="entity-card__meta" style="margin-top:-6px;">Este menú lo hicisteis la semana del ${fechaLarga(menuVigente.lunes)} y <strong>sigue en pie</strong> — no se borra solo. Cuando queráis otro, botón de rehacer.</p>`
            : ""
        }
        ${
          menuDeLaQueViene
            ? `<p class="entity-card__meta" style="margin-top:-6px;">Este menú es para la semana que viene (del ${fechaLarga(menuVigente.lunes)}). Hasta el domingo sigue lo que ya teníais.</p>`
            : ""
        }
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
          </p>
          <button type="button" class="btn btn--ghost btn--block" id="btn-menu-a-compra" style="margin-top:10px;">🛒 Pasar los ingredientes del menú a la compra</button>
          <p class="entity-card__meta" id="menu-compra-aviso" style="margin-top:6px;">${esc(avisoCompra)}</p>`
        }
      </article>
    </div>
  `;
}
// vida:fin
