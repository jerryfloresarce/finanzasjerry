// vida:inicio
// Compras de casa: la lista de la compra de los dos, compartida y al
// momento (lo que marca uno aparece en el móvil del otro al instante).
//
// La gracia: nada se escribe dos veces. Lo comprado no se borra — baja a
// "En casa", y cuando se acaba se toca y vuelve a la lista. Con el tiempo
// la despensa de abajo ES vuestra despensa: reponer es un toque.
//
// Y sin botones: un campo para escribir, tocar para marcar, tocar para
// reponer, y mantener pulsado para borrar del todo. Nada más a la vista.

import { vida, guardarCompras } from "../vida.js?v=71";
import { efectoAlGuardar } from "../efectos.js?v=71";

const normal = (t) => t.trim().toLowerCase();

async function guardar(items) {
  await guardarCompras(items).catch(() => {});
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
    else items.push({ id: Date.now().toString(36), nombre, falta: true });
    input.value = "";
    await guardar(items);
    efectoAlGuardar();
  });

  // Mantener pulsado (medio segundo largo) borra el artículo del todo.
  let pulsacion = null;
  let borrando = false;
  root.addEventListener("pointerdown", (e) => {
    const fila = e.target.closest("[data-compra]");
    if (!fila) return;
    const id = fila.dataset.compra;
    pulsacion = setTimeout(async () => {
      pulsacion = null;
      borrando = true;
      const item = vida.compras.find((i) => i.id === id);
      if (item && confirm(`¿Borrar "${item.nombre}" del todo? (Para marcarlo basta un toque.)`)) {
        await guardar(vida.compras.filter((i) => i.id !== id));
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

  // Un toque alterna: lo que falta pasa a "en casa", y al revés.
  root.addEventListener("click", async (e) => {
    const fila = e.target.closest("[data-compra]");
    if (!fila) return;
    if (borrando) {
      borrando = false;
      return;
    }
    const id = fila.dataset.compra;
    await guardar(vida.compras.map((i) => (i.id === id ? { ...i, falta: !i.falta } : i)));
  });
}

export function renderVidaCompras(_state) {
  const el = document.getElementById("compras-content");
  if (!el) return;

  // Si se está escribiendo un artículo, no se repinta debajo de los dedos.
  const escribiendo = document.activeElement?.id === "compra-nueva" && document.activeElement.value !== "";
  if (escribiendo) return;

  const faltan = vida.compras.filter((i) => i.falta);
  const enCasa = vida.compras.filter((i) => !i.falta).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  el.innerHTML = `
    <article class="card compras">
      <form id="form-compra" class="compras-add">
        <input type="text" id="compra-nueva" placeholder="¿Qué falta en casa?" autocomplete="off" enterkeyhint="done" maxlength="48" />
      </form>
      <div class="compras-lista">
        ${
          faltan.length === 0
            ? `<p class="compras-vacio">No falta nada ✨</p>`
            : faltan
                .map(
                  (i) => `
          <button type="button" class="compra" data-compra="${i.id}">
            <span class="compra__circulo" aria-hidden="true"></span>
            <span class="compra__nombre">${i.nombre}</span>
          </button>`
                )
                .join("")
        }
      </div>
      ${
        enCasa.length
          ? `
      <p class="compras-titulo">En casa</p>
      <div class="compras-despensa">
        ${enCasa.map((i) => `<button type="button" class="compra-chip" data-compra="${i.id}">${i.nombre}</button>`).join("")}
      </div>`
          : ""
      }
      <p class="compras-pista">Escribe y dale a intro · toca para marcar o reponer · mantén pulsado para borrar</p>
    </article>
  `;
}
// vida:fin
