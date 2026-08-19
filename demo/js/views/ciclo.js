// Ciclo menstrual.
//
// Dos listas: "ciclos" (cuándo empezó y acabó cada regla) y "ciclo_notas"
// (qué pasó un día concreto: flujo, dolor, cómo te sentiste, si hubo
// relaciones y una nota libre). Los datos van a TU base de datos, detrás de
// tu contraseña: no salen a ningún sitio ni se comparten con nadie, ni
// siquiera con quien te montó la app.
//
// Tres decisiones que conviene entender:
//
// La previsión se calcula con la MEDIANA de tus últimos ciclos, no con la
// media. Un mes raro —de esos que pasan— desplaza mucho una media y casi
// nada una mediana, así que la previsión no se vuelve loca por un mes
// suelto.
//
// Hasta que no hay tres ciclos apuntados no se enseña ninguna previsión.
// Con uno o dos, el número saldría de la nada y daría una falsa sensación
// de exactitud. Mejor decir "todavía no tengo suficiente" que inventar.
//
// Y la ventana fértil se dibuja SIEMPRE con la advertencia al lado. Es una
// estimación calculada hacia atrás desde la siguiente regla prevista, que a
// su vez es otra estimación. No sirve como método anticonceptivo y la app
// lo dice en su propia pantalla.

import {
  addCiclos,
  updateCiclos,
  deleteCiclos,
  addCicloNotas,
  updateCicloNotas,
  deleteCicloNotas,
} from "../db.js?v=53";
import { openModal, closeModal } from "../modal.js?v=53";
import { icon } from "../icons.js?v=53";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=53";

const SENSACIONES = [
  "Bien",
  "Cansada",
  "Dolor de tripa",
  "Dolor de espalda",
  "Dolor de cabeza",
  "Hinchazón",
  "Pecho sensible",
  "Cambios de humor",
  "Ansiedad",
  "Antojos",
  "Acné",
  "Sin energía",
  "Con mucha energía",
  "He dormido mal",
];

const FLUJOS = [
  { id: "manchado", texto: "Manchado" },
  { id: "ligero", texto: "Ligero" },
  { id: "medio", texto: "Medio" },
  { id: "abundante", texto: "Abundante" },
];

const DOLORES = [
  { id: 0, texto: "Nada" },
  { id: 1, texto: "Poco" },
  { id: 2, texto: "Bastante" },
  { id: 3, texto: "Mucho" },
];

const PROTECCIONES = [
  { id: "con", texto: "Con protección" },
  { id: "sin", texto: "Sin protección" },
  { id: "nolodigo", texto: "Prefiero no ponerlo" },
];

const MINIMO_PARA_PREVER = 3;
// La ovulación cae, de media, unos 14 días ANTES de la siguiente regla. Se
// cuenta hacia atrás desde la previsión y no hacia adelante desde la última,
// porque esa segunda mitad del ciclo es la que menos varía entre personas.
const DIAS_ANTES_DE_OVULAR = 14;

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
// "agosto de 2026" con la primera en mayúscula. Con text-transform:
// capitalize salía "Agosto De 2026", y ese "De" con mayúscula canta.
const mesEnLetra = (fecha) => {
  const t = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(fecha);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const bonito = (iso) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long" }).format(aFecha(iso));
const escapar = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function mediana(numeros) {
  if (!numeros.length) return null;
  const orden = [...numeros].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : Math.round((orden[medio - 1] + orden[medio]) / 2);
}

// Qué mes se está mirando: 0 es el actual, -1 el anterior, 1 el siguiente.
// Vive aquí fuera porque el render se vuelve a llamar cada vez que cambian
// los datos, y si estuviera dentro se volvería al mes de hoy en cuanto
// apuntara algo.
let desplazamientoMes = 0;
let ultimoEstado = null;

export function mountCiclo() {
  document.getElementById("btn-add-ciclo").addEventListener("click", () => abrirFormulario());
}

export function renderCiclo(state) {
  ultimoEstado = state;
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
      <button type="button" class="btn btn--primary ciclo-accion" id="ciclo-empezar-hoy">Me ha venido hoy</button>
      <p class="entity-card__meta" style="margin-top:14px">Todo lo que apuntes aquí es tuyo y está en tu base de datos privada.</p>`;
    elResumen.querySelector("#ciclo-empezar-hoy").addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      await addCiclos({ inicio: hoy, fin: null });
    });
    pintarCalendario(ciclos, notas, null, null, null);
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
  const enRegla = hoy >= ultimo.inicio && (!ultimo.fin || hoy <= ultimo.fin);
  const sinCerrar = !ultimo.fin;
  const proxima = duracionTipica ? sumarDias(ultimo.inicio, duracionTipica) : null;
  const faltan = proxima ? diasEntre(hoy, proxima) : null;

  const sangrados = ciclos.filter((c) => c.fin).map((c) => diasEntre(c.inicio, c.fin) + 1);
  const sangradoTipico = sangrados.length ? mediana(sangrados) : null;

  // Ventana fértil: se cuenta hacia atrás desde la próxima regla prevista.
  // Los espermatozoides aguantan unos días, así que la ventana empieza antes
  // del día estimado de ovulación y acaba justo después.
  const ovulacion = proxima ? sumarDias(proxima, -DIAS_ANTES_DE_OVULAR) : null;
  const fertilDesde = ovulacion ? sumarDias(ovulacion, -5) : null;
  const fertilHasta = ovulacion ? sumarDias(ovulacion, 1) : null;

  // Botón grande de arriba: cambia según dónde estés del ciclo. Es lo que se
  // pulsa el 90 % de las veces que se entra aquí, así que va el primero y
  // grande, para acertar con el pulgar sin mirar.
  let accion = null;
  if (enRegla && sinCerrar) accion = { id: "cerrar", texto: "Ya se me ha ido" };
  else if (!enRegla) accion = { id: "empezar", texto: "Me ha venido hoy" };

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
        <p class="ciclo-dato__valor">${faltan === null ? "—" : faltan >= 0 ? faltan : Math.abs(faltan)}</p>
        <p class="ciclo-dato__etiqueta">${faltan === null ? "sin previsión" : faltan >= 0 ? "días para la próxima" : "días de retraso"}</p>
      </div>
    </div>
    ${accion ? `<button type="button" class="btn btn--primary ciclo-accion" data-accion="${accion.id}">${accion.texto}</button>` : ""}
    <button type="button" class="btn btn--ghost ciclo-accion ciclo-accion--suave" data-apuntar-hoy="1">Apuntar cómo estoy hoy</button>
    <p class="entity-card__meta" style="margin-top:14px">
      ${
        proxima
          ? `Según tus últimos ciclos, la próxima le tocaría alrededor del <strong>${bonito(proxima)}</strong>. Es una estimación a partir de lo que has apuntado, no una certeza: los ciclos cambian, y eso es normal.`
          : `Con ${ciclos.length} ${ciclos.length === 1 ? "ciclo apuntado" : "ciclos apuntados"} todavía no hay suficiente para una previsión honesta. A partir de ${MINIMO_PARA_PREVER} empieza a salir.`
      }
    </p>
    ${
      ovulacion
        ? `<p class="entity-card__meta" style="margin-top:8px">
             Los días con más probabilidad de embarazo estarían entre el <strong>${bonito(fertilDesde)}</strong> y el <strong>${bonito(fertilHasta)}</strong>, con la ovulación alrededor del ${bonito(ovulacion)}.
           </p>`
        : ""
    }
    <p class="ciclo-aviso">
      Esto no es un consejo médico ni sirve como método anticonceptivo: la previsión sale de tus propios apuntes y los ciclos cambian.
      Si algo te preocupa, díselo a tu médica o médico.
    </p>`;

  const botonAccion = elResumen.querySelector("[data-accion]");
  if (botonAccion) {
    botonAccion.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      try {
        if (botonAccion.dataset.accion === "cerrar") await updateCiclos(ultimo.id, { fin: hoy });
        // Si el último ciclo se quedó sin cerrar y ya empieza otro, se cierra
        // solo el día antes: si no, ese ciclo abierto se comería el nuevo y
        // los dos saldrían mal en el calendario y en las medias.
        else {
          if (sinCerrar && hoy > ultimo.inicio) await updateCiclos(ultimo.id, { fin: sumarDias(hoy, -1) });
          await addCiclos({ inicio: hoy, fin: null });
        }
      } finally {
        e.currentTarget.disabled = false;
      }
    });
  }
  elResumen
    .querySelector("[data-apuntar-hoy]")
    .addEventListener("click", () => abrirNota(hoy, notas.find((n) => n.fecha === hoy)));

  pintarCalendario(ciclos, notas, proxima, sangradoTipico, { fertilDesde, fertilHasta, ovulacion });

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
  // Se le pasa la lista, no la tarjeta entera: attachSwipe solo mira los
  // HIJOS DIRECTOS del elemento que recibe, y las filas cuelgan de
  // #ciclo-lista, no de la tarjeta.
  attachSwipe(document.getElementById("ciclo-lista"), (id) => deleteCiclos(id), {
    confirmar: "¿Borrar este ciclo del historial?",
  });
}

// ---- Calendario del mes: regla, previsión, días fértiles y lo apuntado
function pintarCalendario(ciclos, notas, proxima, sangradoTipico, fertil) {
  const hoy = hoyISO();
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + desplazamientoMes);
  const anio = base.getFullYear();
  const mes = base.getMonth();
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  // getDay() devuelve 0 para el domingo; aquí la semana empieza en lunes.
  const huecoInicial = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const notasPorFecha = new Map(notas.map((n) => [n.fecha, n]));

  const esDeRegla = (iso) => ciclos.some((c) => iso >= c.inicio && iso <= (c.fin || c.inicio));
  const esPrevista = (iso) =>
    proxima && sangradoTipico && iso >= proxima && iso <= sumarDias(proxima, sangradoTipico - 1);
  const esFertil = (iso) => fertil?.fertilDesde && iso >= fertil.fertilDesde && iso <= fertil.fertilHasta;

  const celdas = [];
  for (let i = 0; i < huecoInicial; i++) celdas.push(`<span class="rutina-celda is-vacia"></span>`);
  for (let d = 1; d <= diasDelMes; d++) {
    const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const nota = notasPorFecha.get(iso);
    const clases = ["rutina-celda", "ciclo-celda"];
    if (esDeRegla(iso)) clases.push("is-regla");
    else if (esPrevista(iso)) clases.push("is-prevista");
    else if (esFertil(iso)) clases.push("is-fertil");
    if (iso === hoy) clases.push("is-hoy");
    if (nota) clases.push("tiene-nota");

    // Los puntitos de debajo del número: uno por cada cosa apuntada. Se ve de
    // un vistazo qué días tienen algo sin tener que abrirlos uno a uno.
    const marcas = [];
    if (nota?.flujo) marcas.push(`<i class="ciclo-marca is-flujo is-${nota.flujo}"></i>`);
    if (nota?.dolor > 0) marcas.push(`<i class="ciclo-marca is-dolor"></i>`);
    if (nota?.relaciones) marcas.push(`<i class="ciclo-marca is-relaciones"></i>`);

    celdas.push(
      `<button type="button" class="${clases.join(" ")}" data-dia="${iso}" title="${bonito(iso)}">
         <span class="ciclo-celda__num">${d}</span>
         ${marcas.length ? `<span class="ciclo-marcas">${marcas.join("")}</span>` : ""}
       </button>`
    );
  }

  const titulo = mesEnLetra(base);

  const el = document.getElementById("ciclo-calendario");
  el.innerHTML = `
    <div class="ciclo-mes__barra">
      <button type="button" class="ciclo-mes__flecha" data-mes="-1" aria-label="Mes anterior">‹</button>
      <h2 class="card__title ciclo-mes__titulo">${titulo}</h2>
      <button type="button" class="ciclo-mes__flecha" data-mes="1" aria-label="Mes siguiente">›</button>
    </div>
    ${desplazamientoMes !== 0 ? `<button type="button" class="ciclo-mes__hoy" data-mes="0">Volver a este mes</button>` : ""}
    <div class="rutina-rejilla" style="margin-top:10px">
      ${["L", "M", "X", "J", "V", "S", "D"].map((x) => `<span class="rutina-celda is-titulo">${x}</span>`).join("")}
      ${celdas.join("")}
    </div>
    <div class="ciclo-leyenda">
      <span><i class="ciclo-punto is-regla"></i> Regla</span>
      <span><i class="ciclo-punto is-prevista"></i> Previsión</span>
      <span><i class="ciclo-punto is-fertil"></i> Días fértiles</span>
      <span><i class="ciclo-marca is-dolor"></i> Dolor</span>
      <span><i class="ciclo-marca is-relaciones"></i> Relaciones</span>
    </div>
    <p class="entity-card__meta" style="margin-top:10px">Toca cualquier día para apuntar lo que pasó.</p>`;

  el.querySelectorAll("[data-mes]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const paso = Number(btn.dataset.mes);
      desplazamientoMes = paso === 0 ? 0 : desplazamientoMes + paso;
      if (ultimoEstado) renderCiclo(ultimoEstado);
    })
  );
  el.querySelectorAll("[data-dia]").forEach((btn) =>
    btn.addEventListener("click", () => abrirNota(btn.dataset.dia, notasPorFecha.get(btn.dataset.dia)))
  );
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
  const dolor = nota?.dolor ?? 0;

  openModal(
    `
    <h2 class="modal__title">${bonito(fecha)}</h2>
    <form id="form-nota" class="form-grid">

      <div class="field field--full">
        <span class="field__label">Sangrado</span>
        <div class="ciclo-opciones">
          ${FLUJOS.map(
            (f) => `
            <label class="ciclo-opcion">
              <input type="radio" name="flujo" value="${f.id}" ${nota?.flujo === f.id ? "checked" : ""} />
              <span>${f.texto}</span>
            </label>`
          ).join("")}
          <label class="ciclo-opcion">
            <input type="radio" name="flujo" value="" ${!nota?.flujo ? "checked" : ""} />
            <span>Nada</span>
          </label>
        </div>
      </div>

      <div class="field field--full">
        <span class="field__label">Dolor</span>
        <div class="ciclo-opciones">
          ${DOLORES.map(
            (d) => `
            <label class="ciclo-opcion">
              <input type="radio" name="dolor" value="${d.id}" ${dolor === d.id ? "checked" : ""} />
              <span>${d.texto}</span>
            </label>`
          ).join("")}
        </div>
      </div>

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

      <div class="field field--full">
        <label class="ciclo-sensacion ciclo-sensacion--sola">
          <input type="checkbox" name="relaciones" id="ciclo-relaciones" ${nota?.relaciones ? "checked" : ""} />
          <span>Tuve relaciones</span>
        </label>
        <div class="ciclo-opciones ${nota?.relaciones ? "" : "is-hidden"}" id="ciclo-proteccion">
          ${PROTECCIONES.map(
            (p) => `
            <label class="ciclo-opcion">
              <input type="radio" name="proteccion" value="${p.id}" ${nota?.proteccion === p.id ? "checked" : ""} />
              <span>${p.texto}</span>
            </label>`
          ).join("")}
        </div>
      </div>

      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="texto" value="${escapar(nota?.texto)}" placeholder="Lo que quieras recordar de este día" />
      </label>

      <p class="field-error" id="form-nota-error"></p>
      <div class="modal__actions field--full">
        ${nota ? `<button type="button" class="btn btn--ghost btn--danger" id="btn-borrar">Borrar el día</button>` : ""}
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);

        // Lo de la protección solo aparece si marcó que hubo relaciones: si
        // no, son cuatro opciones ahí puestas que no vienen a cuento.
        const check = root.querySelector("#ciclo-relaciones");
        const proteccion = root.querySelector("#ciclo-proteccion");
        check.addEventListener("change", () => proteccion.classList.toggle("is-hidden", !check.checked));

        const borrar = root.querySelector("#btn-borrar");
        if (borrar) {
          borrar.addEventListener("click", async () => {
            if (!confirm("¿Borrar lo apuntado de este día?")) return;
            try {
              await deleteCicloNotas(nota.id);
              closeModal();
            } catch (err) {
              root.querySelector("#form-nota-error").textContent = "No se pudo borrar. Inténtalo de nuevo.";
            }
          });
        }

        root.querySelector("#form-nota").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const hubo = f.relaciones.checked;
          const datos = {
            fecha,
            flujo: f.flujo.value || null,
            dolor: Number(f.dolor.value || 0),
            sensaciones: [...f.querySelectorAll('[name="sensacion"]:checked')].map((c) => c.value),
            relaciones: hubo,
            proteccion: hubo ? f.proteccion.value || null : null,
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
