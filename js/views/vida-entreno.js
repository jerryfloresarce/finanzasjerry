// vida:inicio
// Entreno: registrar la sesión de hoy con sus pesos y repeticiones. Sin
// esto no hay doble progresión, solo entrenos sueltos — por eso el peso de
// cada ejercicio viene ya puesto con el de la última vez, y cuando tocaba
// subir, con la subida hecha y avisada.

import {
  vida,
  PLANES,
  SEMANA_TIPO,
  NOMBRE_TIPO_ENTRENO,
  TIPOS_ENTRENO,
  ultimoEntrenoDeTipo,
  sugerenciaProgresion,
  addEntreno,
  deleteEntreno,
  esRutinaPropia,
  rutinaPorTipo,
  guardarSistema,
} from "../vida.js?v=66";
import { fechaISO, formatFecha } from "../db.js?v=66";
import { efectoAlGuardar } from "../efectos.js?v=66";
import { openModal, closeModal } from "../modal.js?v=66";

let tipoActivo = null;

function tipoDeHoy() {
  const t = SEMANA_TIPO[new Date().getDay()].tipo;
  return TIPOS_ENTRENO.includes(t) ? t : TIPOS_ENTRENO[0];
}

// Si hay algo escrito en el formulario, no se repinta: un dato que llegue
// de Firestore a mitad de sesión no puede borrar las series ya apuntadas.
function formularioConDatos(el) {
  return [...el.querySelectorAll("#form-entreno input")].some((i) => i.value !== "" && i.dataset.prefill !== i.value);
}

export function mountVidaEntreno() {
  const root = document.getElementById("view-entreno");
  root.addEventListener("click", async (e) => {
    const chip = e.target.closest("[data-tipo-entreno]");
    if (chip) {
      tipoActivo = chip.dataset.tipoEntreno;
      renderVidaEntreno(null, true);
      return;
    }
    const borrar = e.target.closest("[data-borrar-entreno]");
    if (borrar) {
      if (confirm("¿Borrar este entreno del historial?")) {
        await deleteEntreno(borrar.dataset.borrarEntreno);
        renderVidaEntreno(null, true);
      }
      return;
    }
    if (e.target.closest("#btn-guardar-entreno")) {
      await guardarSesion(root);
      return;
    }
    if (e.target.closest("#btn-nueva-rutina")) {
      abrirEditorRutina(null);
      return;
    }
    if (e.target.closest("#btn-editar-rutina")) {
      abrirEditorRutina(rutinaPorTipo(tipoActivo));
      return;
    }
    if (e.target.closest("#btn-borrar-rutina")) {
      const r = rutinaPorTipo(tipoActivo);
      if (r && confirm(`¿Borrar la rutina "${r.nombre}"? Los entrenos ya registrados con ella se quedan en el historial.`)) {
        const rutinas = (vida.sistema.rutinas || []).filter((x) => String(x.id) !== String(r.id));
        await guardarSistema({ rutinas });
        tipoActivo = null;
        renderVidaEntreno(null, true);
      }
      return;
    }
  });
}

// ---------- El editor de rutinas propias ----------
//
// Para que cada uno se monte lo suyo (calistenia, máquinas, estiramientos…)
// sin pedirlo: nombre, y o bien una lista de ejercicios con series/reps/peso
// (funciona como los planes de fuerza, doble progresión incluida) o bien
// una sesión simple de duración y nota, como la caminata.

function filaEjercicio(ej = {}) {
  return `
    <div class="rutina-ejercicio">
      <input type="text" class="rut-nombre" placeholder="Ejercicio (ej. Flexiones)" value="${ej.nombre || ""}" />
      <input type="number" class="rut-series" placeholder="Series" min="1" value="${ej.series ?? ""}" title="Series" />
      <input type="number" class="rut-min" placeholder="Reps mín" min="1" value="${ej.repsMin ?? ""}" title="Repeticiones mínimas" />
      <input type="number" class="rut-max" placeholder="Reps máx" min="1" value="${ej.repsMax ?? ""}" title="Repeticiones máximas" />
      <input type="number" class="rut-peso" placeholder="kg (0 si sin peso)" step="0.5" value="${ej.pesoInicial ?? ""}" title="Peso de partida" />
      <button type="button" class="row-edit-btn rut-quitar" title="Quitar">✕</button>
    </div>`;
}

function abrirEditorRutina(rutina) {
  const conEjercicios = !rutina || (Array.isArray(rutina.ejercicios) && rutina.ejercicios.length > 0);
  openModal(
    `
    <h2 class="modal__title">${rutina ? "Editar rutina" : "Nueva rutina"}</h2>
    <form id="form-rutina">
      <label class="field field--full">
        <span class="field__label">Nombre de la rutina</span>
        <input type="text" id="rutina-nombre" required placeholder="Calistenia, Máquinas, Estiramientos…" value="${rutina?.nombre || ""}" />
      </label>
      <label class="field-check" style="margin: 6px 0 10px;">
        <input type="checkbox" id="rutina-con-ejercicios" ${conEjercicios ? "checked" : ""} />
        Con lista de ejercicios (series, reps y peso — con subida automática)
      </label>
      <div id="rutina-ejercicios" class="${conEjercicios ? "" : "is-hidden"}">
        ${(rutina?.ejercicios?.length ? rutina.ejercicios : [{}]).map(filaEjercicio).join("")}
        <button type="button" class="btn btn--ghost btn--sm" id="btn-mas-ejercicio">+ Otro ejercicio</button>
        <p class="entity-card__meta" style="margin-top:6px;">Sin peso (calistenia, estiramientos): pon 0 kg. La app sugiere subir cuando completes el rango alto en todas las series.</p>
      </div>
      <p class="field-error" id="rutina-error"></p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#rutina-con-ejercicios").addEventListener("change", (e) => {
          root.querySelector("#rutina-ejercicios").classList.toggle("is-hidden", !e.target.checked);
        });
        root.querySelector("#rutina-ejercicios").addEventListener("click", (e) => {
          const quitar = e.target.closest(".rut-quitar");
          if (quitar) quitar.closest(".rutina-ejercicio").remove();
        });
        root.querySelector("#btn-mas-ejercicio").addEventListener("click", (e) => {
          e.target.insertAdjacentHTML("beforebegin", filaEjercicio());
        });
        root.querySelector("#form-rutina").addEventListener("submit", async (e) => {
          e.preventDefault();
          const nombre = root.querySelector("#rutina-nombre").value.trim();
          if (!nombre) return;
          let ejercicios = null;
          if (root.querySelector("#rutina-con-ejercicios").checked) {
            ejercicios = [...root.querySelectorAll(".rutina-ejercicio")]
              .map((fila) => ({
                nombre: fila.querySelector(".rut-nombre").value.trim(),
                series: Number(fila.querySelector(".rut-series").value) || 3,
                repsMin: Number(fila.querySelector(".rut-min").value) || 8,
                repsMax: Number(fila.querySelector(".rut-max").value) || Number(fila.querySelector(".rut-min").value) || 12,
                pesoInicial: Number(fila.querySelector(".rut-peso").value) || 0,
              }))
              .filter((ej) => ej.nombre);
            if (!ejercicios.length) {
              root.querySelector("#rutina-error").textContent = "Pon al menos un ejercicio con nombre (o desmarca la casilla para una sesión simple).";
              return;
            }
          }
          const id = rutina?.id ?? Date.now().toString(36);
          const rutinas = [...(vida.sistema.rutinas || [])];
          const idx = rutinas.findIndex((r) => String(r.id) === String(id));
          const nueva = { id, nombre, ejercicios };
          if (idx >= 0) rutinas[idx] = nueva;
          else rutinas.push(nueva);
          try {
            await guardarSistema({ rutinas });
            tipoActivo = "rut_" + id;
            closeModal();
            renderVidaEntreno(null, true);
          } catch (err) {
            root.querySelector("#rutina-error").textContent = "No se pudo guardar. Revisa la conexión.";
          }
        });
      },
    }
  );
}

async function guardarSesion(root) {
  const tipo = tipoActivo;
  const esFuerza = Boolean(PLANES[tipo]);
  const f = root.querySelector("#form-entreno");
  const data = {
    fecha: fechaISO(),
    tipo,
    duracion_min: Number(f.querySelector("#entreno-duracion")?.value || 0) || null,
    gym_lleno: Boolean(f.querySelector("#entreno-lleno")?.checked),
    ejercicios: [],
  };
  if (esFuerza) {
    PLANES[tipo].forEach((plan, idx) => {
      const peso = Number(f.querySelector(`[data-peso="${idx}"]`)?.value || 0);
      const series = [...f.querySelectorAll(`[data-reps="${idx}"]`)]
        .map((i) => Number(i.value || 0))
        .filter((r) => r > 0)
        .map((reps) => ({ peso, reps }));
      if (series.length) data.ejercicios.push({ nombre: plan.nombre, series });
    });
    if (data.ejercicios.length === 0) {
      root.querySelector("#entreno-error").textContent = "Apunta al menos una serie antes de guardar.";
      return;
    }
  } else {
    const nota = f.querySelector("#entreno-nota")?.value.trim();
    if (nota) data.nota = nota;
    if (!data.duracion_min) {
      root.querySelector("#entreno-error").textContent = "Apunta cuántos minutos han sido.";
      return;
    }
  }
  try {
    await addEntreno(data);
    efectoAlGuardar();
    renderVidaEntreno(null, true);
  } catch (err) {
    root.querySelector("#entreno-error").textContent = "No se pudo guardar. ¿Están publicadas las reglas nuevas de Firebase?";
  }
}

export function renderVidaEntreno(_state, forzar = false) {
  const el = document.getElementById("entreno-content");
  if (!el) return;
  if (!tipoActivo) tipoActivo = tipoDeHoy();
  if (!forzar && el.querySelector("#form-entreno") && formularioConDatos(el)) return;

  const esFuerza = Boolean(PLANES[tipoActivo]);
  const ultima = ultimoEntrenoDeTipo(tipoActivo);
  const deHoy = vida.entrenos.filter((e) => e.fecha === fechaISO());
  const toca = SEMANA_TIPO[new Date().getDay()];

  const chips =
    TIPOS_ENTRENO.map(
      (t) => `<button type="button" class="chip ${t === tipoActivo ? "chip--on" : ""}" data-tipo-entreno="${t}">${NOMBRE_TIPO_ENTRENO[t] || t}</button>`
    ).join("") + `<button type="button" class="chip chip--nueva" id="btn-nueva-rutina" title="Crear una rutina propia">＋ Rutina</button>`;

  let cuerpo;
  if (esFuerza) {
    cuerpo = PLANES[tipoActivo]
      .map((plan, idx) => {
        const sug = sugerenciaProgresion(plan, ultima);
        const peso = sug?.peso ?? plan.pesoInicial;
        const unidad = plan.etiqueta || "reps";
        return `
        <div class="ejercicio">
          <div class="ejercicio__cabecera">
            <span class="ejercicio__nombre">${plan.nombre}</span>
            <span class="ejercicio__objetivo">${plan.series} × ${plan.repsMin === plan.repsMax ? plan.repsMax : `${plan.repsMin}–${plan.repsMax}`}${plan.etiqueta ? ` ${plan.etiqueta}` : ""}</span>
          </div>
          ${plan.nota ? `<p class="ejercicio__nota">${plan.nota}</p>` : ""}
          ${sug?.texto ? `<p class="ejercicio__sube"><i class="ph-fill ph-trend-up" aria-hidden="true"></i> ${sug.texto}</p>` : ""}
          <div class="ejercicio__series">
            <label class="ejercicio__peso">
              <span>kg</span>
              <input type="number" step="0.5" value="${peso || ""}" data-peso="${idx}" data-prefill="${peso || ""}" />
            </label>
            ${Array.from({ length: plan.series }, (_, s) => `
              <label class="ejercicio__reps">
                <span>S${s + 1}</span>
                <input type="number" inputmode="numeric" placeholder="${unidad === "reps" ? plan.repsMin : plan.repsMax}" data-reps="${idx}" data-prefill="" />
              </label>`).join("")}
          </div>
        </div>`;
      })
      .join("");
  } else {
    cuerpo = `
      <p class="entity-card__meta">${
        tipoActivo === "piscina"
          ? "10 min suave · 20 min de series (8×50 m, 30 s de descanso) · 10 min suave. Cuenta como entreno cumplido."
          : tipoActivo === "yoga"
            ? "La clase con la abuela (o una sesión en casa con un vídeo). Moverse cuenta, el nivel da igual."
            : esRutinaPropia(tipoActivo)
              ? "Sesión simple: apunta los minutos y, si quieres, una nota de qué hiciste."
              : "Cinta al 10–12 %, 5–5,5 km/h, sin agarrarse a las barras. Cualquier cuesta de la calle vale igual."
      }</p>
      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" id="entreno-nota" placeholder="${tipoActivo === "piscina" ? "8×50 m a crol" : tipoActivo === "yoga" ? "Con la abuela" : "12 %, 5 km/h"}" data-prefill="" />
      </label>`;
  }

  el.innerHTML = `
    <p class="entity-card__meta" style="margin-top:-6px;">Hoy toca: <strong>${toca.nombre}</strong></p>
    <div class="chips">${chips}</div>
    ${
      esRutinaPropia(tipoActivo)
        ? `<p class="entity-card__meta" style="margin:2px 0 10px;">Rutina tuya ·
            <button type="button" class="btn btn--ghost btn--sm" id="btn-editar-rutina">✎ Editar</button>
            <button type="button" class="btn btn--ghost btn--sm" id="btn-borrar-rutina">Borrar</button></p>`
        : ""
    }

    ${deHoy.length ? `<div class="card hoy-aviso"><p class="entity-card__meta" style="margin:0;">✓ Hoy ya has registrado: ${deHoy.map((e) => NOMBRE_TIPO_ENTRENO[e.tipo] || e.tipo).join(" + ")}</p></div>` : ""}

    <article class="card">
      <div id="form-entreno">
        ${cuerpo}
        <div class="form-grid" style="margin-top:12px;">
          <label class="field">
            <span class="field__label">Duración (min)</span>
            <input type="number" id="entreno-duracion" placeholder="75" data-prefill="" />
          </label>
          ${esFuerza ? `<label class="field-check" style="align-self:end;">
            <input type="checkbox" id="entreno-lleno" />
            El gimnasio estaba lleno
          </label>` : ""}
        </div>
        ${esFuerza ? `<p class="entity-card__meta">Si está imposible: ejercicios 1 y 2 se esperan, del 3 en adelante cualquier máquina del mismo grupo vale, y si no hay manera → piscina. Cuenta igual.</p>` : ""}
        <p class="field-error" id="entreno-error"></p>
        <button type="button" class="btn btn--primary btn--block hoy-cerrar" id="btn-guardar-entreno">Guardar el entreno</button>
      </div>
    </article>

    <article class="card" style="margin-top:16px;">
      <h2 class="card__title">Últimos entrenos</h2>
      <div class="mini-list">
        ${
          vida.entrenos.length === 0
            ? `<p class="empty-state">Todavía no hay ninguno. El primero es hoy.</p>`
            : [...vida.entrenos]
                .slice(-10)
                .reverse()
                .map((e) => {
                  const resumen = (e.ejercicios || [])
                    .slice(0, 3)
                    .map((ej) => {
                      const mejor = [...ej.series].sort((a, b) => b.peso - a.peso || b.reps - a.reps)[0];
                      return `${ej.nombre.split(" ")[0]} ${mejor.peso > 0 ? mejor.peso + " kg" : mejor.reps}`;
                    })
                    .join(" · ");
                  return `
              <div class="mini-row">
                <div class="mini-row__main" style="flex:1; min-width:0;">
                  <span class="mini-row__title">${NOMBRE_TIPO_ENTRENO[e.tipo] || e.tipo} — ${formatFecha(new Date(e.fecha + "T12:00:00"))}${e.gym_lleno ? " · lleno" : ""}</span>
                  <span class="mini-row__sub">${resumen || e.nota || (e.duracion_min ? e.duracion_min + " min" : "")}</span>
                </div>
                <button type="button" class="row-edit-btn" data-borrar-entreno="${e.id}" title="Borrar"><i class="ph-thin ph-trash" aria-hidden="true"></i></button>
              </div>`;
                })
                .join("")
        }
      </div>
    </article>
  `;
}
// vida:fin
