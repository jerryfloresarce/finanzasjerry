// vida:inicio
// Compras de casa: la lista de la compra de los dos, compartida y al
// momento (lo que marca uno aparece en el móvil del otro al instante).
//
// La gracia: nada se escribe dos veces. Lo comprado no se borra — baja a
// "En casa", y cuando se acaba se toca y vuelve a la lista. Con el tiempo
// la despensa de abajo ES vuestra despensa: reponer es un toque.
//
// Con categorías (Comida, Limpieza…): eliges una con los chips, lo que
// añades cae ahí, y la lista sale ordenada por secciones — como se
// recorre la tienda. El chip ＋ crea categorías nuevas; mantener pulsado
// un chip borra la categoría (sus cosas pasan a "Otros").
//
// Y sin botones: un campo para escribir, tocar para marcar, tocar para
// reponer, y mantener pulsado para borrar del todo. Nada más a la vista.

import { vida, guardarCompras, categoriasDeCompras } from "../vida.js?v=95";
import { esc } from "../modal.js?v=95";
import { efectoAlGuardar } from "../efectos.js?v=95";

const normal = (t) => t.trim().toLowerCase();

// La categoría en la que cae lo que se añade (el chip marcado).
let catActiva = null;

async function guardar(data) {
  await guardarCompras(data).catch(() => {});
}

export function mountVidaCompras() {
  const root = document.getElementById("view-compras");

  root.addEventListener("submit", async (e) => {
    if (e.target.id !== "form-compra") return;
    e.preventDefault();
    const input = root.querySelector("#compra-nueva");
    const nombre = (input?.value || "").trim();
    if (!nombre) return;
    const items = [...vida.compras];
    // Si ya existe (aunque esté "en casa"), no se duplica: se repone.
    const existente = items.find((i) => normal(i.nombre) === normal(nombre));
    if (existente) existente.falta = true;
    else items.push({ id: Date.now().toString(36), nombre, falta: true, cat: catActiva });
    input.value = "";
    await guardar({ items });
    efectoAlGuardar();
  });

  // Mantener pulsado (medio segundo largo) borra: un artículo del todo, o
  // una categoría (sus cosas no se pierden: pasan a "Otros").
  let pulsacion = null;
  let borrando = false;
  root.addEventListener("pointerdown", (e) => {
    const fila = e.target.closest("[data-compra]");
    const chipCat = e.target.closest("[data-cat]");
    if (!fila && !chipCat) return;
    pulsacion = setTimeout(async () => {
      pulsacion = null;
      borrando = true;
      if (fila) {
        const item = vida.compras.find((i) => i.id === fila.dataset.compra);
        if (item && confirm(`¿Borrar "${item.nombre}" del todo? (Para marcarlo basta un toque.)`)) {
          await guardar({ items: vida.compras.filter((i) => i.id !== item.id) });
        }
      } else {
        const id = chipCat.dataset.cat;
        const cat = categoriasDeCompras().find((c) => c.id === id);
        if (cat && confirm(`¿Borrar la categoría "${cat.nombre}"? Sus cosas pasan a "Otros".`)) {
          const categorias = categoriasDeCompras().filter((c) => c.id !== id);
          const items = vida.compras.map((i) => (i.cat === id ? { ...i, cat: null } : i));
          if (catActiva === id) catActiva = categorias[0]?.id ?? null;
          await guardar({ categorias, items });
        }
      }
    }, 550);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
    root.addEventListener(
      ev,
      () => {
        if (pulsacion) {
          clearTimeout(pulsacion);
          pulsacion = null;
        }
      },
      true
    )
  );

  root.addEventListener("click", async (e) => {
    if (borrando) {
      borrando = false;
      return;
    }
    // Elegir categoría para lo próximo que se añada.
    const chipCat = e.target.closest("[data-cat]");
    if (chipCat) {
      catActiva = chipCat.dataset.cat;
      renderVidaCompras(null);
      return;
    }
    // Crear una categoría nueva.
    if (e.target.closest("#btn-nueva-cat")) {
      const nombre = (prompt("¿Cómo se llama la categoría nueva?") || "").trim();
      if (!nombre) return;
      const categorias = [...categoriasDeCompras()];
      if (categorias.some((c) => normal(c.nombre) === normal(nombre))) return;
      const nueva = { id: "c_" + Date.now().toString(36), nombre };
      categorias.push(nueva);
      catActiva = nueva.id;
      await guardar({ categorias });
      efectoAlGuardar();
      return;
    }
    // Un toque en un artículo alterna: lo que falta pasa a "en casa", y al revés.
    const fila = e.target.closest("[data-compra]");
    if (fila) {
      const id = fila.dataset.compra;
      await guardar({ items: vida.compras.map((i) => (i.id === id ? { ...i, falta: !i.falta } : i)) });
    }
  });
}

export function renderVidaCompras(_state) {
  const el = document.getElementById("compras-content");
  if (!el) return;

  // Si se está escribiendo un artículo, no se repinta debajo de los dedos.
  const escribiendo = document.activeElement?.id === "compra-nueva" && document.activeElement.value !== "";
  if (escribiendo) return;

  const categorias = categoriasDeCompras();
  if (!catActiva || !categorias.some((c) => c.id === catActiva)) catActiva = categorias[0]?.id ?? null;

  const faltan = vida.compras.filter((i) => i.falta);
  const enCasa = vida.compras.filter((i) => !i.falta).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // La lista, por secciones y en el orden de las categorías; lo que no
  // tiene categoría (o la perdió) cae en "Otros", al final.
  const secciones = [...categorias, { id: null, nombre: "Otros" }]
    .map((cat) => ({
      cat,
      items: faltan.filter((i) => (i.cat ?? null) === cat.id || (cat.id === null && !categorias.some((c) => c.id === i.cat))),
    }))
    .filter((s) => s.items.length);

  const filaCompra = (i) => `
    <button type="button" class="compra" data-compra="${i.id}">
      <span class="compra__circulo" aria-hidden="true"></span>
      <span class="compra__nombre">${esc(i.nombre)}</span>
    </button>`;

  el.innerHTML = `
    <article class="card compras">
      <form id="form-compra" class="compras-add">
        <input type="text" id="compra-nueva" placeholder="¿Qué falta en casa?" autocomplete="off" enterkeyhint="done" maxlength="48" />
      </form>
      <div class="compras-cats">
        ${categorias.map((c) => `<button type="button" class="cat-chip ${c.id === catActiva ? "cat-chip--on" : ""}" data-cat="${c.id}">${esc(c.nombre)}</button>`).join("")}
        <button type="button" class="cat-chip cat-chip--nueva" id="btn-nueva-cat" title="Crear una categoría">＋</button>
      </div>
      <div class="compras-lista">
        ${
          secciones.length === 0
            ? `<p class="compras-vacio">No falta nada ✨</p>`
            : secciones
                .map(
                  (s) => `
          <p class="compras-cat">${esc(s.cat.nombre)}</p>
          ${s.items.map(filaCompra).join("")}`
                )
                .join("")
        }
      </div>
      ${
        enCasa.length
          ? `
      <p class="compras-titulo">En casa</p>
      <div class="compras-despensa">
        ${enCasa.map((i) => `<button type="button" class="compra-chip" data-compra="${i.id}">${esc(i.nombre)}</button>`).join("")}
      </div>`
          : ""
      }
      <p class="compras-pista">Elige categoría, escribe y dale a intro · toca para marcar o reponer · mantén pulsado para borrar</p>
    </article>
  `;
}
// vida:fin
