// Correcciones puntuales de datos, de un solo uso. Operan sobre el estado
// ya cargado en memoria (state) y llaman a los mismos helpers de db.js
// que usa el resto de la app. Pensado para ejecutarse una vez desde un
// botón temporal y luego poder borrarse.
import { state } from "./store.js";
import {
  updatePrestamo,
  addPagoPrestamo,
  updatePagoPrestamo,
  updateSuscripcion,
  toTimestamp,
  fromTimestamp,
} from "./db.js";

const ANA_FECHAS = [
  "2026-08-07", "2026-08-08", "2026-08-10", "2026-08-11", "2026-08-12",
  "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-17", "2026-08-18",
  "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-24",
  "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29",
];

export function pendingCorrections() {
  const ana = state.prestamos.find((p) => p.persona === "(pendiente — dime el nombre)");
  const liz = state.prestamos.find((p) => p.persona === "Liz colombiana" && Number(p.capital_inicial) === 600);
  const pasanaco = state.suscripciones.find((s) => s.nombre === "Pasanaco" && Number(s.precio) === 400);
  return Boolean(ana || liz || pasanaco);
}

export async function applyAugustCorrections() {
  const results = [];

  const ana = state.prestamos.find((p) => p.persona === "(pendiente — dime el nombre)");
  if (ana) {
    await updatePrestamo(ana.id, {
      persona: "Ana (mamá)",
      interes_porcentaje: 20,
      notas:
        "Ciclo de 20 días: devuelve 30€/día (excepto domingos). Al terminar este ciclo se renueva " +
        "con un préstamo nuevo igual, empezando al día siguiente — cuando lo acabe, crea el siguiente ciclo a mano.",
    });
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
