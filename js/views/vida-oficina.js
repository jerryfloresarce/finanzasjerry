// vida:inicio
// Oficina — el apartado de Jerry para los martes de oficina (desde el 8 de
// septiembre): la lista de la mochila, para repasarla la noche anterior y
// salir por la puerta sin el "¿me dejo algo?". Los elementos son suyos
// (añadir, quitar) y viven en su configuración; las marcas se apuntan con
// la fecha, y caducan solas: si la última revisión no es de hoy ni de
// anoche, la lista amanece sin marcar, lista para el siguiente repaso.

import { vida, guardarSistema } from "../vida.js?v=102";
import { fechaISO } from "../db.js?v=102";
import { esc } from "../modal.js?v=102";

const ITEMS_DE_SERIE = [
  "Portátil y cargador",
  "Tarjeta o llaves de la oficina",
  "Auriculares",
  "Botella de agua",
  "Tupper o comida",
  "Cartera y transporte",
  "Ropa de mañana lista",
];

function ayerISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fechaISO(d);
}

function estado() {
  const items = Array.isArray(vida.sistema.oficina_items) && vida.sistema.oficina_items.length ? vida.sistema.oficina_items : ITEMS_DE_SERIE;
  const guardado = vida.sistema.oficina || {};
  // Las marcas solo valen si son de hoy o de anoche (se prepara la noche
  // anterior y se repasa por la mañana). Más viejas, se dan por caducadas.
  const vigentes = guardado.fecha === fechaISO() || guardado.fecha === ayerISO();
  return { items, marcas: vigentes ? guardado.marcas || {} : {} };
}

export function mountVidaOficina() {
  const root = document.getElementById("view-oficina");
  root.addEventListener("click", async (e) => {
    const marca = e.target.closest("[data-oficina-item]");
    if (marca) {
      const { marcas } = estado();
      const id = marca.dataset.oficinaItem;
      const nuevas = { ...marcas, [id]: !marcas[id] };
      await guardarSistema({ oficina: { fecha: fechaISO(), marcas: nuevas } }).catch(() => {});
      return;
    }
    const quitar = e.target.closest("[data-oficina-quitar]");
    if (quitar) {
      const { items } = estado();
      const i = Number(quitar.dataset.oficinaQuitar);
      if (!confirm(`¿Quitar "${items[i]}" de la lista?`)) return;
      await guardarSistema({ oficina_items: items.filter((_, x) => x !== i) }).catch(() => {});
      return;
    }
    if (e.target.closest("#btn-oficina-reset")) {
      await guardarSistema({ oficina: { fecha: fechaISO(), marcas: {} } }).catch(() => {});
      return;
    }
    if (e.target.closest("#btn-oficina-add")) {
      await anadirDelCampo(root);
      return;
    }
  });
  root.addEventListener("submit", async (e) => {
    if (e.target.id !== "form-oficina-item") return;
    e.preventDefault();
    await anadirDelCampo(root);
  });
}

// Lo escrito entra en la lista venga de donde venga el toque (Enter o el
// botón): escribir y guardar nunca tira lo escrito.
async function anadirDelCampo(root) {
  const input = root.querySelector("#oficina-item-nuevo");
  const texto = (input?.value || "").trim();
  if (!texto) return;
  const { items } = estado();
  input.value = "";
  await guardarSistema({ oficina_items: [...items, texto] }).catch(() => {});
}

export function renderVidaOficina() {
  const el = document.getElementById("oficina-content");
  if (!el) return;

  const { items, marcas } = estado();
  const listos = items.filter((n) => marcas[n]).length;
  const todo = items.length > 0 && listos === items.length;

  el.innerHTML = `
    <article class="card">
      <div class="card__header">
        <h2 class="card__title">La mochila de la oficina</h2>
        <span class="entity-card__tag ${todo ? "entity-card__tag--activo" : ""}">${listos}/${items.length}</span>
      </div>
      <p class="entity-card__meta" style="margin-top:-6px;">
        Repásala la noche de antes (el lunes te lo recuerda el horario) y
        un vistazo por la mañana. Las marcas se borran solas al día
        siguiente, listas para la próxima.
      </p>
      ${
        todo
          ? `<div class="card hoy-aviso" style="margin:10px 0;"><p class="entity-card__meta" style="margin:0;">🎒 <strong>Todo listo.</strong> Mañana, solo cogerla y salir.</p></div>`
          : ""
      }
      <div class="agenda-tareas" style="border-top:none; padding-top:4px;">
        ${items
          .map(
            (nombre, i) => `
          <div class="mini-row" style="gap:6px;">
            <button type="button" class="agenda-tarea ${marcas[nombre] ? "agenda-tarea--hecha" : ""}" data-oficina-item="${esc(nombre)}" style="flex:1;">
              <span class="agenda-tarea__circulo">${marcas[nombre] ? "✓" : ""}</span>${esc(nombre)}
            </button>
            <button type="button" class="row-edit-btn" data-oficina-quitar="${i}" title="Quitar de la lista">✕</button>
          </div>`
          )
          .join("")}
      </div>
      <form id="form-oficina-item" class="compras-add" style="margin-top:10px;">
        <input type="text" id="oficina-item-nuevo" placeholder="¿Algo más que llevar?" autocomplete="off" maxlength="60" />
        <button type="button" class="btn btn--ghost btn--sm" id="btn-oficina-add">＋ Añadir</button>
      </form>
      <button type="button" class="btn btn--ghost btn--sm" id="btn-oficina-reset" style="margin-top:10px;">Desmarcar todo</button>
    </article>`;
}
// vida:fin
