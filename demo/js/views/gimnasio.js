// Gimnasio: los días que vas, tus metas, tu peso y tus suplementos.
//
// Cinco listas en la base de datos:
//
//   gym_sesiones     un apunte por día que vas, con qué entrenaste
//   gym_metas        lo que quieres conseguir, con su forma de medirlo
//   gym_pesos        tu peso, con la fecha
//   gym_suplementos  creatina, proteína, lo que tomes, con su dosis
//   gym_tomas        una marca por cada día que te tomas cada uno
//
// Sesiones y tomas se guardan como una marca por día, no como un contador.
// Así se puede desmarcar sin que se descuadre nada, y el calendario del mes
// se dibuja leyendo esas mismas marcas.
//
// Las metas se miden solas siempre que se pueda. Una meta de "ir 4 días a la
// semana" no se marca a mano: se cuenta con las sesiones que ya hay. Una de
// "llegar a 72 kg" se mide con los pesos apuntados. Solo las que no se
// pueden medir con nada se marcan a mano, y esas se dicen aparte, porque una
// barra de progreso que rellenas tú no mide nada.

import {
  addGymSesiones,
  updateGymSesiones,
  deleteGymSesiones,
  addGymMetas,
  updateGymMetas,
  deleteGymMetas,
  addGymPesos,
  updateGymPesos,
  deleteGymPesos,
  addGymSuplementos,
  updateGymSuplementos,
  deleteGymSuplementos,
  addGymTomas,
  deleteGymTomas,
} from "../db.js?v=83";
import { openModal, closeModal } from "../modal.js?v=83";
import { icon } from "../icons.js?v=83";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=83";

const TIPOS = ["Pesas", "Piernas", "Torso", "Full body", "Cardio", "Clase", "Otro"];
const SENSACIONES = ["Muy bien", "Normal", "Con poca fuerza", "Agotado"];

const MEDIDAS = [
  { id: "dias_semana", texto: "Ir X días por semana", unidad: "días", ayuda: "Se cuenta solo con los días que apuntes." },
  { id: "peso", texto: "Llegar a X kg", unidad: "kg", ayuda: "Se mide solo con los pesos que apuntes abajo." },
  { id: "libre", texto: "Otra cosa", unidad: "", ayuda: "Esta la marcas tú a mano cuando la consigas." },
];

const aFecha = (iso) => new Date(iso + "T12:00:00");
const aISO = (d) => {
  const c = new Date(d);
  c.setHours(12, 0, 0, 0);
  return c.toISOString().slice(0, 10);
};
const hoyISO = () => aISO(new Date());
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
const bonito = (iso) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(aFecha(iso));
const escapar = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// El lunes de la semana de una fecha. La semana empieza en lunes, no en
// domingo: es lo que espera cualquiera aquí, y getDay() cuenta al revés.
function lunesDe(iso) {
  const d = aFecha(iso);
  const desplazamiento = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desplazamiento);
  return aISO(d);
}

// Cuántos días seguidos, contando hacia atrás desde hoy. Si hoy todavía no
// está marcado no se rompe la racha: se empieza a contar desde ayer, porque
// a las nueve de la mañana nadie ha ido aún y ver un cero ahí desanima.
function racha(fechas) {
  const hechas = new Set(fechas);
  let dia = hoyISO();
  if (!hechas.has(dia)) dia = sumarDias(dia, -1);
  let cuenta = 0;
  while (hechas.has(dia)) {
    cuenta++;
    dia = sumarDias(dia, -1);
  }
  return cuenta;
}

// Qué mes se está mirando en el calendario: 0 es el actual. Vive fuera del
// render porque el render se vuelve a llamar cada vez que cambian los datos,
// y si estuviera dentro volvería al mes de hoy en cuanto apuntara algo.
let desplazamientoMes = 0;
let ultimoEstado = null;

export function mountGimnasio() {
  document.getElementById("btn-add-sesion").addEventListener("click", () => abrirSesion());
}

export function renderGimnasio(state) {
  ultimoEstado = state;
  const sesiones = [...(state.gymSesiones || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const metas = state.gymMetas || [];
  const pesos = [...(state.gymPesos || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const suplementos = state.gymSuplementos || [];
  const tomas = state.gymTomas || [];
  const hoy = hoyISO();

  const fechasSesion = new Map(sesiones.map((s) => [s.fecha, s]));

  pintarHoy(sesiones, fechasSesion, hoy);
  pintarMes(fechasSesion, hoy);
  pintarMetas(metas, sesiones, pesos, hoy);
  pintarPeso(pesos);
  pintarSuplementos(suplementos, tomas, hoy);
}

// ---------------------------------------------------------------- hoy
function pintarHoy(sesiones, fechasSesion, hoy) {
  const el = document.getElementById("gimnasio-hoy");
  const fueHoy = fechasSesion.get(hoy);
  const lunes = lunesDe(hoy);
  const estaSemana = sesiones.filter((s) => s.fecha >= lunes && s.fecha <= hoy).length;
  const esteMes = sesiones.filter((s) => s.fecha.startsWith(hoy.slice(0, 7))).length;
  const r = racha(sesiones.map((s) => s.fecha));

  el.innerHTML = `
    <div class="card__header">
      <h2 class="card__title">${fueHoy ? "Hoy has ido" : "Hoy todavía no"}</h2>
      <span class="entity-card__tag">${sesiones.length} en total</span>
    </div>
    <div class="gym-datos">
      <div class="gym-dato">
        <p class="gym-dato__valor">${estaSemana}</p>
        <p class="gym-dato__etiqueta">esta semana</p>
      </div>
      <div class="gym-dato">
        <p class="gym-dato__valor">${esteMes}</p>
        <p class="gym-dato__etiqueta">este mes</p>
      </div>
      <div class="gym-dato">
        <p class="gym-dato__valor">${r}</p>
        <p class="gym-dato__etiqueta">${r === 1 ? "día seguido" : "días seguidos"}</p>
      </div>
    </div>
    <button type="button" class="btn ${fueHoy ? "btn--ghost" : "btn--primary"} gym-accion" id="gym-hoy">
      ${fueHoy ? "Quitar la sesión de hoy" : "He ido hoy"}
    </button>
    ${
      fueHoy
        ? `<button type="button" class="btn btn--ghost gym-accion gym-accion--suave" id="gym-detalle">
             ${fueHoy.tipo ? "Cambiar el detalle de hoy" : "Añadir qué entrenaste"}
           </button>
           <p class="entity-card__meta" style="margin-top:12px">
             ${fueHoy.tipo ? escapar(fueHoy.tipo) : "Sin detalle"}${fueHoy.duracion ? ` · ${fueHoy.duracion} min` : ""}${
               fueHoy.sensacion ? ` · ${escapar(fueHoy.sensacion)}` : ""
             }
           </p>`
        : `<p class="entity-card__meta" style="margin-top:12px">
             Un toque y ya está. El detalle —qué entrenaste, cuánto, cómo te encontraste— lo puedes añadir después, o no añadirlo nunca.
           </p>`
    }`;

  el.querySelector("#gym-hoy").addEventListener("click", async (e) => {
    // Se bloquea mientras va y viene: dos toques seguidos crearían dos
    // sesiones del mismo día y el calendario empezaría a contar de más.
    e.currentTarget.disabled = true;
    try {
      if (fueHoy) await deleteGymSesiones(fueHoy.id);
      else await addGymSesiones({ fecha: hoy, tipo: null, duracion: null, sensacion: null, notas: "" });
    } finally {
      e.currentTarget.disabled = false;
    }
  });
  el.querySelector("#gym-detalle")?.addEventListener("click", () => abrirSesion(fueHoy));
}

// ---------------------------------------------------------------- el mes
function pintarMes(fechasSesion, hoy) {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + desplazamientoMes);
  const anio = base.getFullYear();
  const mes = base.getMonth();
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  // getDay() devuelve 0 para el domingo; aquí la semana empieza en lunes.
  const huecoInicial = (new Date(anio, mes, 1).getDay() + 6) % 7;

  const celdas = [];
  for (let i = 0; i < huecoInicial; i++) celdas.push(`<span class="rutina-celda is-vacia"></span>`);
  for (let d = 1; d <= diasDelMes; d++) {
    const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const sesion = fechasSesion.get(iso);
    const clases = ["rutina-celda", "gym-celda"];
    if (sesion) clases.push("is-hecha");
    if (iso === hoy) clases.push("is-hoy");
    if (iso > hoy) clases.push("is-futura");
    const titulo = sesion ? `${bonito(iso)}${sesion.tipo ? " · " + sesion.tipo : ""}` : bonito(iso);
    celdas.push(`<button type="button" class="${clases.join(" ")}" data-dia="${iso}" title="${escapar(titulo)}">${d}</button>`);
  }

  const cuenta = [...fechasSesion.keys()].filter((f) => f.startsWith(`${anio}-${String(mes + 1).padStart(2, "0")}`)).length;

  const el = document.getElementById("gimnasio-mes");
  el.innerHTML = `
    <div class="gym-mes__barra">
      <button type="button" class="gym-mes__flecha" data-mes="-1" aria-label="Mes anterior">‹</button>
      <h2 class="card__title gym-mes__titulo">${mesEnLetra(base)}</h2>
      <button type="button" class="gym-mes__flecha" data-mes="1" aria-label="Mes siguiente">›</button>
    </div>
    <p class="entity-card__meta" style="text-align:center; margin-top:4px">${cuenta} ${cuenta === 1 ? "día" : "días"} de ${diasDelMes}</p>
    ${desplazamientoMes !== 0 ? `<button type="button" class="gym-mes__hoy" data-mes="0">Volver a este mes</button>` : ""}
    <div class="rutina-rejilla" style="margin-top:10px">
      ${["L", "M", "X", "J", "V", "S", "D"].map((x) => `<span class="rutina-celda is-titulo">${x}</span>`).join("")}
      ${celdas.join("")}
    </div>
    <p class="entity-card__meta" style="margin-top:10px">Toca un día para apuntarlo o para corregirlo.</p>`;

  el.querySelectorAll("[data-mes]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const paso = Number(btn.dataset.mes);
      desplazamientoMes = paso === 0 ? 0 : desplazamientoMes + paso;
      if (ultimoEstado) renderGimnasio(ultimoEstado);
    })
  );
  el.querySelectorAll("[data-dia]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const iso = btn.dataset.dia;
      const sesion = fechasSesion.get(iso);
      abrirSesion(sesion || { fecha: iso });
    })
  );
}

// ---------------------------------------------------------------- metas
function pintarMetas(metas, sesiones, pesos, hoy) {
  const el = document.getElementById("gimnasio-metas");

  const cabecera = `
    <div class="card__header">
      <h2 class="card__title">Mis metas</h2>
      <button type="button" class="btn btn--ghost btn--sm" id="gym-add-meta">+ Meta</button>
    </div>`;

  if (metas.length === 0) {
    el.innerHTML = `${cabecera}
      <p class="empty-state">
        Todavía no tienes ninguna. Una meta puede ser "ir 4 días por semana", "llegar a 72 kg"
        o cualquier otra cosa que quieras conseguir. Las dos primeras se miden solas con lo que apuntes.
      </p>`;
    el.querySelector("#gym-add-meta").addEventListener("click", () => abrirMeta());
    return;
  }

  const lunes = lunesDe(hoy);
  const estaSemana = sesiones.filter((s) => s.fecha >= lunes && s.fecha <= hoy).length;
  const pesoActual = pesos[0]?.kg ?? null;
  const pesoInicial = pesos[pesos.length - 1]?.kg ?? null;

  el.innerHTML = `${cabecera}
    <div id="gym-metas-lista">
      ${metas
        .map((m) => {
          const { texto, porcentaje, conseguida } = progresoMeta(m, { estaSemana, pesoActual, pesoInicial });
          return wrapSwipe(
            `
            <div class="entity-row gym-meta">
              ${
                m.medida === "libre"
                  ? `<button type="button" class="gym-check ${m.hecha ? "is-hecho" : ""}" data-marcar="${m.id}"
                             aria-pressed="${!!m.hecha}" aria-label="${m.hecha ? "Desmarcar" : "Marcar"} ${escapar(m.texto)}">
                       ${m.hecha ? "✓" : ""}
                     </button>`
                  : ""
              }
              <div class="entity-row__body">
                <p class="entity-row__name">${escapar(m.texto)}</p>
                <p class="entity-row__meta">${texto}</p>
                ${
                  porcentaje === null
                    ? ""
                    : `<div class="progress-track gym-barra">
                         <div class="progress-fill" style="width:${Math.min(100, Math.max(0, porcentaje))}%"></div>
                       </div>`
                }
              </div>
              ${conseguida ? `<span class="entity-card__tag entity-card__tag--activo">Hecho</span>` : ""}
              <button type="button" class="row-edit-btn" data-edit="${m.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>`,
            m.id
          );
        })
        .join("")}
    </div>`;

  el.querySelector("#gym-add-meta").addEventListener("click", () => abrirMeta());
  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => abrirMeta(metas.find((m) => m.id === btn.dataset.edit)))
  );
  el.querySelectorAll("[data-marcar]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const meta = metas.find((m) => m.id === btn.dataset.marcar);
      btn.disabled = true;
      try {
        await updateGymMetas(meta.id, { hecha: !meta.hecha });
      } finally {
        btn.disabled = false;
      }
    })
  );
  // attachSwipe solo mira los HIJOS DIRECTOS del elemento que recibe, así que
  // hay que pasarle la lista y no la tarjeta que la contiene.
  attachSwipe(document.getElementById("gym-metas-lista"), (id) => deleteGymMetas(id), { confirmar: "¿Borrar esta meta?" });
}

function progresoMeta(meta, { estaSemana, pesoActual, pesoInicial }) {
  if (meta.medida === "dias_semana") {
    const objetivo = Number(meta.objetivo) || 0;
    if (!objetivo) return { texto: "Sin objetivo puesto", porcentaje: null, conseguida: false };
    return {
      texto: `${estaSemana} de ${objetivo} días esta semana`,
      porcentaje: (estaSemana / objetivo) * 100,
      conseguida: estaSemana >= objetivo,
    };
  }

  if (meta.medida === "peso") {
    const objetivo = Number(meta.objetivo);
    if (!objetivo) return { texto: "Sin objetivo puesto", porcentaje: null, conseguida: false };
    if (pesoActual === null) return { texto: "Apunta tu peso abajo y esto se calcula solo", porcentaje: null, conseguida: false };

    const faltan = Math.abs(objetivo - pesoActual);
    // El progreso se mide desde el primer peso apuntado hasta el objetivo. Si
    // solo hay uno, no hay recorrido que medir todavía: se dice lo que falta y
    // no se dibuja una barra que no significaría nada.
    const recorridoTotal = pesoInicial === null ? 0 : Math.abs(objetivo - pesoInicial);
    const recorrido = pesoInicial === null ? 0 : Math.abs(pesoActual - pesoInicial);
    const conseguida = faltan < 0.25;
    return {
      texto: conseguida
        ? `Estás en ${pesoActual} kg. Conseguido.`
        : `${pesoActual} kg ahora · te faltan ${faltan.toFixed(1)} kg para ${objetivo}`,
      porcentaje: recorridoTotal > 0 ? (recorrido / recorridoTotal) * 100 : null,
      conseguida,
    };
  }

  return {
    texto: meta.hecha ? "Conseguida" : "Márcala tú cuando la consigas",
    porcentaje: null,
    conseguida: !!meta.hecha,
  };
}

// ---------------------------------------------------------------- peso
function pintarPeso(pesos) {
  const el = document.getElementById("gimnasio-peso");
  const cabecera = `
    <div class="card__header">
      <h2 class="card__title">Mi peso</h2>
      <button type="button" class="btn btn--ghost btn--sm" id="gym-add-peso">+ Apuntar</button>
    </div>`;

  if (pesos.length === 0) {
    el.innerHTML = `${cabecera}
      <p class="empty-state">Cuando apuntes tu peso un par de veces, aquí sale la evolución.</p>`;
    el.querySelector("#gym-add-peso").addEventListener("click", () => abrirPeso());
    return;
  }

  const actual = pesos[0];
  // Se compara con el apunte más cercano a hace 30 días, no con el anterior:
  // si te pesas cada día, la diferencia con ayer es ruido de báscula y no
  // dice nada. A un mes vista sí se ve por dónde va la cosa.
  const haceUnMes = sumarDias(actual.fecha, -30);
  const anterior = pesos.find((p) => p.fecha <= haceUnMes) || pesos[pesos.length - 1];
  const diferencia = anterior && anterior.id !== actual.id ? actual.kg - anterior.kg : null;

  // Las últimas doce medidas, de la más antigua a la más reciente.
  const ultimos = pesos.slice(0, 12).reverse();
  const soloDia = (isoFecha) => String(Number(isoFecha.slice(8, 10)));
  const valores = ultimos.map((p) => p.kg);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  // Si todas las medidas son iguales, dividir por (max - min) sería dividir
  // por cero: en ese caso todas las barras van a media altura.
  const alto = (kg) => (max === min ? 50 : 12 + ((kg - min) / (max - min)) * 76);

  el.innerHTML = `${cabecera}
    <div class="gym-peso__ahora">
      <p class="entity-card__amount">${actual.kg} kg</p>
      <p class="entity-card__meta">
        ${bonito(actual.fecha)}${
          diferencia === null
            ? ""
            : ` · <span class="${diferencia > 0 ? "gym-sube" : diferencia < 0 ? "gym-baja" : ""}">${
                diferencia > 0 ? "+" : ""
              }${diferencia.toFixed(1)} kg</span> desde ${bonito(anterior.fecha)}`
        }
      </p>
    </div>
    ${
      ultimos.length > 1
        ? `<div class="gym-grafico" role="img" aria-label="Evolución de tu peso en las últimas ${ultimos.length} medidas">
             ${ultimos
               .map(
                 (p) => `
               <div class="gym-barra-col" title="${bonito(p.fecha)}: ${p.kg} kg">
                 <div class="gym-barra-val" style="height:${alto(p.kg)}%"></div>
                 <span class="gym-barra-pie">${soloDia(p.fecha)}</span>
               </div>`
               )
               .join("")}
           </div>
           <p class="entity-card__meta gym-grafico__pie">Del ${bonito(ultimos[0].fecha)} al ${bonito(ultimos[ultimos.length - 1].fecha)} · de ${min} a ${max} kg</p>`
        : ""
    }
    <div id="gym-pesos-lista" class="gym-lista-pesos">
      ${pesos
        .slice(0, 8)
        .map((p) =>
          wrapSwipe(
            `
          <div class="entity-row">
            <div class="entity-row__body">
              <p class="entity-row__name">${p.kg} kg</p>
              <p class="entity-row__meta">${bonito(p.fecha)}${p.notas ? " · " + escapar(p.notas) : ""}</p>
            </div>
            <button type="button" class="row-edit-btn" data-edit-peso="${p.id}" title="Editar">${icon("edit", { size: 15 })}</button>
          </div>`,
            p.id
          )
        )
        .join("")}
    </div>`;

  el.querySelector("#gym-add-peso").addEventListener("click", () => abrirPeso());
  el.querySelectorAll("[data-edit-peso]").forEach((btn) =>
    btn.addEventListener("click", () => abrirPeso(pesos.find((p) => p.id === btn.dataset.editPeso)))
  );
  attachSwipe(document.getElementById("gym-pesos-lista"), (id) => deleteGymPesos(id), { confirmar: "¿Borrar esta medida?" });
}

// ---------------------------------------------------------------- suplementos
function pintarSuplementos(suplementos, tomas, hoy) {
  const el = document.getElementById("gimnasio-suplementos");
  const cabecera = `
    <div class="card__header">
      <h2 class="card__title">Suplementos</h2>
      <button type="button" class="btn btn--ghost btn--sm" id="gym-add-sup">+ Añadir</button>
    </div>`;

  if (suplementos.length === 0) {
    el.innerHTML = `${cabecera}
      <p class="empty-state">
        Si tomas creatina, proteína o cualquier otra cosa, añádela aquí y te queda el botón de marcarla cada día.
      </p>`;
    el.querySelector("#gym-add-sup").addEventListener("click", () => abrirSuplemento());
    return;
  }

  const porSuplemento = new Map();
  tomas.forEach((t) => {
    if (!porSuplemento.has(t.suplemento_id)) porSuplemento.set(t.suplemento_id, new Map());
    porSuplemento.get(t.suplemento_id).set(t.fecha, t.id);
  });

  const marcadosHoy = suplementos.filter((s) => porSuplemento.get(s.id)?.has(hoy)).length;

  el.innerHTML = `
    <div class="card__header">
      <h2 class="card__title">Suplementos</h2>
      <span class="entity-card__tag">${marcadosHoy} de ${suplementos.length} hoy</span>
    </div>
    <div id="gym-sup-lista">
      ${suplementos
        .map((s) => {
          const dias = porSuplemento.get(s.id) || new Map();
          const tomado = dias.has(hoy);
          const r = racha([...dias.keys()]);
          return wrapSwipe(
            `
            <div class="entity-row">
              <button type="button" class="gym-check ${tomado ? "is-hecho" : ""}" data-tomar="${s.id}"
                      aria-pressed="${tomado}" aria-label="${tomado ? "Desmarcar" : "Marcar"} ${escapar(s.nombre)}">
                ${tomado ? "✓" : ""}
              </button>
              <div class="entity-row__body">
                <p class="entity-row__name">${escapar(s.nombre)}</p>
                <p class="entity-row__meta">
                  ${s.dosis ? escapar(s.dosis) : "Sin dosis apuntada"}${s.cuando ? " · " + escapar(s.cuando) : ""}
                  ${r > 0 ? ` · ${r} ${r === 1 ? "día seguido" : "días seguidos"}` : ""}
                </p>
              </div>
              <button type="button" class="row-edit-btn" data-edit-sup="${s.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>`,
            s.id
          );
        })
        .join("")}
    </div>
    <button type="button" class="btn btn--ghost gym-accion gym-accion--suave" id="gym-add-sup">+ Añadir otro</button>`;

  el.querySelector("#gym-add-sup").addEventListener("click", () => abrirSuplemento());
  el.querySelectorAll("[data-edit-sup]").forEach((btn) =>
    btn.addEventListener("click", () => abrirSuplemento(suplementos.find((s) => s.id === btn.dataset.editSup)))
  );
  el.querySelectorAll("[data-tomar]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.tomar;
      const dias = porSuplemento.get(id) || new Map();
      btn.disabled = true;
      try {
        if (dias.has(hoy)) await deleteGymTomas(dias.get(hoy));
        else await addGymTomas({ suplemento_id: id, fecha: hoy });
      } finally {
        btn.disabled = false;
      }
    })
  );
  attachSwipe(document.getElementById("gym-sup-lista"), (id) => deleteGymSuplementos(id), {
    confirmar: "¿Quitar este suplemento? Los días que ya marcaste se quedan guardados.",
  });
}

// ---------------------------------------------------------------- formularios

function abrirSesion(sesion) {
  const editando = Boolean(sesion?.id);
  const tipoConocido = !sesion?.tipo || TIPOS.includes(sesion.tipo);
  openModal(
    `
    <h2 class="modal__title">${editando ? "La sesión" : "Apuntar sesión"}</h2>
    <form id="form-sesion" class="form-grid">
      <label class="field">
        <span class="field__label">Día</span>
        <input type="date" name="fecha" required value="${sesion?.fecha ?? hoyISO()}" />
      </label>
      <label class="field">
        <span class="field__label">Cuánto (minutos)</span>
        <input type="number" name="duracion" min="1" max="600" step="5" value="${sesion?.duracion ?? ""}" placeholder="60" />
      </label>

      <div class="field field--full">
        <span class="field__label">¿Qué entrenaste?</span>
        <div class="gym-opciones">
          ${TIPOS.map(
            (t) => `
            <label class="gym-opcion">
              <input type="radio" name="tipo" value="${t}" ${sesion?.tipo === t || (t === "Otro" && !tipoConocido) ? "checked" : ""} />
              <span>${t}</span>
            </label>`
          ).join("")}
        </div>
        <input type="text" name="tipo_otro" class="gym-otro ${tipoConocido ? "is-hidden" : ""}"
               value="${tipoConocido ? "" : escapar(sesion?.tipo)}" placeholder="Escríbelo tú" />
      </div>

      <div class="field field--full">
        <span class="field__label">¿Cómo te encontraste?</span>
        <div class="gym-opciones">
          ${SENSACIONES.map(
            (s) => `
            <label class="gym-opcion">
              <input type="radio" name="sensacion" value="${s}" ${sesion?.sensacion === s ? "checked" : ""} />
              <span>${s}</span>
            </label>`
          ).join("")}
        </div>
      </div>

      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="notas" value="${escapar(sesion?.notas)}" placeholder="Series, pesos, lo que quieras recordar" />
      </label>

      <p class="field-error" id="form-sesion-error"></p>
      <div class="modal__actions field--full">
        ${editando ? `<button type="button" class="btn btn--ghost btn--danger" id="btn-borrar">Borrar</button>` : ""}
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);

        // El campo de texto libre solo aparece si eligió "Otro": si no, es una
        // caja vacía ahí puesta que invita a rellenarla para nada.
        const otro = root.querySelector('input[name="tipo_otro"]');
        root.querySelectorAll('input[name="tipo"]').forEach((r) =>
          r.addEventListener("change", () => {
            otro.classList.toggle("is-hidden", r.value !== "Otro");
            if (r.value === "Otro") otro.focus();
          })
        );

        root.querySelector("#btn-borrar")?.addEventListener("click", async () => {
          if (!confirm("¿Borrar esta sesión?")) return;
          await deleteGymSesiones(sesion.id);
          closeModal();
        });

        root.querySelector("#form-sesion").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const elegido = f.tipo.value || null;
          const datos = {
            fecha: f.fecha.value,
            tipo: elegido === "Otro" ? f.tipo_otro.value.trim() || "Otro" : elegido,
            duracion: f.duracion.value ? Number(f.duracion.value) : null,
            sensacion: f.sensacion.value || null,
            notas: f.notas.value.trim(),
          };
          try {
            if (editando) await updateGymSesiones(sesion.id, datos);
            else await addGymSesiones(datos);
            closeModal();
          } catch (err) {
            root.querySelector("#form-sesion-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function abrirMeta(meta) {
  const editando = Boolean(meta);
  const medida = meta?.medida ?? "dias_semana";
  openModal(
    `
    <h2 class="modal__title">${editando ? "Editar meta" : "Nueva meta"}</h2>
    <form id="form-meta" class="form-grid">
      <label class="field field--full">
        <span class="field__label">¿Qué quieres conseguir?</span>
        <input type="text" name="texto" required value="${escapar(meta?.texto)}" placeholder="Ir 4 días por semana" />
      </label>

      <div class="field field--full">
        <span class="field__label">¿Cómo se mide?</span>
        <div class="gym-opciones">
          ${MEDIDAS.map(
            (m) => `
            <label class="gym-opcion">
              <input type="radio" name="medida" value="${m.id}" ${medida === m.id ? "checked" : ""} />
              <span>${m.texto}</span>
            </label>`
          ).join("")}
        </div>
        <p class="entity-card__meta gym-ayuda" id="gym-meta-ayuda"></p>
      </div>

      <label class="field field--full ${medida === "libre" ? "is-hidden" : ""}" id="gym-meta-objetivo">
        <span class="field__label" id="gym-meta-unidad"></span>
        <input type="number" name="objetivo" step="0.1" min="0" value="${meta?.objetivo ?? ""}" />
      </label>

      <p class="field-error" id="form-meta-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${editando ? "Guardar" : "Añadir"}</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);

        const campo = root.querySelector("#gym-meta-objetivo");
        const unidad = root.querySelector("#gym-meta-unidad");
        const ayuda = root.querySelector("#gym-meta-ayuda");
        const refrescar = () => {
          const elegida = MEDIDAS.find((m) => m.id === root.querySelector('input[name="medida"]:checked').value);
          campo.classList.toggle("is-hidden", elegida.id === "libre");
          unidad.textContent = elegida.id === "dias_semana" ? "¿Cuántos días por semana?" : "¿Cuántos kilos?";
          ayuda.textContent = elegida.ayuda;
        };
        root.querySelectorAll('input[name="medida"]').forEach((r) => r.addEventListener("change", refrescar));
        refrescar();

        root.querySelector("#form-meta").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const elegida = f.medida.value;
          const error = root.querySelector("#form-meta-error");
          if (elegida !== "libre" && !f.objetivo.value) {
            error.textContent = "Pon el número que quieres conseguir, o elige «Otra cosa».";
            return;
          }
          const datos = {
            texto: f.texto.value.trim(),
            medida: elegida,
            objetivo: elegida === "libre" ? null : Number(f.objetivo.value),
            hecha: elegida === "libre" ? !!meta?.hecha : false,
          };
          try {
            if (editando) await updateGymMetas(meta.id, datos);
            else await addGymMetas(datos);
            closeModal();
          } catch (err) {
            error.textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function abrirPeso(peso) {
  const editando = Boolean(peso);
  openModal(
    `
    <h2 class="modal__title">${editando ? "Editar medida" : "Apuntar peso"}</h2>
    <form id="form-peso" class="form-grid">
      <label class="field">
        <span class="field__label">Kilos</span>
        <input type="number" name="kg" required step="0.1" min="20" max="400" value="${peso?.kg ?? ""}" placeholder="72.4" />
      </label>
      <label class="field">
        <span class="field__label">Día</span>
        <input type="date" name="fecha" required value="${peso?.fecha ?? hoyISO()}" />
      </label>
      <label class="field field--full">
        <span class="field__label">Nota (opcional)</span>
        <input type="text" name="notas" value="${escapar(peso?.notas)}" placeholder="En ayunas, por la mañana…" />
      </label>
      <p class="field-error" id="form-peso-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-peso").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const datos = { kg: Number(f.kg.value), fecha: f.fecha.value, notas: f.notas.value.trim() };
          try {
            if (editando) await updateGymPesos(peso.id, datos);
            else await addGymPesos(datos);
            closeModal();
          } catch (err) {
            root.querySelector("#form-peso-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function abrirSuplemento(sup) {
  const editando = Boolean(sup);
  openModal(
    `
    <h2 class="modal__title">${editando ? "Editar suplemento" : "Nuevo suplemento"}</h2>
    <form id="form-sup" class="form-grid">
      <label class="field field--full">
        <span class="field__label">¿Qué tomas?</span>
        <input type="text" name="nombre" required value="${escapar(sup?.nombre)}" placeholder="Creatina" />
      </label>
      <label class="field">
        <span class="field__label">Dosis (opcional)</span>
        <input type="text" name="dosis" value="${escapar(sup?.dosis)}" placeholder="5 g" />
      </label>
      <label class="field">
        <span class="field__label">Cuándo (opcional)</span>
        <input type="text" name="cuando" value="${escapar(sup?.cuando)}" placeholder="Después de entrenar" />
      </label>
      <p class="field-error" id="form-sup-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${editando ? "Guardar" : "Añadir"}</button>
      </div>
    </form>`,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-sup").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const datos = {
            nombre: f.nombre.value.trim(),
            dosis: f.dosis.value.trim(),
            cuando: f.cuando.value.trim(),
          };
          try {
            if (editando) await updateGymSuplementos(sup.id, datos);
            else await addGymSuplementos(datos);
            closeModal();
          } catch (err) {
            root.querySelector("#form-sup-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
