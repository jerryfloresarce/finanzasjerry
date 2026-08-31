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
  planRetocado,
  guardarSistema,
  tecnicaDe,
  urlVideoTecnica,
  TECNICA_CROL,
} from "../vida.js?v=101";
import { fechaISO, formatFecha } from "../db.js?v=101";
import { efectoAlGuardar } from "../efectos.js?v=101";
import { openModal, closeModal, esc } from "../modal.js?v=101";

let tipoActivo = null;

function tipoDeHoy() {
  const t = SEMANA_TIPO[new Date().getDay()].tipo;
  return TIPOS_ENTRENO.includes(t) ? t : TIPOS_ENTRENO[0];
}

// El entreno a medias NO se pierde: lo tecleado se apunta solo (con un
// respiro de un segundo) en sistema.entreno_borrador. Cerrar la app a
// mitad de sesión, que llegue una versión nueva, cambiar de pantalla…
// al volver, el formulario sigue como estaba. Se limpia al guardar.
let tipoElegidoAMano = false;
let timerBorrador = null;
function apuntarBorrador(root) {
  clearTimeout(timerBorrador);
  timerBorrador = setTimeout(() => {
    const f = root.querySelector("#form-entreno");
    if (!f) return;
    const pesos = {};
    const reps = {};
    f.querySelectorAll("[data-peso]").forEach((i) => (pesos[`${i.dataset.peso}:${i.dataset.serie}`] = i.value));
    f.querySelectorAll("[data-reps]").forEach((i) => (reps[`${i.dataset.reps}:${i.dataset.serie}`] = i.value));
    guardarSistema({
      entreno_borrador: {
        fecha: fechaISO(),
        tipo: tipoActivo,
        pesos,
        reps,
        duracion: f.querySelector("#entreno-duracion")?.value ?? "",
        nota: f.querySelector("#entreno-nota")?.value ?? "",
        zonas: [...f.querySelectorAll("[data-zona].chip--on")].map((b) => b.dataset.zona),
        lleno: Boolean(f.querySelector("#entreno-lleno")?.checked),
      },
    }).catch(() => {});
  }, 900);
}
function borradorDeHoy() {
  const b = vida.sistema.entreno_borrador;
  return b && b.fecha === fechaISO() ? b : null;
}

// Las zonas del cuerpo que se pueden marcar en una sesión de yoga (o en
// una rutina simple propia, como unos estiramientos): qué se ha trabajado
// o estirado hoy. Se guardan en el entreno y se ven en el historial.
const ZONAS_CUERPO = ["Espalda", "Cuello y hombros", "Caderas", "Piernas", "Brazos", "Core", "Equilibrio", "Relajación"];

// ¿Esta sesión lleva las zonas del cuerpo? El yoga siempre; una rutina
// propia solo si es simple (sin lista de ejercicios).
function sesionConZonas(tipo) {
  return tipo === "yoga" || (esRutinaPropia(tipo) && !PLANES[tipo]);
}

// Si hay algo escrito en el formulario, no se repinta: un dato que llegue
// de Firestore a mitad de sesión no puede borrar las series ya apuntadas.
// El checkbox va aparte: su value es siempre "on", escrito o no, y si
// contara como "datos" ningún repintado por snapshot llegaría jamás a los
// días de fuerza (los retoques de ejercicios se verían solo al recargar).
function formularioConDatos(el) {
  if (el.querySelector("#entreno-lleno")?.checked) return true;
  if (el.querySelector("[data-zona].chip--on")) return true;
  return [...el.querySelectorAll('#form-entreno input:not([type="checkbox"])')].some((i) => i.value !== "" && i.dataset.prefill !== i.value);
}

export function mountVidaEntreno() {
  const root = document.getElementById("view-entreno");
  // Cada tecla del formulario alimenta el borrador: la sesión a medias
  // queda a salvo de recargas y cierres.
  root.addEventListener("input", (e) => {
    if (e.target.closest("#form-entreno")) apuntarBorrador(root);
  });
  root.addEventListener("click", async (e) => {
    const chip = e.target.closest("[data-tipo-entreno]");
    if (chip) {
      tipoActivo = chip.dataset.tipoEntreno;
      tipoElegidoAMano = true;
      renderVidaEntreno(null, true);
      return;
    }
    const zona = e.target.closest("[data-zona]");
    if (zona) {
      zona.classList.toggle("chip--on");
      apuntarBorrador(root);
      return;
    }
    // Poner (o quitar) la rutina activa en un día de la semana: toca un
    // día y esa rutina pasa a ser lo que toca ese día; tócalo otra vez y
    // el día vuelve a su plan de serie.
    const diaRutina = e.target.closest("[data-dia-rutina]");
    if (diaRutina) {
      const dia = Number(diaRutina.dataset.diaRutina);
      const semana = { ...(vida.sistema.semana || {}) };
      semana[dia] = SEMANA_TIPO[dia]?.tipo === tipoActivo ? null : tipoActivo;
      await guardarSistema({ semana });
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
    if (e.target.closest("#btn-editar-ejercicios")) {
      abrirEditorEjercicios(tipoActivo);
      return;
    }
    const tec = e.target.closest("[data-tecnica]");
    if (tec) {
      const plan = PLANES[tipoActivo]?.[Number(tec.dataset.tecnica)];
      const t = tecnicaDe(plan?.nombre);
      if (t) abrirTecnica(t, plan.nombre);
      return;
    }
    if (e.target.closest("#btn-tecnica-crol")) {
      abrirTecnicaCrol();
      return;
    }
    if (e.target.closest("#btn-plan-serie")) {
      if (confirm("¿Volver al plan de serie de esta rutina? Tus retoques se pierden (el historial no).")) {
        await guardarSistema({ planes: { [tipoActivo]: null } });
        renderVidaEntreno(null, true);
      }
      return;
    }
  });
}

// ---------- La guía de técnica ----------
//
// El "vídeo" que pidió Jerry, en versión app: cada ejercicio con su señal
// mental, la técnica paso a paso, los errores típicos y un botón que abre
// los mejores vídeos de ese ejercicio en YouTube. Aprende visual: el texto
// le dice QUÉ mirar, y el vídeo se lo enseña.

function abrirTecnica(t, nombre) {
  openModal(
    `
    <h2 class="modal__title">${esc(nombre)}</h2>
    <p class="tecnica-senal">💡 <strong>La señal:</strong> ${t.senal}</p>
    <ol class="receta-pasos">
      ${t.pasos.map((p) => `<li>${p}</li>`).join("")}
    </ol>
    <p class="progreso-grupo">Errores típicos</p>
    <ul class="tecnica-errores">
      ${t.errores.map((e) => `<li>${e}</li>`).join("")}
    </ul>
    <div class="modal__actions">
      <a class="btn btn--ghost" href="${urlVideoTecnica(t)}" target="_blank" rel="noopener">▶ Verlo en vídeo</a>
      <button type="button" class="btn btn--primary" id="btn-cerrar-tecnica">Listo</button>
    </div>`,
    { onMount: (root) => root.querySelector("#btn-cerrar-tecnica").addEventListener("click", closeModal) }
  );
}

function abrirTecnicaCrol() {
  const g = TECNICA_CROL;
  openModal(
    `
    <h2 class="modal__title">${g.titulo}</h2>
    ${g.claves.map((c) => `<p class="tecnica-clave"><strong>${c.nombre}.</strong> ${c.texto}</p>`).join("")}
    <p class="progreso-grupo">Ejercicios técnicos (drills)</p>
    <ol class="receta-pasos">
      ${g.drills.map((d) => `<li>${d}</li>`).join("")}
    </ol>
    <p class="progreso-grupo">Tu sesión para aprender (30–40 min)</p>
    <ol class="receta-pasos">
      ${g.sesion.map((s) => `<li>${s}</li>`).join("")}
    </ol>
    <div class="modal__actions">
      <a class="btn btn--ghost" href="https://www.youtube.com/results?search_query=${encodeURIComponent(g.video)}" target="_blank" rel="noopener">▶ Verlo en vídeo</a>
      <button type="button" class="btn btn--primary" id="btn-cerrar-tecnica">Listo</button>
    </div>`,
    { onMount: (root) => root.querySelector("#btn-cerrar-tecnica").addEventListener("click", closeModal) }
  );
}

// ---------- Editar los ejercicios de una rutina de serie ----------
//
// Las rutinas de serie (Pierna, Tirón, Empuje) también son tuyas: añade,
// quita o cambia ejercicios y el retoque se guarda en tu configuración
// (sistema.planes). "Volver al de serie" lo deshace cuando quieras.

function abrirEditorEjercicios(tipo) {
  const plan = PLANES[tipo] || [];
  openModal(
    `
    <h2 class="modal__title">Ejercicios de ${NOMBRE_TIPO_ENTRENO[tipo] || "la rutina"}</h2>
    <p class="entity-card__meta" style="margin:-8px 0 12px;">
      Añade, quita o cambia lo que quieras: series, rango de reps y peso de
      partida. La subida automática funciona igual con tus cambios.
    </p>
    <form id="form-ejercicios">
      <div id="rutina-ejercicios">
        ${(plan.length ? plan : [{}]).map(filaEjercicio).join("")}
        <button type="button" class="btn btn--ghost btn--sm" id="btn-mas-ejercicio">+ Otro ejercicio</button>
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
        root.querySelector("#rutina-ejercicios").addEventListener("click", (e) => {
          const quitar = e.target.closest(".rut-quitar");
          if (quitar) quitar.closest(".rutina-ejercicio").remove();
        });
        root.querySelector("#btn-mas-ejercicio").addEventListener("click", (e) => {
          e.target.insertAdjacentHTML("beforebegin", filaEjercicio());
        });
        root.querySelector("#form-ejercicios").addEventListener("submit", async (e) => {
          e.preventDefault();
          const ejercicios = leerEjercicios(root);
          if (!ejercicios.length) {
            root.querySelector("#rutina-error").textContent = "Pon al menos un ejercicio con nombre.";
            return;
          }
          try {
            await guardarSistema({ planes: { ...(vida.sistema.planes || {}), [tipo]: ejercicios } });
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

// ---------- El editor de rutinas propias ----------
//
// Para que cada uno se monte lo suyo (calistenia, máquinas, estiramientos…)
// sin pedirlo: nombre, y o bien una lista de ejercicios con series/reps/peso
// (funciona como los planes de fuerza, doble progresión incluida) o bien
// una sesión simple de duración y nota, como la caminata.

function filaEjercicio(ej = {}) {
  // etiqueta y nota no se editan en la fila, pero viajan con ella para que
  // retocar un plan no las pierda ("por mancuerna", los avisos de la ingle…).
  return `
    <div class="rutina-ejercicio" data-etiqueta="${esc(ej.etiqueta || "")}" data-nota="${esc(ej.nota || "")}">
      <input type="text" class="rut-nombre" placeholder="Ejercicio (ej. Flexiones)" value="${esc(ej.nombre || "")}" />
      <input type="number" class="rut-series" placeholder="Series" min="1" value="${ej.series ?? ""}" title="Series" />
      <input type="number" class="rut-min" placeholder="Reps mín" min="1" value="${ej.repsMin ?? ""}" title="Repeticiones mínimas" />
      <input type="number" class="rut-max" placeholder="Reps máx" min="1" value="${ej.repsMax ?? ""}" title="Repeticiones máximas" />
      <input type="number" class="rut-peso" placeholder="kg (0 si sin peso)" step="0.5" value="${ej.pesoInicial ?? ""}" title="Peso de partida" />
      <button type="button" class="row-edit-btn rut-quitar" title="Quitar">✕</button>
    </div>`;
}

function leerEjercicios(root) {
  return [...root.querySelectorAll(".rutina-ejercicio")]
    .map((fila) => {
      const ej = {
        nombre: fila.querySelector(".rut-nombre").value.trim(),
        series: Number(fila.querySelector(".rut-series").value) || 3,
        repsMin: Number(fila.querySelector(".rut-min").value) || 8,
        repsMax: Number(fila.querySelector(".rut-max").value) || Number(fila.querySelector(".rut-min").value) || 12,
        pesoInicial: Number(fila.querySelector(".rut-peso").value) || 0,
      };
      if (fila.dataset.etiqueta) ej.etiqueta = fila.dataset.etiqueta;
      if (fila.dataset.nota) ej.nota = fila.dataset.nota;
      return ej;
    })
    .filter((ej) => ej.nombre);
}

function abrirEditorRutina(rutina) {
  const conEjercicios = !rutina || (Array.isArray(rutina.ejercicios) && rutina.ejercicios.length > 0);
  openModal(
    `
    <h2 class="modal__title">${rutina ? "Editar rutina" : "Nueva rutina"}</h2>
    <form id="form-rutina">
      <label class="field field--full">
        <span class="field__label">Nombre de la rutina</span>
        <input type="text" id="rutina-nombre" required placeholder="Calistenia, Máquinas, Estiramientos…" value="${esc(rutina?.nombre || "")}" />
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
            ejercicios = leerEjercicios(root);
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
      // Cada serie con SU peso: las primeras con chaleco y las últimas sin
      // él quedan apuntadas tal cual fueron.
      const pesos = [...f.querySelectorAll(`[data-peso="${idx}"]`)].map((i) => Number(i.value || 0));
      const series = [...f.querySelectorAll(`[data-reps="${idx}"]`)]
        .map((i, s) => ({ peso: pesos[s] ?? pesos[0] ?? 0, reps: Number(i.value || 0) }))
        .filter((x) => x.reps > 0);
      if (series.length) data.ejercicios.push({ nombre: plan.nombre, series });
    });
    if (data.ejercicios.length === 0) {
      root.querySelector("#entreno-error").textContent = "Apunta al menos una serie antes de guardar.";
      return;
    }
  } else {
    const nota = f.querySelector("#entreno-nota")?.value.trim();
    if (nota) data.nota = nota;
    const zonas = [...f.querySelectorAll("[data-zona].chip--on")].map((b) => b.dataset.zona);
    if (zonas.length) data.zonas = zonas;
    if (!data.duracion_min) {
      root.querySelector("#entreno-error").textContent = "Apunta cuántos minutos han sido.";
      return;
    }
  }
  try {
    await addEntreno(data);
    // Entreno guardado = borrador cumplido: se limpia para que no vuelva.
    clearTimeout(timerBorrador);
    guardarSistema({ entreno_borrador: null }).catch(() => {});
    efectoAlGuardar();
    renderVidaEntreno(null, true);
  } catch (err) {
    root.querySelector("#entreno-error").textContent = "No se pudo guardar. ¿Están publicadas las reglas nuevas de Firebase?";
  }
}

export function renderVidaEntreno(_state, forzar = false) {
  const el = document.getElementById("entreno-content");
  if (!el) return;
  // Con un borrador de HOY a medias, la pantalla vuelve sola a esa rutina
  // (salvo que el usuario haya elegido otra a mano en esta visita).
  const borHoy = borradorDeHoy();
  if (!tipoElegidoAMano && borHoy && TIPOS_ENTRENO.includes(borHoy.tipo)) tipoActivo = borHoy.tipo;
  if (!tipoActivo) tipoActivo = tipoDeHoy();
  if (!forzar && el.querySelector("#form-entreno") && formularioConDatos(el)) return;

  const esFuerza = Boolean(PLANES[tipoActivo]);
  const ultima = ultimoEntrenoDeTipo(tipoActivo);
  // El borrador solo rellena si es de hoy Y de la rutina que se está viendo.
  const bor = borHoy && borHoy.tipo === tipoActivo ? borHoy : null;
  const deHoy = vida.entrenos.filter((e) => e.fecha === fechaISO());
  const toca = SEMANA_TIPO[new Date().getDay()];

  const chips =
    TIPOS_ENTRENO.map(
      (t) => `<button type="button" class="chip ${t === tipoActivo ? "chip--on" : ""}" data-tipo-entreno="${t}">${esc(NOMBRE_TIPO_ENTRENO[t] || t)}</button>`
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
            <span class="ejercicio__nombre">${esc(plan.nombre)}${tecnicaDe(plan.nombre) ? ` <button type="button" class="info-btn" data-tecnica="${idx}" title="Cómo se hace">?</button>` : ""}</span>
            <span class="ejercicio__objetivo">${plan.series} × ${plan.repsMin === plan.repsMax ? plan.repsMax : `${plan.repsMin}–${plan.repsMax}`}${plan.etiqueta ? ` ${plan.etiqueta}` : ""}</span>
          </div>
          ${plan.nota ? `<p class="ejercicio__nota">${esc(plan.nota)}</p>` : ""}
          ${sug?.texto ? `<p class="ejercicio__sube"><i class="ph-fill ph-trend-up" aria-hidden="true"></i> ${sug.texto}</p>` : ""}
          <div class="ejercicio__series ejercicio__series--porserie">
            <div class="serie-col serie-col--leyenda"><span>&nbsp;</span><span>kg</span><span>${unidad === "reps" ? "reps" : unidad}</span></div>
            ${Array.from({ length: plan.series }, (_, s) => {
              // CADA serie lleva su kg: las primeras con el chaleco y las
              // últimas sin él, por ejemplo. El borrador manda si lo hay;
              // si no, el kg que se usó en ESA serie la última vez (o la
              // sugerencia de subir, cuando toca).
              const ult = (ultima?.ejercicios || []).find((x) => x.nombre === plan.nombre);
              const pesoSerie = bor ? (bor.pesos?.[`${idx}:${s}`] ?? "") : (sug?.texto ? sug.peso : (ult?.series?.[s]?.peso ?? peso));
              const repsSerie = bor ? (bor.reps?.[`${idx}:${s}`] ?? "") : "";
              const vPeso = pesoSerie === 0 ? "0" : pesoSerie || "";
              return `
              <div class="serie-col">
                <span>S${s + 1}</span>
                <input type="number" step="0.5" value="${vPeso}" data-peso="${idx}" data-serie="${s}" data-prefill="${vPeso}" title="Los kg de la serie ${s + 1}" />
                <input type="number" inputmode="numeric" placeholder="${unidad === "reps" ? plan.repsMin : plan.repsMax}" value="${repsSerie}" data-reps="${idx}" data-serie="${s}" data-prefill="${repsSerie}" />
              </div>`;
            }).join("")}
          </div>
        </div>`;
      })
      .join("");
  } else {
    cuerpo = `
      <p class="entity-card__meta">${
        tipoActivo === "piscina"
          ? "Mientras el crol no salga solo: la sesión para APRENDER que hay en la guía de abajo (drills incluidos). Cuando salga, se vuelve al 10 suave · 8×50 m · 10 suave. Las dos cuentan igual."
          : tipoActivo === "yoga"
            ? "La clase con la abuela (o una sesión en casa con un vídeo). Moverse cuenta, el nivel da igual."
            : esRutinaPropia(tipoActivo)
              ? "Sesión simple: apunta los minutos y, si quieres, una nota de qué hiciste."
              : "Cinta al 10–12 %, 5–5,5 km/h, sin agarrarse a las barras. Cualquier cuesta de la calle vale igual."
      }</p>
      ${tipoActivo === "piscina" ? `<button type="button" class="btn btn--ghost btn--sm" id="btn-tecnica-crol" style="margin-bottom:10px;">🏊 Técnica de crol y sesión para aprender</button>` : ""}
      ${
        sesionConZonas(tipoActivo)
          ? `
      <p class="field__label" style="margin:4px 0 6px;">¿Qué has trabajado o estirado? (opcional)</p>
      <div class="chips" style="margin-bottom:12px;">
        ${ZONAS_CUERPO.map((z) => `<button type="button" class="chip ${bor?.zonas?.includes(z) ? "chip--on" : ""}" data-zona="${z}">${z}</button>`).join("")}
      </div>`
          : ""
      }
      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" id="entreno-nota" placeholder="${tipoActivo === "piscina" ? "8×50 m a crol" : tipoActivo === "yoga" ? "Con la abuela" : "12 %, 5 km/h"}" value="${esc(bor?.nota || "")}" data-prefill="${esc(bor?.nota || "")}" />
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
        : esFuerza
          ? `<p class="entity-card__meta" style="margin:2px 0 10px;">${planRetocado(tipoActivo) ? "Con tus retoques" : "Plan de serie"} ·
            <button type="button" class="btn btn--ghost btn--sm" id="btn-editar-ejercicios">✎ Editar ejercicios</button>
            ${planRetocado(tipoActivo) ? `<button type="button" class="btn btn--ghost btn--sm" id="btn-plan-serie">Volver al de serie</button>` : ""}</p>`
          : ""
    }
    <div class="rutina-dias">
      <span class="entity-card__meta">Los días que toca:</span>
      ${[1, 2, 3, 4, 5, 6, 0]
        .map(
          (d) =>
            `<button type="button" class="chip chip--dia ${SEMANA_TIPO[d]?.tipo === tipoActivo ? "chip--on" : ""}" data-dia-rutina="${d}" title="Ahora: ${esc(SEMANA_TIPO[d]?.nombre || "—")}">${["D", "L", "M", "X", "J", "V", "S"][d]}</button>`
        )
        .join("")}
    </div>

    ${deHoy.length ? `<div class="card hoy-aviso"><p class="entity-card__meta" style="margin:0;">✓ Hoy ya has registrado: ${deHoy.map((e) => NOMBRE_TIPO_ENTRENO[e.tipo] || e.tipo).join(" + ")}</p></div>` : ""}

    <article class="card">
      <div id="form-entreno">
        ${cuerpo}
        <div class="form-grid" style="margin-top:12px;">
          <label class="field">
            <span class="field__label">Duración (min)</span>
            <input type="number" id="entreno-duracion" placeholder="75" value="${bor?.duracion || ""}" data-prefill="${bor?.duracion || ""}" />
          </label>
          ${esFuerza ? `<label class="field-check" style="align-self:end;">
            <input type="checkbox" id="entreno-lleno" ${bor?.lleno ? "checked" : ""} />
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
                  <span class="mini-row__sub">${esc(resumen || [(e.zonas || []).join(", "), e.nota, e.duracion_min ? e.duracion_min + " min" : ""].filter(Boolean).join(" · "))}</span>
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
