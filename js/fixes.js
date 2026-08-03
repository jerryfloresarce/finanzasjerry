// Correcciones puntuales de datos, de un solo uso. Operan sobre el estado
// ya cargado en memoria (state) y llaman a los mismos helpers de db.js
// que usa el resto de la app. Pensado para ejecutarse una vez desde un
// botón temporal y luego poder borrarse.
import { state } from "./store.js?v=13";
import {
  addPrestamo,
  updatePrestamo,
  addPagoPrestamo,
  updatePagoPrestamo,
  deletePagoPrestamo,
  addMovimiento,
  updateSuscripcion,
  updateConfig,
  toTimestamp,
  fromTimestamp,
} from "./db.js?v=13";

const ANA_FECHAS = [
  "2026-08-07", "2026-08-08", "2026-08-10", "2026-08-11", "2026-08-12",
  "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-17", "2026-08-18",
  "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-24",
  "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29",
];

// Una vez pulsas el botón de un banner de un solo uso, se marca en Firestore
// (colección "configuracion") para que no vuelva a aparecer — en cualquier
// dispositivo o navegador, no solo en el que pulsaste el botón. Antes esto
// se guardaba en localStorage, que es por-navegador: por eso el banner podía
// seguir saliendo en el móvil aunque ya lo hubieras "hecho" en el ordenador.
export function pendingCorrections() {
  if (state.config?.correccionesAgostoOk) return false;
  const ana = state.prestamos.find((p) => p.persona === "(pendiente — dime el nombre)");
  const liz = state.prestamos.find((p) => p.persona === "Liz colombiana" && Number(p.capital_inicial) === 600);
  const pasanaco = state.suscripciones.find((s) => s.nombre === "Pasanaco" && Number(s.precio) === 400);
  return Boolean(ana || liz || pasanaco);
}

export function dismissCorrections() {
  return updateConfig({ correccionesAgostoOk: true });
}

export async function applyAugustCorrections() {
  const results = [];

  // Comprueba tanto el nombre provisional como el ya corregido, y si ya
  // tiene pagos no los vuelve a añadir — así un reintento tras un fallo a
  // mitad (ej. de permisos) no deja el préstamo a medio corregir ni
  // duplica los 20 pagos.
  const ana = state.prestamos.find((p) => p.persona === "(pendiente — dime el nombre)" || p.persona === "Ana (mamá)");
  if (ana) {
    if (ana.persona !== "Ana (mamá)") {
      await updatePrestamo(ana.id, {
        persona: "Ana (mamá)",
        interes_porcentaje: 20,
        notas:
          "Ciclo de 20 días: devuelve 30€/día (excepto domingos). Al terminar este ciclo se renueva " +
          "con un préstamo nuevo igual, empezando al día siguiente — cuando lo acabe, crea el siguiente ciclo a mano.",
      });
    }
    const yaTienePagos = state.pagosPrestamos.some((p) => p.prestamo_id === ana.id);
    if (!yaTienePagos) {
      for (const f of ANA_FECHAS) {
        await addPagoPrestamo({
          prestamo_id: ana.id,
          fecha: toTimestamp(f),
          tipo: "Ambos",
          importe: 30,
          importe_capital: 25,
          importe_interes: 5,
          pagado: false,
        });
      }
      results.push("Ana (mamá): préstamo renombrado y 20 pagos diarios añadidos.");
    }
  }

  const liz = state.prestamos.find((p) => p.persona === "Liz colombiana" && Number(p.capital_inicial) === 600);
  if (liz) {
    await updatePrestamo(liz.id, {
      notas: "Pago 1: 350€ el 06/08/2026. Pago 2: 350€ el 06/09/2026. Marca cada uno como pagado cuando lo cobres.",
    });
    const pagos = state.pagosPrestamos
      .filter((pg) => pg.prestamo_id === liz.id)
      .sort((a, b) => (fromTimestamp(a.fecha) ?? 0) - (fromTimestamp(b.fecha) ?? 0));
    if (pagos[0]) await updatePagoPrestamo(pagos[0].id, { fecha: toTimestamp("2026-08-06") });
    if (pagos[1]) await updatePagoPrestamo(pagos[1].id, { fecha: toTimestamp("2026-09-06") });
    results.push("Liz colombiana: fechas de pago corregidas a 06/08/2026 y 06/09/2026.");
  }

  const pasanaco = state.suscripciones.find((s) => s.nombre === "Pasanaco" && Number(s.precio) === 400);
  if (pasanaco) {
    await updateSuscripcion(pasanaco.id, { precio: 600 });
    results.push("Pasanaco: actualizado de 400€ a 600€ mensuales.");
  }

  return results;
}

// ---------------------------------------------------------------------
// Reinicio de préstamos: se abandona el modelo de historial de pagos
// (pagos_prestamos), que había ido acumulando pequeños desajustes con la
// realidad (ej. Silvia mostraba 2.800€ cuando en realidad debía 1.600€).
// A partir de ahora cada préstamo guarda directamente su capital pendiente
// y la fecha del próximo interés — sin historial que se pueda desincronizar.
// ---------------------------------------------------------------------

// Fórmula antigua, usada solo aquí una vez para "congelar" el capital
// pendiente real de cualquier préstamo que no sea Jessica/Silvia (para los
// que sí tenemos la cifra correcta a mano) antes de borrar su historial.
function capitalActualLegacy(prestamo, pagos) {
  const ajuste = pagos
    .filter((p) => p.prestamo_id === prestamo.id)
    .reduce((acc, p) => {
      if (p.tipo === "AumentoCapital") return acc + Number(p.importe ?? 0);
      if (!p.pagado) return acc;
      if (p.tipo === "Capital") return acc - Number(p.importe ?? 0);
      if (p.tipo === "Ambos") return acc - Number(p.importe_capital ?? 0);
      return acc;
    }, 0);
  return Number(prestamo.capital_inicial ?? 0) + ajuste;
}

function unMesDesdeHoy() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function pendingPrestamosReset() {
  if (state.config?.prestamosResetOk) return false;
  return true;
}

export function dismissPrestamosReset() {
  return updateConfig({ prestamosResetOk: true });
}

export async function resetPrestamos() {
  const results = [];

  for (const p of state.prestamos) {
    const esJessica = p.persona === "Jessica";
    const esSilvia = p.persona === "Silvia";
    const capital = esJessica ? 7464.96 : esSilvia ? 1600 : capitalActualLegacy(p, state.pagosPrestamos);
    const fecha_interes = esJessica ? "2026-09-03" : esSilvia ? "2026-09-01" : p.fecha_interes || unMesDesdeHoy();

    await updatePrestamo(p.id, { capital, fecha_interes, estado: "Activo" });

    const pagosDelPrestamo = state.pagosPrestamos.filter((pg) => pg.prestamo_id === p.id);
    for (const pg of pagosDelPrestamo) {
      await deletePagoPrestamo(pg.id);
    }
    results.push(`${p.persona}: capital ${capital.toFixed(2)}€, ${pagosDelPrestamo.length} pagos antiguos borrados.`);
  }

  if (!state.prestamos.some((p) => p.persona === "Jessica")) {
    await addPrestamo({ persona: "Jessica", capital: 7464.96, interes_porcentaje: 20, fecha_interes: "2026-09-03", estado: "Activo", notas: "" });
    results.push("Jessica: préstamo creado.");
  }
  if (!state.prestamos.some((p) => p.persona === "Silvia")) {
    await addPrestamo({ persona: "Silvia", capital: 1600, interes_porcentaje: 20, fecha_interes: "2026-09-01", estado: "Activo", notas: "" });
    results.push("Silvia: préstamo creado.");
  }

  return results;
}

// ---------------------------------------------------------------------
// Gastos fijos de agosto 2026 que ya estaban pagados antes de tener este
// control mensual: se marcan como pagados sin afectar el saldo de ninguna
// cuenta (afecta_saldo: false), porque ese dinero ya salió y el saldo
// actual de las cuentas ya lo refleja.
// ---------------------------------------------------------------------

const GASTOS_FIJOS_AGOSTO = [
  { match: /digi/i, importe: 20 },
  { match: /aquaservice/i, importe: 36.03 },
  { match: /pasanaco/i, importe: 600 },
  { match: /gym|gimnasio/i, importe: 147.94 },
];

function enAgosto2026(ts) {
  const d = fromTimestamp(ts);
  return Boolean(d && d.getFullYear() === 2026 && d.getMonth() === 7);
}

export function pendingGastosFijosAgosto() {
  if (state.config?.gastosFijosAgostoOk) return false;
  return state.suscripciones.length > 0;
}

export function dismissGastosFijosAgosto() {
  return updateConfig({ gastosFijosAgostoOk: true });
}

export async function applyGastosFijosAgosto() {
  const results = [];
  for (const { match, importe } of GASTOS_FIJOS_AGOSTO) {
    const s = state.suscripciones.find((x) => match.test(x.nombre));
    if (!s) continue;
    const yaPagado = state.movimientos.some((m) => m.suscripcion_id === s.id && enAgosto2026(m.fecha));
    if (yaPagado) continue;
    await addMovimiento({
      tipo: "Gasto",
      importe,
      categoria_id: s.categoria_id || null,
      cuenta_id: s.cuenta_id || null,
      cuenta_destino_id: null,
      fecha: toTimestamp("2026-08-01"),
      subcategoria: s.nombre,
      nota: "",
      suscripcion_id: s.id,
      afecta_saldo: false,
    });
    results.push(`${s.nombre}: marcado como pagado en agosto (no se descontó de ninguna cuenta).`);
  }
  return results;
}
