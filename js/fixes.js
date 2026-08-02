// Correcciones puntuales de datos, de un solo uso. Operan sobre el estado
// ya cargado en memoria (state) y llaman a los mismos helpers de db.js
// que usa el resto de la app. Pensado para ejecutarse una vez desde un
// botón temporal y luego poder borrarse.
import { state } from "./store.js";
import {
  addPrestamo,
  updatePrestamo,
  addPagoPrestamo,
  updatePagoPrestamo,
  updateSuscripcion,
  updateConfig,
  toTimestamp,
  fromTimestamp,
} from "./db.js";

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
// Historial completo de Jessica y Silvia. "AumentoCapital" = el interés
// que no se pagó a tiempo y se sumó al capital (así queda registrado
// como hecho, no como pago pendiente).
// ---------------------------------------------------------------------

function pago(fecha, tipo, importe, pagado) {
  const importe_capital = tipo === "Capital" || tipo === "AumentoCapital" ? importe : 0;
  const importe_interes = tipo === "Interes" ? importe : 0;
  return { fecha: toTimestamp(fecha), tipo, importe, importe_capital, importe_interes, pagado };
}

const JESSICA_PAGOS = [
  pago("2025-09-03", "AumentoCapital", 500, true),
  pago("2025-09-27", "Capital", 500, true),
  pago("2025-10-02", "Interes", 500, true),
  pago("2025-10-02", "Interes", 100, true),
  pago("2025-11-03", "Interes", 500, true),
  pago("2025-12-03", "Interes", 500, false),
  pago("2025-12-03", "AumentoCapital", 500, true),
  pago("2026-01-03", "Interes", 600, true),
  pago("2026-02-03", "Interes", 600, false),
  pago("2026-02-03", "AumentoCapital", 600, true),
  pago("2026-03-03", "Interes", 610, true),
  pago("2026-04-03", "Interes", 110, true),
  pago("2026-04-03", "Interes", 720, true),
  pago("2026-05-03", "Interes", 720, false),
  pago("2026-05-03", "AumentoCapital", 720, true),
  pago("2026-06-03", "Interes", 864, false),
  pago("2026-06-03", "AumentoCapital", 864, true),
  pago("2026-07-03", "Interes", 1036.8, false),
  pago("2026-07-03", "AumentoCapital", 1036.8, true),
  pago("2026-08-03", "Interes", 1244.16, false),
  pago("2026-08-03", "AumentoCapital", 1244.16, true),
  pago("2026-09-03", "Interes", 1492.99, false),
];

const SILVIA_PAGOS = [
  pago("2025-09-05", "Capital", 400, true),
  pago("2025-09-05", "Interes", 140, true),
  pago("2025-09-14", "AumentoCapital", 200, true),
  pago("2025-09-22", "AumentoCapital", 200, true),
  pago("2025-11-01", "Interes", 70, true),
  pago("2025-11-01", "AumentoCapital", 100, true),
  pago("2025-12-01", "Interes", 160, true),
  pago("2026-01-01", "Interes", 160, true),
  pago("2026-01-02", "AumentoCapital", 200, true),
  pago("2026-02-01", "Interes", 200, true),
  pago("2026-03-01", "Interes", 200, false),
  pago("2026-03-01", "AumentoCapital", 200, true),
  pago("2026-04-01", "Interes", 240, true),
  pago("2026-05-01", "Interes", 240, true),
  pago("2026-06-01", "Interes", 240, true),
  pago("2026-07-01", "Interes", 240, true),
  pago("2026-08-01", "Interes", 240, false),
];

export function pendingHistorial() {
  if (state.config?.historialJessicaSilviaOk) return false;
  return !state.prestamos.some((p) => p.persona === "Jessica" || p.persona === "Silvia");
}

export function dismissHistorial() {
  return updateConfig({ historialJessicaSilviaOk: true });
}

export async function importarJessicaYSilvia() {
  const results = [];

  // Si el préstamo ya existe pero (por un fallo a mitad en un intento
  // anterior) todavía no tiene sus pagos, esto los completa en vez de
  // saltárselo por existir ya — y si ya tiene pagos, no los duplica.
  let jessica = state.prestamos.find((p) => p.persona === "Jessica");
  if (!jessica) {
    jessica = await addPrestamo({
      persona: "Jessica",
      capital_inicial: 2500,
      interes_porcentaje: 20,
      fecha_inicio: "2025-08-03",
      estado: "Activo",
      notas:
        "El interés no pagado se capitaliza (se suma al capital) cada mes. " +
        "Pago mensual el día 3. Capital y cuota suben cuando no paga a tiempo.",
    });
  }
  if (!state.pagosPrestamos.some((p) => p.prestamo_id === jessica.id)) {
    for (const p of JESSICA_PAGOS) {
      await addPagoPrestamo({ prestamo_id: jessica.id, ...p });
    }
    results.push(`Jessica: préstamo creado con ${JESSICA_PAGOS.length} movimientos.`);
  }

  let silvia = state.prestamos.find((p) => p.persona === "Silvia");
  if (!silvia) {
    silvia = await addPrestamo({
      persona: "Silvia",
      capital_inicial: 700,
      interes_porcentaje: 20,
      fecha_inicio: "2025-08-04",
      estado: "Activo",
      notas:
        "Incluye 3 préstamos adicionales (14/09/2025, 22/09/2025 y 02/01/2026) sumados al mismo capital. " +
        "El interés no pagado se capitaliza. Pago mensual el día 1.",
    });
  }
  if (!state.pagosPrestamos.some((p) => p.prestamo_id === silvia.id)) {
    for (const p of SILVIA_PAGOS) {
      await addPagoPrestamo({ prestamo_id: silvia.id, ...p });
    }
    results.push(`Silvia: préstamo creado con ${SILVIA_PAGOS.length} movimientos.`);
  }

  return results;
}
