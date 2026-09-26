import {
  addPrestamo,
  updatePrestamo,
  deletePrestamo,
  addMovimiento,
  deleteMovimiento,
  updateMovimiento,
  addCategoria,
  addPagoPrestamo,
  updatePagoPrestamo,
  formatEUR,
  formatFecha,
  toTimestamp,
  fromTimestamp,
  esPlanDePagos,
  restantePlanDePagos,
  fechaISO as diaISO,
} from "../db.js?v=137";
import { openModal, closeModal, optionsFrom, todayISO, esc } from "../modal.js?v=137";
import { initials, avatarColor, icon } from "../icons.js?v=137";
import { wrapSwipe, attachSwipe } from "../swipe.js?v=137";
import { efectoDeCelebracion } from "../efectos.js?v=137";
import { localeActual } from "../idioma.js?v=137";

const ESTADOS = ["Activo", "Pagado"];

// El formulario de "Nuevo préstamo" necesita la lista de cuentas para
// preguntar de dónde sale el dinero, y el botón de arriba se engancha una
// sola vez al arrancar (cuando todavía no hay datos), así que el estado se
// guarda aquí y se refresca en cada pintado.
let currentState = null;

export function mountPrestamos() {
  document.getElementById("btn-add-prestamo").addEventListener("click", () => openPrestamoForm(null, currentState));
}

const round2 = (n) => Math.round(n * 100) / 100;

// Los préstamos que TÚ das llevan su propia categoría, separada de la letra
// de un préstamo que pagas al banco. Antes el gasto se colgaba de la primera
// categoría con "préstamo" en el nombre — y si esa era la letra del banco
// (p. ej. "Préstamo Bankinter"), todos los préstamos dados caían dentro y el
// donut del mes los mezclaba con la deuda propia.
export const CATEGORIA_PRESTAMOS_DADOS = "Préstamos a otros";

const esCategoriaPrestamosDados = (c) => (c?.nombre || "").trim().toLowerCase() === CATEGORIA_PRESTAMOS_DADOS.toLowerCase();

async function idCategoriaPrestamosDados(categorias) {
  const existente = (categorias ?? []).find(esCategoriaPrestamosDados);
  if (existente) return existente.id;
  const ref = await addCategoria({ nombre: CATEGORIA_PRESTAMOS_DADOS, tipo: "Variable", limite_mensual: null });
  return ref.id;
}

// Reparación de datos, una vez por arranque: los movimientos "Préstamo a X"
// que una versión anterior colgó de otra categoría se mueven a la suya. Es
// idempotente — una vez movidos ya no cumplen el filtro — así que correr en
// varios dispositivos no duplica ni pisa nada.
let reparacionLanzada = false;
export async function repararCategoriaDePrestamosDados(state) {
  if (reparacionLanzada || !state?.ready) return;
  const desviados = (state.movimientos ?? []).filter((m) => {
    if (m.tipo !== "Gasto" || !/^Préstamo a /.test(m.subcategoria || "")) return false;
    const cat = (state.categorias ?? []).find((c) => c.id === m.categoria_id);
    return !esCategoriaPrestamosDados(cat);
  });
  reparacionLanzada = true;
  if (desviados.length === 0) return;
  try {
    const id = await idCategoriaPrestamosDados(state.categorias);
    await Promise.all(desviados.map((m) => updateMovimiento(m.id, { categoria_id: id })));
  } catch {
    // Sin red (u otro tropiezo): se volverá a intentar en el próximo arranque.
    reparacionLanzada = false;
  }
}

// El modelo de deuda es UNO y simple: total a devolver = capital + interés.
// Cada pago (del importe que sea, el día que sea) resta de ese total, y al
// llegar a cero el préstamo se cierra solo. Ejemplo real de la casa: 100 €
// prestados al 20 % → debe 120 €; si paga 30 € al día durante 4 días,
// liquidado. Sin meses que vencen, sin intereses que se congelan o se
// acumulan: una deuda, un total, pagos hasta el cero.

// El interés se puede fijar a mano (para los préstamos en los que se pactó
// una cantidad concreta y no un % del capital) o calcularse solo con el %
// configurado. Si hay un importe manual guardado, ese gana siempre sobre
// el %.
function tieneInteresManual(p) {
  return p.interes_manual !== undefined && p.interes_manual !== null && p.interes_manual !== "";
}

function interesTotalDe(p) {
  if (tieneInteresManual(p)) return Number(p.interes_manual);
  const capital = Number(p.capital ?? p.capital_inicial ?? 0);
  const pct = Number(p.interes_porcentaje ?? 0);
  return round2(capital * (pct / 100));
}

function totalDe(p) {
  return round2(Number(p.capital ?? p.capital_inicial ?? 0) + interesTotalDe(p));
}

function pagadoDe(p) {
  return Number(p.pagado ?? 0);
}

function pendienteDe(p) {
  return Math.max(0, round2(totalDe(p) - pagadoDe(p)));
}

// Los pagos que ha hecho una persona: los ingresos que crearon los botones
// de pago, los días del plan y la liquidación. SOLO por el id del préstamo:
// antes también se casaba por el texto ("… · Mama") y dos préstamos a la
// misma persona se enseñaban los pagos el uno del otro.
function pagosDelPrestamo(p, movimientos) {
  return movimientos
    .filter((m) => m.tipo === "Ingreso" && m.prestamo_id === p.id)
    .sort((a, b) => (fromTimestamp(b.fecha) ?? 0) - (fromTimestamp(a.fecha) ?? 0));
}

// ---------- Avisos de cobro ----------
//
// El día que toca cobrar (la fecha del próximo cobro del préstamo, o un
// día pendiente de su plan diario), la app lo dice: un aviso arriba de
// Préstamos y una línea en el Dashboard. Si el cobro se repite (el interés
// de cada semana o de cada mes), al apuntar el pago la fecha salta sola a
// la siguiente.

export function avisosDeCobro(prestamos, pagosPrestamos) {
  const hoy = todayISO();
  return prestamos
    .filter((p) => p.estado !== "Pagado")
    .map((p) => ({ p, fecha: fechaProximoCobro(p, pagosPrestamos), plan: esPlanDePagos(p) }))
    .filter((a) => a.fecha !== "9999-12-31" && a.fecha <= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Y los que vienen DESPUÉS: todos los préstamos vivos con fecha futura,
// ordenados por cercanía. Así el bloque de cobros cuenta la foto entera
// (quién debía pagar ya, y quién es el siguiente), no solo lo atrasado.
export function proximosCobros(prestamos, pagosPrestamos) {
  const hoy = todayISO();
  return prestamos
    .filter((p) => p.estado !== "Pagado")
    .map((p) => ({ p, fecha: fechaProximoCobro(p, pagosPrestamos), plan: esPlanDePagos(p) }))
    .filter((a) => a.fecha !== "9999-12-31" && a.fecha > hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// "mañana" / "en N días" para una fecha futura.
export function textoEnDias(fechaISOFutura) {
  const dias = Math.round((new Date(fechaISOFutura + "T12:00:00") - new Date(todayISO() + "T12:00:00")) / 86400000);
  return dias === 1 ? "mañana" : `en ${dias} días`;
}

// ¿Están encendidos los avisos de cobro? (interruptor de Ajustes; de serie, sí)
export const avisosCobroActivos = (config) => config?.aviso_cobros !== false;

// La siguiente fecha de cobro según la repetición pactada. Si el aviso se
// quedó atrás (varios periodos sin apuntar), salta los que hagan falta
// hasta caer en el futuro — avisar tres veces del mismo mes no ayuda.
function siguienteFechaCobro(fechaActual, repite) {
  if (repite !== "semana" && repite !== "mes") return null;
  const hoy = todayISO();
  let d = new Date(fechaActual + "T12:00:00");
  if (Number.isNaN(d.getTime())) d = new Date();
  let iso = fechaActual;
  for (let i = 0; i < 240 && iso <= hoy; i++) {
    if (repite === "semana") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    iso = diaISO(d);
  }
  return iso;
}

// El mes siguiente de una fecha, saltando los que ya pasaron. Sirve para
// los préstamos sin repetición pactada: el interés es mensual igualmente,
// así que al sumarlo al capital la fecha se mueve un mes.
function sumarUnMes(fecha) {
  const base = fecha ? new Date(fecha + "T12:00:00") : new Date();
  const d = Number.isNaN(base.getTime()) ? new Date() : base;
  const hoy = todayISO();
  let iso = diaISO(d);
  for (let i = 0; i < 240 && iso <= hoy; i++) {
    d.setMonth(d.getMonth() + 1);
    iso = diaISO(d);
  }
  return iso;
}

// ---------- El interés que no se paga se suma al capital ----------
//
// Si llega el día y la persona no paga, ese interés no se evapora: se suma
// al capital, y desde ahí el interés se calcula sobre el capital nuevo.
// 500 € al 10 % son 50 € de interés; si no paga, el capital pasa a 550 € y
// el interés del mes siguiente es 55 €.
//
// Esto NO pasa solo: lo decide el botón "No ha pagado". Quien sabe si ha
// pagado eres tú, y la app no debe inventarse deuda por su cuenta.

export function capitalizacionesDe(p) {
  return Array.isArray(p.capitalizaciones) ? p.capitalizaciones : [];
}

// Lo que sumaría al capital el próximo "No ha pagado" y con qué quedaría.
export function simularCapitalizacion(p) {
  const capitalAntes = Number(p.capital ?? p.capital_inicial ?? 0);
  const interes = interesTotalDe(p);
  const capitalDespues = round2(capitalAntes + interes);
  const pct = Number(p.interes_porcentaje ?? 0);
  return {
    interes,
    capitalAntes,
    capitalDespues,
    manual: tieneInteresManual(p),
    // Con un % pactado, el interés del mes que viene ya sale del capital
    // nuevo; con un importe fijo a mano, sigue siendo el mismo.
    interesSiguiente: tieneInteresManual(p) ? interes : round2(capitalDespues * (pct / 100)),
    fechaSiguiente: siguienteFechaCobro(p.fecha_interes, p.cobro_repite) ?? sumarUnMes(p.fecha_interes),
  };
}

async function capitalizarInteres(p) {
  const { interes, capitalAntes, capitalDespues, fechaSiguiente } = simularCapitalizacion(p);
  await updatePrestamo(p.id, {
    capital: capitalDespues,
    fecha_interes: fechaSiguiente,
    capitalizaciones: [
      ...capitalizacionesDe(p),
      {
        fecha: todayISO(),
        interes,
        capital_antes: capitalAntes,
        capital_despues: capitalDespues,
        // Guardado para poder deshacer con exactitud si fue un error.
        fecha_interes_antes: p.fecha_interes ?? null,
      },
    ],
  });
}

// Deshacer el último "No ha pagado" (un toque sin querer no puede dejar la
// deuda inflada): devuelve el capital y la fecha a como estaban.
async function deshacerCapitalizacion(p) {
  const lista = capitalizacionesDe(p);
  const ultima = lista[lista.length - 1];
  if (!ultima) return;
  await updatePrestamo(p.id, {
    capital: Number(ultima.capital_antes ?? p.capital ?? 0),
    fecha_interes: ultima.fecha_interes_antes ?? p.fecha_interes ?? null,
    capitalizaciones: lista.slice(0, -1),
  });
}

// Tras un cobro apuntado (o al pedir "siguiente fecha"): la fecha del
// aviso avanza si se repite, o se apaga si era un cobro único.
async function avanzarAvisoCobro(p) {
  if (!p.fecha_interes || p.fecha_interes > todayISO()) return;
  const siguiente = siguienteFechaCobro(p.fecha_interes, p.cobro_repite);
  await updatePrestamo(p.id, { fecha_interes: siguiente });
}

// En qué fecha toca el próximo cobro de un préstamo: la del interés, o el
// primer día pendiente de su plan de pagos diario. Sin fecha, al final.
function fechaProximoCobro(p, pagosPrestamos) {
  if (esPlanDePagos(p)) {
    const pendiente = pagosPrestamos
      .filter((pg) => pg.prestamo_id === p.id && !pg.pagado)
      .map((pg) => fromTimestamp(pg.fecha))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    return pendiente ? diaISO(pendiente) : "9999-12-31";
  }
  return p.fecha_interes || "9999-12-31";
}

// ---------- Lo cobrado este mes, con su desglose ----------
//
// Cada cobro se reparte proporcionalmente entre capital e interés según el
// préstamo al que pertenece: en uno de 100 € al 20 % (total 120), de cada
// 30 € cobrados, 25 € son capital y 5 € interés — tu ganancia. Los
// préstamos con plan de pagos diario no declaran su interés por separado,
// así que sus cobros cuentan enteros como capital. Si el préstamo ya no
// existe (se borró la tarjeta), el cobro cuenta como capital y la persona
// se saca del texto del movimiento.
function cobrosDelMes(prestamos, movimientos) {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = ahora.getMonth();
  const porPersona = new Map();
  let totalMes = 0;
  let interesMes = 0;
  for (const mov of movimientos) {
    if (mov.tipo !== "Ingreso" || !mov.prestamo_id) continue;
    const f = fromTimestamp(mov.fecha);
    if (!f || f.getFullYear() !== y || f.getMonth() !== m) continue;
    const importe = Number(mov.importe ?? 0);
    if (!(importe > 0)) continue;
    const p = prestamos.find((x) => x.id === mov.prestamo_id);
    const ratio = p && !esPlanDePagos(p) && totalDe(p) > 0 ? interesTotalDe(p) / totalDe(p) : 0;
    // Un recargo por retraso no devuelve capital: es ganancia entera.
    const esRecargo = typeof mov.subcategoria === "string" && mov.subcategoria.startsWith("Recargo préstamo");
    const interes = esRecargo ? importe : round2(importe * ratio);
    const capital = round2(importe - interes);
    const persona = p?.persona || (typeof mov.subcategoria === "string" ? mov.subcategoria.split("·")[1]?.trim() : "") || "—";
    if (!porPersona.has(persona)) porPersona.set(persona, { capital: 0, interes: 0 });
    const acc = porPersona.get(persona);
    acc.capital = round2(acc.capital + capital);
    acc.interes = round2(acc.interes + interes);
    totalMes = round2(totalMes + importe);
    interesMes = round2(interesMes + interes);
  }
  return { totalMes, interesMes, porPersona };
}

function abrirDesgloseMes(prestamos, movimientos) {
  const { totalMes, interesMes, porPersona } = cobrosDelMes(prestamos, movimientos);
  const mesNombre = new Intl.DateTimeFormat(localeActual(), { month: "long", year: "numeric" }).format(new Date());
  const filas = [...porPersona.entries()]
    .sort((a, b) => b[1].capital + b[1].interes - (a[1].capital + a[1].interes))
    .map(
      ([persona, d]) => `
      <div class="mini-row">
        <div class="mini-row__body">
          <span class="avatar" style="background:${avatarColor(persona)}">${initials(persona)}</span>
          <div class="mini-row__main">
            <span class="mini-row__title">${esc(persona)}</span>
            <span class="mini-row__sub">Capital ${formatEUR(d.capital)}${d.interes > 0 ? ` · interés ${formatEUR(d.interes)}` : ""}</span>
          </div>
        </div>
        <span class="mini-row__amount mini-row__amount--pos">+ ${formatEUR(round2(d.capital + d.interes))}</span>
      </div>`
    )
    .join("");
  openModal(
    `
    <h2 class="modal__title">Cobrado en ${mesNombre}</h2>
    <p class="entity-card__meta" style="margin:-8px 0 12px;">
      Total ${formatEUR(totalMes)} — capital ${formatEUR(round2(totalMes - interesMes))} + intereses <strong>${formatEUR(interesMes)}</strong> (tu ganancia).
      Cada cobro se reparte según su préstamo: en uno de 100 € al 20 %, de cada 30 € cobrados, 5 € son interés.
    </p>
    ${filas ? `<div class="pago-list">${filas}</div>` : `<p class="empty-state">Este mes todavía no has cobrado ningún pago.</p>`}
    <div class="modal__actions">
      <button type="button" class="btn btn--primary" id="btn-cerrar-desglose">Listo</button>
    </div>
  `,
    { onMount: (root) => root.querySelector("#btn-cerrar-desglose").addEventListener("click", closeModal) }
  );
}

// "hace N días" para una fecha que ya pasó.
function textoDiasAtras(fecha) {
  const dias = Math.round((new Date(todayISO() + "T12:00:00") - new Date(fecha + "T12:00:00")) / 86400000);
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

// La línea del día de cobro, dicha en el tiempo verbal correcto: si la
// fecha ya pasó no vale "para el 3 de septiembre" — ese día pasó y lo que
// hay es un retraso, así que se dice y se marca en rojo.
function vencimientoDe(p) {
  if (!p.fecha_interes || p.estado === "Pagado") return null;
  const hoy = todayISO();
  const f = p.fecha_interes;
  const fechaTxt = formatFecha(new Date(f + "T12:00:00"));
  if (f > hoy) return { vencido: false, texto: `Te paga el ${fechaTxt}`, cuando: textoEnDias(f) };
  if (f === hoy) return { vencido: true, texto: "Te tiene que pagar hoy", cuando: "" };
  return { vencido: true, texto: `Te tenía que pagar el ${fechaTxt}`, cuando: textoDiasAtras(f) };
}

// Qué tarjetas están desplegadas. De serie todas van plegadas: la lista
// es una lista de nombres con lo que debe cada uno, y se abre la que
// interesa. Se recuerda en el móvil para que no haya que reabrir cada vez.
const CLAVE_ABIERTOS = "fj-prestamos-abiertos";
const abiertos = new Set((() => { try { return JSON.parse(localStorage.getItem(CLAVE_ABIERTOS) || "[]"); } catch { return []; } })());
const guardarAbiertos = () => { try { localStorage.setItem(CLAVE_ABIERTOS, JSON.stringify([...abiertos])); } catch { /* sin almacenamiento */ } };
export function abrirTarjetaPrestamo(id) { abiertos.add(id); guardarAbiertos(); }

// Qué historial está desplegado (se recuerda entre repintados).
const historialAbierto = new Set();

function renderHistorialPagos(p, movimientos) {
  const pagos = pagosDelPrestamo(p, movimientos);
  if (pagos.length === 0) return "";
  const total = pagos.reduce((acc, m) => acc + Number(m.importe ?? 0), 0);
  const abierto = historialAbierto.has(p.id);
  const etiqueta = (m) =>
    m.subcategoria?.startsWith("Recargo préstamo")
      ? "Recargo"
      : m.subcategoria?.startsWith("Interés préstamo")
      ? "Interés"
      : m.subcategoria?.startsWith("Plan de pagos")
        ? "Cuota del plan"
        : m.subcategoria?.startsWith("Abono préstamo")
          ? "Abono"
          : m.subcategoria?.startsWith("Préstamo liquidado")
            ? "Liquidación"
            : "Pago";
  return `
    <button type="button" class="prestamo-historial__toggle" data-historial="${p.id}">
      Historial: ${pagos.length} ${pagos.length === 1 ? "pago" : "pagos"} · ${formatEUR(total)} cobrados ${abierto ? "▴" : "▾"}
    </button>
    ${
      abierto
        ? `<div class="pago-list">
        ${pagos
          .map(
            (m) => `
          <div class="mini-row">
            <div class="mini-row__body">
              <div class="mini-row__main">
                <span class="mini-row__title">${etiqueta(m)}</span>
                <span class="mini-row__sub">${formatFecha(fromTimestamp(m.fecha))}</span>
              </div>
            </div>
            <span class="mini-row__amount mini-row__amount--pos">+ ${formatEUR(Number(m.importe ?? 0))}</span>
          </div>`
          )
          .join("")}
      </div>`
        : ""
    }`;
}

export function renderPrestamos(state) {
  currentState = state;
  const el = document.getElementById("prestamos-grid");
  const { prestamos, pagosPrestamos, movimientos } = state;

  const activos = prestamos.filter((p) => p.estado !== "Pagado");
  // Un préstamo con plan de pagos diario no tiene un pendiente fijo: lo que
  // debe de verdad es lo que quede sin marcar como pagado en su lista de
  // días. El resto usan el modelo simple: total (capital + interés) menos
  // lo ya pagado.
  const totalPendiente = activos.reduce(
    (acc, p) => acc + (esPlanDePagos(p) ? restantePlanDePagos(p, pagosPrestamos) : pendienteDe(p)),
    0
  );
  // Los intereses a tu favor de los préstamos vivos (los del plan diario ya
  // van repartidos dentro de sus cuotas, así que no suman aparte).
  const totalInteres = activos.reduce((acc, p) => acc + (esPlanDePagos(p) ? 0 : interesTotalDe(p)), 0);
  document.getElementById("kpi-prestamos-capital").textContent = formatEUR(totalPendiente);
  document.getElementById("kpi-prestamos-interes").textContent = formatEUR(totalInteres);

  // Lo cobrado este mes natural: el total (capital + interés) y, aparte,
  // solo los intereses — la ganancia del mes. Los dos se tocan para ver el
  // desglose por persona.
  const mes = cobrosDelMes(prestamos, movimientos);
  document.getElementById("kpi-prestamos-mes-total").textContent = formatEUR(mes.totalMes);
  document.getElementById("kpi-prestamos-mes-interes").textContent = formatEUR(mes.interesMes);
  document.getElementById("kpi-prestamos-mes").onclick = () => abrirDesgloseMes(prestamos, movimientos);
  document.getElementById("kpi-prestamos-mes-int").onclick = () => abrirDesgloseMes(prestamos, movimientos);

  if (prestamos.length === 0) {
    el.innerHTML = `<p class="empty-state">Todavía no has registrado ningún préstamo.</p>`;
    return;
  }

  // Los cobros, la foto entera: quién te tenía que pagar ya (con sus
  // botones) y quién viene después (todos los préstamos con fecha, por
  // cercanía — el más próximo, el primero).
  const avisos = avisosDeCobro(prestamos, pagosPrestamos);
  const proximos = proximosCobros(prestamos, pagosPrestamos);
  const hoyISO = todayISO();
  const proximosHTML = proximos.length
    ? `${avisos.length ? `<p class="aviso-cobros__titulo aviso-cobros__titulo--proximos">Próximos cobros</p>` : ""}
       ${proximos
         .map(
           ({ p, fecha }) => `
            <div class="aviso-cobros__fila aviso-cobros__fila--proximo">
              <span class="aviso-cobros__texto">${esc(p.persona)}<span class="aviso-cobros__pendiente"> · Te paga el ${formatFecha(new Date(fecha + "T12:00:00"))}</span></span>
              <span class="aviso-cobros__cuando">${textoEnDias(fecha)}</span>
            </div>`
         )
         .join("")}`
    : "";
  const avisosHTML = avisos.length || proximos.length
    ? `<div class="aviso-cobros">
        <p class="aviso-cobros__titulo">💰 ${avisos.length ? "Cobros que te deben" : "Próximos cobros"}</p>
        ${avisos
          .map(({ p, fecha, plan }) => {
            const texto =
              fecha === hoyISO
                ? `A ${esc(p.persona)} le toca pagarte hoy`
                : `${esc(p.persona)} tenía que pagarte el ${formatFecha(new Date(fecha + "T12:00:00"))}`;
            return `
            <div class="aviso-cobros__fila">
              <span class="aviso-cobros__texto">${texto}${plan ? "" : `<span class="aviso-cobros__pendiente"> · quedan ${formatEUR(pendienteDe(p))}</span>`}</span>
              <span class="aviso-cobros__acciones">
                ${
                  plan
                    ? `<span class="aviso-cobros__nota">márcalo en su plan de abajo</span>`
                    : `<button type="button" class="btn btn--primary btn--sm" data-aviso-abono="${p.id}">± Apuntar el pago</button>
                       ${
                         interesTotalDe(p) > 0
                           ? `<button type="button" class="btn btn--ghost btn--sm" data-no-ha-pagado="${p.id}">No ha pagado</button>`
                           : ""
                       }
                       ${
                         p.cobro_repite === "semana" || p.cobro_repite === "mes"
                           ? `<button type="button" class="btn btn--ghost btn--sm" data-aviso-siguiente="${p.id}">Pasar a la siguiente fecha</button>`
                           : `<button type="button" class="btn btn--ghost btn--sm" data-aviso-quitar="${p.id}">Quitar el aviso</button>`
                       }`
                }
              </span>
            </div>`;
          })
          .join("")}
        ${proximosHTML}
      </div>`
    : "";

  // Orden: a quién le toca pagar antes, primero — por la fecha del próximo
  // cobro. Los que no tienen fecha van después, y los ya pagados al final.
  const ordenados = [...prestamos].sort((a, b) => {
    const pagadoA = a.estado === "Pagado";
    const pagadoB = b.estado === "Pagado";
    if (pagadoA !== pagadoB) return pagadoA ? 1 : -1;
    return fechaProximoCobro(a, pagosPrestamos).localeCompare(fechaProximoCobro(b, pagosPrestamos));
  });

  el.innerHTML = avisosHTML + ordenados
    .map((p) => {
      // capital_inicial es el campo antiguo (de antes de simplificar
      // préstamos): si un préstamo todavía no tiene `capital` fijado, se
      // usa como respaldo temporal para no mostrar NaN/vacío.
      const capital = Number(p.capital ?? p.capital_inicial ?? 0);
      const planPagos = esPlanDePagos(p);
      const pct = Number(p.interes_porcentaje ?? 0);
      const interes = interesTotalDe(p);
      const total = totalDe(p);
      const pagado = pagadoDe(p);
      const pendiente = pendienteDe(p);
      const tagClass = p.estado === "Pagado" ? "entity-card__tag--pagado" : "entity-card__tag--activo";
      const montoMostrado = planPagos ? restantePlanDePagos(p, pagosPrestamos) : pendiente;
      // El desglose de la deuda, en una línea: qué se prestó, qué interés
      // lleva y cuánto ha devuelto ya. La barra es lo pagado sobre el total.
      // La cuenta, línea a línea y sumando a la vista: capital, interés,
      // lo ya pagado y lo que queda. Antes era un párrafo apretado donde el
      // capital y el interés se perdían entre comas.
      const vencimiento = vencimientoDe(p);
      const capitalizaciones = capitalizacionesDe(p);
      const sumadoAlCapital = capitalizaciones.reduce((acc, c) => acc + Number(c.interes ?? 0), 0);
      const desglose = planPagos
        ? ""
        : `<div class="prestamo-cuenta">
            <div class="prestamo-cuenta__fila">
              <span>Capital</span><span class="prestamo-cuenta__cifra">${formatEUR(capital)}</span>
            </div>
            ${
              interes > 0
                ? `<div class="prestamo-cuenta__fila">
                    <span>Interés${!tieneInteresManual(p) && pct > 0 ? ` (${pct} %)` : ""}</span>
                    <span class="prestamo-cuenta__cifra">+ ${formatEUR(interes)}</span>
                  </div>`
                : ""
            }
            ${
              pagado > 0
                ? `<div class="prestamo-cuenta__fila">
                    <span>Ya ha pagado</span><span class="prestamo-cuenta__cifra prestamo-cuenta__cifra--pos">− ${formatEUR(pagado)}</span>
                  </div>`
                : ""
            }
            <div class="prestamo-cuenta__fila prestamo-cuenta__fila--total">
              <span>${p.estado === "Pagado" ? "Saldado" : "Te debe"}</span><span class="prestamo-cuenta__cifra">${formatEUR(pendiente)}</span>
            </div>
          </div>
          ${
            vencimiento
              ? `<p class="prestamo-vence${vencimiento.vencido ? " prestamo-vence--tarde" : ""}"><span>${vencimiento.texto}</span>${
                  vencimiento.cuando ? `<span class="prestamo-vence__cuando">${vencimiento.cuando}</span>` : ""
                }</p>`
              : ""
          }
          ${
            sumadoAlCapital > 0
              ? `<p class="entity-card__meta">Interés sumado al capital: ${capitalizaciones.length} ${
                  capitalizaciones.length === 1 ? "vez" : "veces"
                } · ${formatEUR(round2(sumadoAlCapital))} <button type="button" class="prestamo-deshacer" data-deshacer-capitalizacion="${p.id}">Deshacer el último</button></p>`
              : ""
          }
          ${
            p.estado !== "Pagado" && total > 0
              ? `<div class="progress-track" style="margin:4px 0 8px;"><div class="progress-fill" style="width:${Math.min(100, Math.round((pagado / total) * 100))}%"></div></div>`
              : ""
          }`;

      return wrapSwipe(
        `
        <article class="entity-card${abiertos.has(p.id) ? "" : " entity-card--plegada"}">
          <div class="entity-card__top">
            <button type="button" class="entity-card__heading prestamo-cabecera" data-toggle-prestamo="${p.id}" aria-expanded="${abiertos.has(p.id)}">
              <span class="avatar" style="background:${avatarColor(p.persona)}">${initials(p.persona)}</span>
              <span class="entity-card__name">${esc(p.persona)}</span>
              <span class="prestamo-caret" aria-hidden="true">▾</span>
            </button>
            <div class="entity-card__top-actions">
              <span class="entity-card__tag ${tagClass}">${p.estado || "Activo"}</span>
              <button type="button" class="row-edit-btn" data-edit="${p.id}" title="Editar">${icon("edit", { size: 15 })}</button>
            </div>
          </div>
          <p class="entity-card__amount">${formatEUR(montoMostrado)} <span style="font-size:0.9rem;color:var(--text-muted);font-family:var(--font-body)">${p.estado === "Pagado" ? "— saldado" : "pendiente"}</span></p>
          <div class="prestamo-cuerpo${abiertos.has(p.id) ? "" : " is-hidden"}">
          ${desglose}
          ${p.notas ? `<p class="entity-card__meta">${esc(p.notas)}</p>` : ""}

          ${p.estado === "Pagado" ? `<p class="entity-card__meta">Préstamo cerrado.</p>` : planPagos ? renderPlanPagos(p, pagosPrestamos) : ""}
          ${renderHistorialPagos(p, movimientos)}
          ${
            p.estado !== "Pagado" && !planPagos
              ? `<button type="button" class="btn btn--ghost btn--sm btn--block" data-abono="${p.id}">± Ha pagado una parte</button>`
              : ""
          }
          ${
            p.estado !== "Pagado" && !planPagos && interes > 0 && vencimiento?.vencido
              ? `<button type="button" class="btn btn--ghost btn--sm btn--block" data-no-ha-pagado="${p.id}">⏭ No ha pagado · sumar el interés al capital</button>`
              : ""
          }
          ${
            p.estado !== "Pagado"
              ? `<button type="button" class="btn btn--ghost btn--sm btn--block prestamo-liquidar-btn" data-liquidar="${p.id}">💰 Ha pagado todo lo pendiente (liquidar)</button>`
              : ""
          }
          ${
            p.estado !== "Pagado"
              ? `<button type="button" class="btn btn--ghost btn--sm btn--block" data-edit="${p.id}">✎ Corregir el préstamo a mano</button>`
              : ""
          }
          </div>
        </article>`,
        p.id
      );
    })
    .join("");

  el.querySelectorAll("[data-aviso-abono]").forEach((btn) =>
    btn.addEventListener("click", () => openAbonoForm(prestamos.find((p) => p.id === btn.dataset.avisoAbono), state))
  );
  el.querySelectorAll("[data-aviso-siguiente]").forEach((btn) =>
    btn.addEventListener("click", () => avanzarAvisoCobro(prestamos.find((p) => p.id === btn.dataset.avisoSiguiente)))
  );
  el.querySelectorAll("[data-aviso-quitar]").forEach((btn) =>
    btn.addEventListener("click", () => updatePrestamo(btn.dataset.avisoQuitar, { fecha_interes: null }))
  );
  el.querySelectorAll("[data-toggle-prestamo]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.togglePrestamo;
      const tarjeta = btn.closest(".entity-card");
      const abrir = !abiertos.has(id);
      if (abrir) abiertos.add(id);
      else abiertos.delete(id);
      guardarAbiertos();
      tarjeta?.classList.toggle("entity-card--plegada", !abrir);
      tarjeta?.querySelector(".prestamo-cuerpo")?.classList.toggle("is-hidden", !abrir);
      btn.setAttribute("aria-expanded", String(abrir));
    })
  );
  el.querySelectorAll("[data-no-ha-pagado]").forEach((btn) =>
    btn.addEventListener("click", () => openNoHaPagadoForm(prestamos.find((p) => p.id === btn.dataset.noHaPagado)))
  );
  el.querySelectorAll("[data-deshacer-capitalizacion]").forEach((btn) =>
    btn.addEventListener("click", () => openDeshacerCapitalizacion(prestamos.find((p) => p.id === btn.dataset.deshacerCapitalizacion)))
  );
  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openPrestamoForm(prestamos.find((p) => p.id === btn.dataset.edit), state))
  );
  el.querySelectorAll("[data-liquidar]").forEach((btn) =>
    btn.addEventListener("click", () => openLiquidarForm(prestamos.find((p) => p.id === btn.dataset.liquidar), state))
  );
  el.querySelectorAll("[data-abono]").forEach((btn) =>
    btn.addEventListener("click", () => openAbonoForm(prestamos.find((p) => p.id === btn.dataset.abono), state))
  );
  el.querySelectorAll("[data-historial]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.historial;
      if (historialAbierto.has(id)) historialAbierto.delete(id);
      else historialAbierto.add(id);
      renderPrestamos(currentState);
    })
  );
  el.querySelectorAll("[data-dia-pendiente]").forEach((btn) =>
    btn.addEventListener("click", () => openDiaPagadoForm(pagosPrestamos.find((pg) => pg.id === btn.dataset.diaPendiente), state))
  );
  el.querySelectorAll("[data-dia-pagado]").forEach((btn) =>
    btn.addEventListener("click", () => deshacerDiaPagado(pagosPrestamos.find((pg) => pg.id === btn.dataset.diaPagado)))
  );
  attachSwipe(el, (id) => eliminarPrestamo(prestamos.find((p) => p.id === id)), {
    confirmar:
      "¿Eliminar este préstamo? Los pagos ya registrados se quedan en Movimientos (ese dinero entró de verdad). Solo si nunca cobró nada, se borra también el gasto de cuando salió el dinero.",
  });
}

// Borrar un préstamo que NUNCA cobró nada se lleva por delante el
// movimiento que sacó el dinero de la cuenta al crearlo: fue un apunte por
// error y así no deja el saldo descuadrado ni un gasto suelto.
//
// Pero si el préstamo YA tiene pagos registrados, el dinero se movió de
// verdad (salió el gasto, entraron los pagos): ahí NO se toca ningún
// movimiento — borrar la tarjeta borrando solo la mitad de la historia
// dejaba la cuenta con dinero fantasma (pasó con un préstamo ya devuelto:
// se fue el −60 del origen, se quedaron los dos +30, y la cuenta subió
// 60 € que no existían).
async function eliminarPrestamo(prestamo) {
  if (!prestamo) return;
  const cobros = pagosDelPrestamo(prestamo, currentState?.movimientos ?? []);
  if (prestamo.movimiento_origen_id && cobros.length === 0) {
    try {
      await deleteMovimiento(prestamo.movimiento_origen_id);
    } catch (err) {
      console.error("No se pudo borrar el movimiento de origen del préstamo:", err);
    }
  }
  await deletePrestamo(prestamo.id);
}

// Plan de pagos diario: en vez de un interés mensual único, se muestra la
// lista de días (cada uno con su cuota) para poder marcar/desmarcar día a
// día lo que de verdad se ha cobrado.
function renderPlanPagos(prestamo, pagosPrestamos) {
  const dias = pagosPrestamos
    .filter((pg) => pg.prestamo_id === prestamo.id)
    .sort((a, b) => (fromTimestamp(a.fecha) ?? 0) - (fromTimestamp(b.fecha) ?? 0));

  if (dias.length === 0) {
    return `<p class="entity-card__meta">Sin días configurados todavía — edita el préstamo o pide que se genere el plan.</p>`;
  }

  const pagados = dias.filter((pg) => pg.pagado).length;

  return `
    <div class="plan-pagos">
      <p class="prestamo-interes__label">Plan de pagos diario · ${pagados} de ${dias.length} días cobrados</p>
      <div class="pago-list">
        ${dias
          .map((pg) => {
            const fecha = fromTimestamp(pg.fecha);
            const attr = pg.pagado ? `data-dia-pagado="${pg.id}"` : `data-dia-pendiente="${pg.id}"`;
            return `
            <button type="button" class="mini-row" ${attr}>
              <div class="mini-row__body">
                <span class="mini-row__icon">${pg.pagado ? icon("check", { size: 16 }) : formatFecha(fecha).slice(0, 2)}</span>
                <div class="mini-row__main">
                  <span class="mini-row__title">${formatFecha(fecha)}</span>
                  <span class="mini-row__sub">${pg.pagado ? "Cobrado — toca para deshacer" : "Pendiente — toca para marcar"}</span>
                </div>
              </div>
              <span class="mini-row__amount ${pg.pagado ? "mini-row__amount--pos" : ""}">${formatEUR(pg.importe)}</span>
            </button>`;
          })
          .join("")}
      </div>
    </div>`;
}

// Marcar un día concreto del plan de pagos diario como cobrado: el importe
// es editable (por defecto, la cuota que toque ese día),
// porque un día puede pagarse de más o de menos que lo esperado.
function openDiaPagadoForm(pago, state) {
  const prestamo = state.prestamos.find((p) => p.id === pago.prestamo_id);
  const fecha = fromTimestamp(pago.fecha);

  openModal(
    `
    <h2 class="modal__title">Día pagado · ${formatFecha(fecha)}</h2>
    <form id="form-dia-pagado" class="form-grid">
      <label class="field">
        <span class="field__label">Importe</span>
        <input type="number" step="0.01" name="importe" required value="${Number(pago.importe ?? 0).toFixed(2)}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Cuenta</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: prestamo?.cuenta_id })}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Fecha del cobro</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <p class="field-error" id="form-dia-pagado-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Confirmar</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-dia-pagado").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          try {
            const importe = Number(f.importe.value);
            const movimiento = await addMovimiento({
              tipo: "Ingreso",
              importe,
              categoria_id: null,
              cuenta_id: f.cuenta_id.value,
              cuenta_destino_id: null,
              fecha: toTimestamp(f.fecha.value),
              subcategoria: `Plan de pagos · ${prestamo?.persona ?? ""} · ${formatFecha(fecha)}`,
              nota: "",
              prestamo_id: prestamo?.id ?? null,
            });
            await updatePagoPrestamo(pago.id, { pagado: true, importe, movimiento_id: movimiento.id });
            closeModal();
          } catch (err) {
            root.querySelector("#form-dia-pagado-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

// Deshace un día ya marcado como cobrado por error: borra el ingreso que se
// había registrado y vuelve a dejar el día como pendiente.
async function deshacerDiaPagado(pago) {
  if (!confirm("¿Deshacer este pago? Se borrará el ingreso registrado y el día volverá a quedar pendiente.")) return;
  if (pago.movimiento_id) {
    try {
      await deleteMovimiento(pago.movimiento_id);
    } catch (err) {
      console.error("No se pudo borrar el ingreso del día deshecho:", err);
    }
  }
  await updatePagoPrestamo(pago.id, { pagado: false, movimiento_id: null });
}

// Un pago: la persona devuelve una parte de lo que debe (30 € de una deuda
// de 120, por ejemplo). Nada de repartir entre interés y capital — el
// importe simplemente resta del total pendiente, y si con este pago llega
// a cero, el préstamo se cierra solo como Pagado.
// "No ha pagado": el interés del periodo se suma al capital y, con un %
// pactado, el interés del periodo siguiente ya sale del capital nuevo.
// Antes de tocar nada se enseñan las cifras exactas — es una decisión que
// aumenta la deuda de una persona, así que se ve lo que va a pasar.
function openNoHaPagadoForm(prestamo) {
  if (!prestamo) return;
  const { interes, capitalAntes, capitalDespues, interesSiguiente, manual, fechaSiguiente } = simularCapitalizacion(prestamo);
  openModal(
    `
    <h2 class="modal__title">${esc(prestamo.persona)} no ha pagado</h2>
    <p class="entity-card__meta" style="margin:-8px 0 14px;">
      El interés de este periodo no se pierde: se suma al capital, y la deuda sigue creciendo desde ahí.
    </p>
    <div class="prestamo-cuenta">
      <div class="prestamo-cuenta__fila"><span>Capital ahora</span><span class="prestamo-cuenta__cifra">${formatEUR(capitalAntes)}</span></div>
      <div class="prestamo-cuenta__fila"><span>Interés sin pagar</span><span class="prestamo-cuenta__cifra">+ ${formatEUR(interes)}</span></div>
      <div class="prestamo-cuenta__fila prestamo-cuenta__fila--total"><span>Capital nuevo</span><span class="prestamo-cuenta__cifra">${formatEUR(capitalDespues)}</span></div>
    </div>
    <p class="prestamo-nota-fuerte">${
      manual
        ? `El interés seguirá siendo el que fijaste a mano: ${formatEUR(interesSiguiente)}.`
        : `El próximo interés se calculará sobre ${formatEUR(capitalDespues)}: ${formatEUR(interesSiguiente)}.`
    }</p>
    <p class="prestamo-nota-fuerte">Próximo cobro: ${formatFecha(new Date(fechaSiguiente + "T12:00:00"))}.</p>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="btn-cancel-no-pagado">Cancelar</button>
      <button type="button" class="btn btn--primary" id="btn-confirmar-no-pagado">Sumar el interés al capital</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel-no-pagado").addEventListener("click", closeModal);
        root.querySelector("#btn-confirmar-no-pagado").addEventListener("click", async () => {
          await capitalizarInteres(prestamo);
          closeModal();
        });
      },
    }
  );
}

// Y la vuelta atrás, por si el botón se tocó sin querer.
function openDeshacerCapitalizacion(prestamo) {
  if (!prestamo) return;
  const ultima = capitalizacionesDe(prestamo).slice(-1)[0];
  if (!ultima) return;
  openModal(
    `
    <h2 class="modal__title">Deshacer el último</h2>
    <p class="entity-card__meta" style="margin:-8px 0 6px;">${`Se sumaron ${formatEUR(Number(ultima.interes ?? 0))} de interés al capital de ${esc(prestamo.persona)} (de ${formatEUR(Number(ultima.capital_antes ?? 0))} a ${formatEUR(Number(ultima.capital_despues ?? 0))}).`}</p>
    <p class="entity-card__meta" style="margin:0 0 14px;">Al deshacerlo, el capital y la fecha de cobro vuelven a como estaban.</p>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="btn-cancel-deshacer">Cancelar</button>
      <button type="button" class="btn btn--primary" id="btn-confirmar-deshacer">Deshacer</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel-deshacer").addEventListener("click", closeModal);
        root.querySelector("#btn-confirmar-deshacer").addEventListener("click", async () => {
          await deshacerCapitalizacion(prestamo);
          closeModal();
        });
      },
    }
  );
}

function openAbonoForm(prestamo, state) {
  const pendiente = pendienteDe(prestamo);
  const total = totalDe(prestamo);

  const resumenDe = (importe, tipoPago = "devolucion") => {
    if (tipoPago === "recargo") {
      return importe > 0
        ? `Recargo de ${formatEUR(importe)}: entra como ingreso y la deuda sigue en ${formatEUR(pendiente)}.`
        : `El recargo entra como ingreso y la deuda sigue en ${formatEUR(pendiente)}.`;
    }
    if (!(importe > 0)) {
      return `Debe <strong>${formatEUR(pendiente)}</strong>${pagadoDe(prestamo) > 0 ? ` (de ${formatEUR(total)} en total)` : ""}. Escribe cuánto ha pagado.`;
    }
    if (importe >= pendiente - 0.004) {
      return `Con ${formatEUR(importe)} queda <strong>todo saldado</strong>: el préstamo se cerrará como Pagado.`;
    }
    return `Quedarán por pagar <strong>${formatEUR(round2(pendiente - importe))}</strong>.`;
  };

  openModal(
    `
    <h2 class="modal__title">Abono · ${prestamo.persona}</h2>
    <form id="form-abono" class="form-grid">
      <label class="field">
        <span class="field__label">¿Cuánto ha pagado?</span>
        <input type="number" step="0.01" min="0.01" name="importe" required placeholder="30.00" />
      </label>
      <label class="field">
        <span class="field__label">¿Qué es este pago?</span>
        <select name="tipo_pago">
          <option value="devolucion">Devolución · baja lo que te debe</option>
          <option value="recargo">Recargo por retraso · no baja la deuda</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">¿A qué cuenta entra?</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: prestamo.cuenta_id })}</select>
      </label>
      <label class="field">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <p class="entity-card__meta field--full" id="abono-resumen">${resumenDe(0)}</p>
      <p class="field-error" id="form-abono-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Registrar el abono</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        const f0 = root.querySelector("#form-abono");
        const repintar = () => {
          root.querySelector("#abono-resumen").innerHTML = resumenDe(Number(f0.importe.value || 0), f0.tipo_pago.value);
        };
        f0.importe.addEventListener("input", repintar);
        f0.tipo_pago.addEventListener("change", repintar);
        root.querySelector("#form-abono").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const importe = Number(f.importe.value);
          if (!(importe > 0)) return;
          const esRecargo = f.tipo_pago.value === "recargo";
          try {
            await addMovimiento({
              tipo: "Ingreso",
              importe,
              categoria_id: null,
              cuenta_id: f.cuenta_id.value,
              cuenta_destino_id: null,
              fecha: toTimestamp(f.fecha.value),
              subcategoria: `${esRecargo ? "Recargo préstamo" : "Abono préstamo"} · ${prestamo.persona}`,
              nota: "",
              prestamo_id: prestamo.id,
            });
            // Un recargo por retraso es ganancia pura: ya ha entrado como
            // ingreso, y ahí se queda. Ni baja la deuda ni toca el aviso.
            if (esRecargo) {
              closeModal();
              return;
            }
            // El pago solo suma a "pagado": el capital y el interés del
            // préstamo no se tocan, así el desglose siempre cuenta la
            // historia completa (prestado + interés − pagado = pendiente).
            const saldado = importe >= pendiente - 0.004;
            // Si el aviso de cobro estaba sonando (la fecha ya llegó), este
            // pago lo atiende: la fecha salta a la siguiente si se repite,
            // o se apaga si era única. Saldado, ya no hay nada que avisar.
            const avisoAtendido =
              prestamo.fecha_interes && prestamo.fecha_interes <= todayISO()
                ? { fecha_interes: saldado ? null : siguienteFechaCobro(prestamo.fecha_interes, prestamo.cobro_repite) }
                : saldado
                  ? { fecha_interes: null }
                  : {};
            await updatePrestamo(prestamo.id, {
              pagado: round2(pagadoDe(prestamo) + importe),
              ...(saldado ? { estado: "Pagado" } : {}),
              ...avisoAtendido,
            });
            if (saldado) efectoDeCelebracion();
            closeModal();
          } catch (err) {
            root.querySelector("#form-abono-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

// Cuando la persona paga TODO de golpe (el capital pendiente + el interés
// actual), no basta con marcar el interés como pagado (eso solo mueve la
// La persona paga de golpe TODO lo que le queda: se registra un único
// ingreso por el pendiente y el préstamo se cierra como Pagado.
function openLiquidarForm(prestamo, state) {
  const planPagos = esPlanDePagos(prestamo);
  const total = planPagos ? restantePlanDePagos(prestamo, state.pagosPrestamos) : pendienteDe(prestamo);

  openModal(
    `
    <h2 class="modal__title">Liquidar deuda · ${prestamo.persona}</h2>
    <p class="entity-card__meta" style="margin-bottom:16px;">
      ${
        planPagos
          ? `Quedan ${formatEUR(total)} pendientes del plan de pagos diario.`
          : `Le quedan por pagar <strong>${formatEUR(total)}</strong>${pagadoDe(prestamo) > 0 ? ` (de ${formatEUR(totalDe(prestamo))} en total, ya había pagado ${formatEUR(pagadoDe(prestamo))})` : ` (capital + interés)`}.`
      }
      Esto registra un ingreso por el total y cierra el préstamo como Pagado.
    </p>
    <form id="form-liquidar" class="form-grid">
      <label class="field">
        <span class="field__label">Importe total</span>
        <input type="number" step="0.01" name="importe" required value="${total.toFixed(2)}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Cuenta</span>
        <select name="cuenta_id">${optionsFrom(state.cuentas, { selected: prestamo.cuenta_id })}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Fecha</span>
        <input type="date" name="fecha" value="${todayISO()}" required />
      </label>
      <p class="field-error" id="form-liquidar-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Liquidar y cerrar préstamo</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        root.querySelector("#form-liquidar").addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          try {
            await addMovimiento({
              tipo: "Ingreso",
              importe: Number(f.importe.value),
              categoria_id: null,
              cuenta_id: f.cuenta_id.value,
              cuenta_destino_id: null,
              fecha: toTimestamp(f.fecha.value),
              subcategoria: `Préstamo liquidado · ${prestamo.persona}`,
              nota: "",
              prestamo_id: prestamo.id,
            });
            // Pagado = el total: el desglose de la tarjeta queda contando
            // la historia completa aunque el préstamo esté cerrado.
            await updatePrestamo(prestamo.id, { pagado: planPagos ? pagadoDe(prestamo) : totalDe(prestamo), estado: "Pagado" });
            // El ingreso de arriba ya cubre TODO lo que quedaba, así que los
            // días pendientes del plan se marcan pagados sin crear un
            // ingreso por cada uno (ya está contado en el de golpe).
            if (planPagos) {
              const pendientes = state.pagosPrestamos.filter((pg) => pg.prestamo_id === prestamo.id && !pg.pagado);
              await Promise.all(pendientes.map((pg) => updatePagoPrestamo(pg.id, { pagado: true })));
            }
            // Saldar una deuda entera merece más que el destello de guardar
            // de siempre. Va antes de cerrar el modal para que se dispare
            // aunque el cierre tarde: closeModal detecta que hay una
            // celebración en marcha y se calla.
            efectoDeCelebracion();
            closeModal();
          } catch (err) {
            root.querySelector("#form-liquidar-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}

function openPrestamoForm(prestamo, state) {
  const isEdit = Boolean(prestamo);
  const capital = prestamo ? Number(prestamo.capital ?? prestamo.capital_inicial ?? 0) : "";
  const cuentas = state?.cuentas ?? [];
  // De dónde sale el dinero solo se pregunta al CREAR el préstamo. Al
  // editar uno que ya existe no aparece: el dinero ya salió en su día, y
  // volver a preguntarlo solo serviría para descontarlo dos veces.
  const preguntarOrigen = !isEdit && cuentas.length > 0;
  openModal(
    `
    <h2 class="modal__title">${isEdit ? "Editar préstamo" : "Nuevo préstamo"}</h2>
    <form id="form-prestamo" class="form-grid">
      <label class="field field--full">
        <span class="field__label">Persona</span>
        <input type="text" name="persona" required value="${esc(prestamo?.persona ?? "")}" placeholder="Nombre de la persona" />
      </label>
      <label class="field">
        <span class="field__label">Capital prestado</span>
        <input type="number" step="0.01" name="capital" required value="${capital}" placeholder="100.00" />
      </label>
      ${
        preguntarOrigen
          ? `
      <label class="field">
        <span class="field__label">¿De qué cuenta sale el dinero?</span>
        <select name="cuenta_origen_id">
          ${optionsFrom(cuentas)}
          <option value="">No descontarlo de ninguna cuenta</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">¿Qué día se lo diste?</span>
        <input type="date" name="fecha_entrega" value="${todayISO()}" />
      </label>
      <p class="entity-card__meta field--full" style="margin:-4px 0 4px;">
        El capital sale de esa cuenta y cuenta como gasto del día: ese dinero
        ya no lo tienes. Cuando te lo devuelvan, entrará como ingreso.
      </p>`
          : ""
      }
      <label class="field">
        <span class="field__label">Interés (%)</span>
        <input type="number" step="0.01" name="interes_porcentaje" value="${prestamo?.interes_porcentaje ?? 0}" placeholder="20" />
      </label>
      <label class="field">
        <span class="field__label">Interés fijo (€, opcional)</span>
        <input type="number" step="0.01" name="interes_manual" value="${prestamo?.interes_manual ?? ""}" placeholder="Vacío = se calcula con el %" />
      </label>
      <p class="entity-card__meta field--full" id="prestamo-total-linea" style="margin:-4px 0 4px;"></p>
      ${
        isEdit
          ? `
      <label class="field">
        <span class="field__label">Ya pagado hasta ahora (€)</span>
        <input type="number" step="0.01" min="0" name="pagado" value="${pagadoDe(prestamo)}" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field__label">Te debe ahora (€)</span>
        <input type="number" step="0.01" min="0" name="debe" value="${pendienteDe(prestamo)}" placeholder="0.00" />
      </label>
      <p class="entity-card__meta field--full" style="margin:-4px 0 4px;">Cambia uno y el otro se ajusta solo.</p>`
          : ""
      }
      <label class="field">
        <span class="field__label">¿Qué día te tiene que pagar? (opcional)</span>
        <input type="date" name="fecha_interes" value="${prestamo?.fecha_interes ?? ""}" />
      </label>
      <label class="field">
        <span class="field__label">¿Ese cobro se repite?</span>
        <select name="cobro_repite">
          <option value="no" ${(prestamo?.cobro_repite ?? "no") === "no" ? "selected" : ""}>No, es un cobro único</option>
          <option value="semana" ${prestamo?.cobro_repite === "semana" ? "selected" : ""}>Cada semana</option>
          <option value="mes" ${prestamo?.cobro_repite === "mes" ? "selected" : ""}>Cada mes</option>
        </select>
      </label>
      <p class="entity-card__meta field--full" style="margin:-4px 0 4px;">
        El día del cobro te sale un aviso en Préstamos y en el Dashboard.
        Al apuntar el pago, la fecha salta sola a la siguiente.
      </p>
      <label class="field">
        <span class="field__label">Estado</span>
        <select name="estado">${ESTADOS.map((e) => `<option ${prestamo?.estado === e ? "selected" : ""}>${e}</option>`).join("")}</select>
      </label>
      <label class="field field--full">
        <span class="field__label">Notas del préstamo (opcional)</span>
        <textarea name="notas" rows="3" placeholder="Los detalles para tenerlo controlado: qué acordasteis, cuándo prometió pagar, si dejó algo a cuenta…">${esc(prestamo?.notas ?? "")}</textarea>
      </label>
      <p class="field-error" id="form-prestamo-error"></p>
      <div class="modal__actions field--full">
        <button type="button" class="btn btn--ghost" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Guardar" : "Añadir"}</button>
      </div>
    </form>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancel").addEventListener("click", closeModal);
        const form = root.querySelector("#form-prestamo");
        // La línea del total, en vivo: capital + interés = lo que debe.
        const totalActual = () => {
          const cap = Number(form.capital.value || 0);
          const manual = form.interes_manual.value !== "" ? Number(form.interes_manual.value) : null;
          const interes = manual !== null ? manual : round2(cap * (Number(form.interes_porcentaje.value || 0) / 100));
          return { cap, interes, total: round2(cap + interes) };
        };
        // Al editar, "Ya pagado" y "Te debe ahora" son las dos caras de la
        // misma moneda: se toca cualquiera y la otra se ajusta. Si se pide
        // que deba más que el total, el total es el techo: hay que subir el
        // capital o el interés, y la línea lo dice.
        const sincronizar = (origen) => {
          if (!isEdit || !form.debe) return;
          const { total } = totalActual();
          if (origen === "debe") {
            const debe = Math.max(0, Number(form.debe.value || 0));
            form.pagado.value = round2(total - Math.min(debe, total)).toFixed(2);
          } else {
            const pagado = Math.max(0, Number(form.pagado.value || 0));
            form.debe.value = Math.max(0, round2(total - pagado)).toFixed(2);
          }
        };
        const pintarTotal = () => {
          const { cap, interes, total } = totalActual();
          const linea = root.querySelector("#prestamo-total-linea");
          if (!(cap > 0)) {
            linea.innerHTML = "";
            return;
          }
          if (isEdit && form.debe) {
            const pagado = Math.max(0, Number(form.pagado.value || 0));
            const debe = Math.max(0, round2(total - pagado));
            const pideDeMas = Number(form.debe.value || 0) > total + 0.004;
            linea.innerHTML = `<span>Total a devolver ${formatEUR(total)} · ya pagado ${formatEUR(pagado)} → te debe ${formatEUR(debe)}.</span>${
              pideDeMas ? ` <span class="prestamo-vence--tarde">Para que deba más, sube el capital o el interés.</span>` : ""
            }`;
            return;
          }
          linea.innerHTML = `Total a devolver: <strong>${formatEUR(total)}</strong>${interes > 0 ? ` (${formatEUR(cap)} + ${formatEUR(interes)} de interés)` : ""}. Cada pago resta de ahí hasta liquidar.`;
        };
        pintarTotal();
        ["capital", "interes_porcentaje", "interes_manual"].forEach((n) =>
          form[n].addEventListener("input", () => {
            sincronizar("pagado");
            pintarTotal();
          })
        );
        form.debe?.addEventListener("input", () => {
          sincronizar("debe");
          pintarTotal();
        });
        form.pagado?.addEventListener("input", () => {
          sincronizar("pagado");
          pintarTotal();
        });
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = {
            persona: f.persona.value.trim(),
            capital: Number(f.capital.value),
            interes_porcentaje: Number(f.interes_porcentaje.value || 0),
            interes_manual: f.interes_manual.value !== "" ? Number(f.interes_manual.value) : null,
            fecha_interes: f.fecha_interes.value || null,
            cobro_repite: f.cobro_repite.value,
            estado: f.estado.value,
            notas: f.notas.value.trim(),
          };
          // Al editar se puede corregir a mano cuánto lleva pagado (para
          // cuadrar préstamos antiguos); si con eso queda a cero, se cierra.
          if (isEdit && f.pagado) {
            data.pagado = Number(f.pagado.value || 0);
            const interes = data.interes_manual !== null ? data.interes_manual : round2(data.capital * (data.interes_porcentaje / 100));
            if (data.pagado >= round2(data.capital + interes) - 0.004 && data.pagado > 0) data.estado = "Pagado";
          }
          try {
            if (isEdit) {
              await updatePrestamo(prestamo.id, data);
            } else {
              const cuentaOrigen = preguntarOrigen ? f.cuenta_origen_id.value : "";
              if (cuentaOrigen) {
                // Se guarda como "Gasto": ese dinero ya no está, y así las
                // cuentas del mes cuadran con la realidad. La otra mitad de
                // la simetría ya existe — cada cobro (interés, plan,
                // liquidación) entra como "Ingreso" cuando llega.
                const movimiento = await addMovimiento({
                  tipo: "Gasto",
                  importe: data.capital,
                  categoria_id: await idCategoriaPrestamosDados(state?.categorias),
                  cuenta_id: cuentaOrigen,
                  cuenta_destino_id: null,
                  fecha: toTimestamp(f.fecha_entrega.value || todayISO()),
                  subcategoria: `Préstamo a ${data.persona}`,
                  nota: "",
                });
                // La cuenta se queda apuntada en el préstamo: los cobros
                // (interés, días del plan, liquidación) ya la traen puesta
                // por defecto, que es donde suele volver el dinero.
                data.cuenta_id = cuentaOrigen;
                data.movimiento_origen_id = movimiento.id;
              }
              const creado = await addPrestamo(data);
              if (creado?.id) abrirTarjetaPrestamo(creado.id);
            }
            closeModal();
          } catch (err) {
            root.querySelector("#form-prestamo-error").textContent = "No se pudo guardar. Inténtalo de nuevo.";
          }
        });
      },
    }
  );
}
