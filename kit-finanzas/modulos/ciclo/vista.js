// Ciclo menstrual.
//
// Dos listas: "ciclos" (cuándo empezó y acabó cada regla) y "ciclo_notas"
// (cómo te sentiste un día concreto). Los datos van a TU base de datos,
// detrás de tu contraseña: no salen a ningún sitio ni se comparten con
// nadie, ni siquiera con quien te montó la app.
//
// Dos decisiones que conviene entender:
//
// La previsión se calcula con la MEDIANA de tus últimos ciclos, no con la
// media. Un mes raro —de esos que pasan— desplaza mucho una media y casi
// nada una mediana, así que la previsión no se vuelve loca por un mes
// suelto.
//
// Y hasta que no hay tres ciclos apuntados no se enseña ninguna previsión.
// Con uno o dos, el número saldría de la nada y daría una falsa sensación
// de exactitud. Mejor decir "todavía no tengo suficiente" que inventar.

import { addCiclos, updateCiclos, deleteCiclos, addCicloNotas, updateCicloNotas } from "../db.js?v=[[V]]";
import { openModal, closeModal } from "../modal.js?v=[[V]]";
import { icon } from "../icons.js?v=[[V]]";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=[[V]]";

const SENSACIONES = ["Bien", "Cansada", "Dolor", "Hinchazón", "Cambios de humor", "Dolor de cabeza", "Antojos", "Sin energía"];
const MINIMO_PARA_PREVER = 3;

const aFecha = (iso) => new Date(iso + "T12:00:00");
const aISO = (d) => {
  const c = new Date(d);
  c.setHours(12, 0, 0, 0);
  return c.toISOString().slice(0, 10);
};
const hoyISO = () => aISO(new Date());
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
const sumarDias = (iso, n) => {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
};
const bonito = (iso) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long" }).format(aFecha(iso));

function mediana(numeros) {
  if (!numeros.length) return null;
  const orden = [...numeros].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : Math.round((orden[medio - 1] + orden[medio]) / 2);
}

export function mountCiclo() {
  document.getElementById("btn-add-ciclo").addEventListener("click", () => abrirFormulario());
}

export function renderCiclo(state) {
  const ciclos = [...(state.ciclos || [])].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  const notas = state.cicloNotas || [];
  const hoy = hoyISO();

  const elResumen = document.getElementById("ciclo-resumen");

  if (ciclos.length === 0) {
    elResumen.innerHTML = `
      <h2 class="card__title">Todavía no hay nada apuntado</h2>
      <p class="entity-card__meta" style="margin-bottom:14px">
        Apunta el primer día de tu última regla y a partir de ahí esto se va llenando solo.
        Con tres ciclos ya puede darte una previsión; con menos, prefiere no inventarse nada.
      </p>
      <p class="entity-card__meta">Todo lo que apuntes aquí es tuyo y está en tu base de datos privada.</p>`;
    document.getElementById("ciclo-calendario").innerHTML = "";
    document.getElementById("ciclo-historial").innerHTML = "";
    return;
  }

  // Duración de cada ciclo: del primer día de uno al primer día del siguiente.
  const duraciones = [];
  for (let i = 0; i < ciclos.length - 1; i++) {
    const d = diasEntre(ciclos[i + 1].inicio, ciclos[i].inicio);
    // Un ciclo de menos de 15 o más de 60 días casi siempre es una fecha mal
    // apuntada, y colarlo estropearía la previsión de todo lo demás.
    if (d >= 15 && d <= 60) duraciones.push(d);
  }
  const duracionTipica = duraciones.length >= MINIMO_PARA_PREVER - 1 ? mediana(duraciones) : null;

  const ultimo = ciclos[0];
  const diasDesde = diasEntre(ultimo.inicio, hoy);
  const enRegla = !ultimo.fin || hoy <= ultimo.fin;
  const proxima = duracionTipica ? sumarDias(ultimo.inicio, duracionTipica) : null;
  const faltan = proxima ? diasEntre(hoy, proxima) : null;

  const sangrados = ciclos.filter((c) => c.fin).map((c) => diasEntre(c.inicio, c.fin) + 1);
  const sangradoTipico = sangrados.length ? mediana(sangrados) : null;

  elResumen.innerHTML = `
    <div class="card__header">
      <h2 class="card__title">${enRegla ? "Estás con la regla" : "Día " + (diasDesde + 1) + " del ciclo"}</h2>
      <span class="entity-card__tag">${ciclos.length} ${ciclos.length === 1 ? "ciclo" : "ciclos"}</span>
    </div>
    <div class="ciclo-datos">
      <div class="ciclo-dato">
        <p class="ciclo-dato__valor">${duracionTipica ?? "—"}</p>
        <p class="ciclo-dato__etiqueta">días de ciclo${duracionTipica ? "" : " (aún sin datos)"}</p>
      </div>
      <div class="ciclo-dato">
        <p class="ciclo-dato__valor">${sangradoTipico ?? "—"}</p>
        <p class="ciclo-dato__etiqueta">días de regla</p>
      </div>
      <div class="ciclo-dato">
        <p class="ciclo-dato__valor">${faltan === null ? "—" : faltan >= 0 ? faltan : "?"}</p>
        <p class="ciclo-dato__etiqueta">${faltan === null ? "sin previsión" : faltan >= 0 ? "días para la próxima" : "de retraso"}</p>
      </div>
    </div>
    <p class="entity-card__meta" style="margin-top:14px">
      ${
        proxima
          ? `Según tus últimos ciclos, la próxima le tocaría alrededor del <strong>${bonito(proxima)}</strong>. Es una estimación a partir de lo que has apuntado, no una certeza: los ciclos cambian, y eso es normal.`
          : `Con ${ciclos.length} ${ciclos.length === 1 ? "ciclo apuntado" : "ciclos apuntados"} todavía no hay suficiente para una previsión honesta. A partir de ${MINIMO_PARA_PREVER} empieza a salir.`
      }
    </p>
    <p class="entity-card__meta" style="margin-top:8px; opacity:.75">
      Esto no es un consejo médico ni sirve como método anticonceptivo. Si algo te preocupa, díselo a tu médica o médico.
    </p>`;

  // ---- Calendario del mes: regla, previsión y cómo te sentiste
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth();
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  const huecoInicial = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const notasPorFecha = new Map(notas.map((n) => [n.fecha, n]));

  const esDeRegla = (iso) => ciclos.some((c) => iso >= c.inicio && iso <= (c.fin || c.inicio));
  const esPrevista = (iso) =>
    proxima && sangradoTipico && iso >= proxima && iso <= sumarDias(proxima, sangradoTipico - 1);

  const celdas = [];
  for (let i = 0; i < huecoInicial; i++) celdas.push(`<span class="rutina-celda is-vacia"></span>`);
  for (let d = 1; d <= diasDelMes; d++) {
    const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const clases = ["rutina-celda", "ciclo-celda"];
    if (esDeRegla(iso)) clases.push("is-regla");
    else if (esPrevista(iso)) clases.push("is-prevista");
    if (iso === hoy) clases.push("is-hoy");
    if (notasPorFecha.has(iso)) clases.push("tiene-nota");
    celdas.push(`<button type="button" class="${clases.join(" ")}" data-dia="${iso}" title="${bonito(iso)}">${d}</button>`);
  }

  document.getElementById("ciclo-calendario").innerHTML = `
    <h2 class="card__title">${new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(ahora)}</h2>
    <div class="rutina-rejilla" style="margin-top:10px">
      ${["L", "M", "X", "J", "V", "S", "D"].map((x) => `<span class="rutina-celda is-titulo">${x}</span>`).join("")}
      ${celdas.join("")}
    </div>
    <div class="ciclo-leyenda">
      <span><i class="ciclo-punto is-regla"></i> Regla</span>
      <span><i class="ciclo-punto is-prevista"></i> Previsión</span>
      <span><i class="ciclo-punto tiene-nota"></i> Con nota</span>
    </div>
    <p class="entity-card__meta" style="margin-top:10px">Toca un día para apuntar cómo te sentiste.</p>`;

  document
    .getElementById("ciclo-calendario")
    .querySelectorAll("[data-dia]")
    .forEach((btn) => btn.addEventListener("click", () => abrirNota(btn.dataset.dia, notasPorFecha.get(btn.dataset.dia))));

  // ---- Historial
  document.getElementById("ciclo-historial").innerHTML = `
    <h2 class="card__title">Historial</h2>
    <div id="ciclo-lista">
      ${ciclos
        .map((c, i) => {
          const dias = c.fin ? diasEntre(c.inicio, c.fin) + 1 : null;
          const siguiente = ciclos[i - 1];
          const duracion = siguiente ? diasEntre(c.inicio, siguiente.inicio) : null;
          return wrapSwipe(
            `
            <div class="entity-row">
              <div class="entity-row__body">
                <p class="entity-row__name">${bonito(c.inicio)}${c.fin ? " – " + bonito(c.fin) : " · sin fecha de fin"}</p>
                <p class="entity-row__meta">
                  ${dias ? `${dias} ${dias === 1 ? "día" : "días"} de regla` : "Todavía sin cerrar"}${
                    duracion ? ` · ciclo de ${duracion} días` : ""
                  }
                </p>
              </div>
              <button type="button" class="row-edit-btn" data-edit="${c.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>`,
            c.id
          );
        })
        .join("")}
    </div>`;

  const elHistorial = document.getElementById("ciclo-historial");
  elHistorial
    .querySelectorAll("[data-edit]")
    .forEach((btn) => btn.addEventListener("click", () => abrirFormulario(ciclos.find((c) => c.id === btn.dataset.edit))));
  attachSwipe(elHistorial, (id) => deleteCiclos(id), { confirmar: "¿Borrar este ciclo del historial?" });
}

function abrirFormulario(ciclo) {
  const editando = Boolean(ciclo);
  openModal(
    `
    <h2 class="modal__title">${editando ? "Editar ciclo" : "Apuntar regla"}</h2>
    <form id="form-ciclo" class="form-grid">
      <label class="field">
        <span class="field__label">Primer día</span>
        <input type="date" name="inicio" required value="${ciclo?.inicio ?? hoyISO()}" />
      </label>
      <label class="field">
        <span class="field__label">Último día (si ya acabó)</span>
        <input type="date" name="fin" value="${ciclo?.fin ?? ""}" />
      </label>
      <p class="field-error" id="form-ciclo-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${editando ? "Guardar" : "Apuntar"}</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-ciclo").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const error = root.querySelector("#form-ciclo-error");
          const datos = { inicio: f.inicio.value, fin: f.fin.value || null };
          // Un fin anterior al inicio pondría duraciones negativas en todos
          // los cálculos, así que se para aquí y se dice por qué.
          if (datos.fin && datos.fin < datos.inicio) {
            error.textContent = "El último día no puede ser anterior al primero.";
            return;
          }
          try {
            if (editando) await updateCiclos(ciclo.id, datos);
            else await addCiclos(datos);
            closeModal();
          } catch (err) {
            error.textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function abrirNota(fecha, nota) {
  const marcadas = new Set(nota?.sensaciones || []);
  openModal(
    `
    <h2 class="modal__title">${bonito(fecha)}</h2>
    <form id="form-nota" class="form-grid">
      <div class="field field--full">
        <span class="field__label">¿Cómo te sentiste?</span>
        <div class="ciclo-sensaciones">
          ${SENSACIONES.map(
            (s) => `
            <label class="ciclo-sensacion">
              <input type="checkbox" name="sensacion" value="${s}" ${marcadas.has(s) ? "checked" : ""} />
              <span>${s}</span>
            </label>`
          ).join("")}
        </div>
      </div>
      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="texto" value="${(nota?.texto ?? "").replace(/"/g, "&quot;")}" placeholder="Lo que quieras recordar de este día" />
      </label>
      <p class="field-error" id="form-nota-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-nota").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const datos = {
            fecha,
            sensaciones: [...f.querySelectorAll('[name="sensacion"]:checked')].map((c) => c.value),
            texto: f.texto.value.trim(),
          };
          try {
            if (nota) await updateCicloNotas(nota.id, datos);
            else await addCicloNotas(datos);
            closeModal();
          } catch (err) {
            root.querySelector("#form-nota-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
