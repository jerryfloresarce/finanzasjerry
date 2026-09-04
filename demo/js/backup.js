// Copia de seguridad manual: exporta todas las colecciones a un JSON
// descargable, e importa desde ese JSON creando documentos nuevos y
// reconstruyendo las referencias entre ellos (categoria_id, cuenta_id,
// prestamo_id), ya que Firestore asigna un ID nuevo a cada documento creado.
import {
  addCuenta,
  addCategoria,
  addMovimiento,
  addSuscripcion,
  addPrestamo,
  addPagoPrestamo,
  toTimestamp,
  fromTimestamp,
} from "./db.js?v=114";

export function exportarDatos(state) {
  const data = {
    version: 1,
    exportado_en: new Date().toISOString(),
    cuentas: state.cuentas,
    categorias: state.categorias,
    suscripciones: state.suscripciones,
    prestamos: state.prestamos,
    movimientos: state.movimientos.map((m) => ({ ...m, fecha: fromTimestamp(m.fecha)?.toISOString() ?? null })),
    pagosPrestamos: state.pagosPrestamos.map((p) => ({ ...p, fecha: fromTimestamp(p.fecha)?.toISOString() ?? null })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // El nombre del archivo sale del título de la app, no escrito a mano: si
  // algún día se llama de otra forma, la copia se llama igual sin tener que
  // acordarse de cambiarlo aquí.
  const nombreApp = (document.title || "finanzas")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  a.download = `${nombreApp}-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importarDatos(data) {
  const idMapCuentas = new Map();
  const idMapCategorias = new Map();
  const idMapPrestamos = new Map();

  for (const c of data.cuentas || []) {
    const { id, ...rest } = c;
    const ref = await addCuenta(rest);
    idMapCuentas.set(id, ref.id);
  }

  for (const c of data.categorias || []) {
    const { id, ...rest } = c;
    const ref = await addCategoria(rest);
    idMapCategorias.set(id, ref.id);
  }

  for (const s of data.suscripciones || []) {
    const { id, categoria_id, cuenta_id, ...rest } = s;
    await addSuscripcion({
      ...rest,
      categoria_id: idMapCategorias.get(categoria_id) ?? categoria_id,
      cuenta_id: idMapCuentas.get(cuenta_id) ?? cuenta_id,
    });
  }

  for (const m of data.movimientos || []) {
    const { id, categoria_id, cuenta_id, cuenta_destino_id, fecha, ...rest } = m;
    await addMovimiento({
      ...rest,
      categoria_id: categoria_id ? idMapCategorias.get(categoria_id) ?? categoria_id : null,
      cuenta_id: idMapCuentas.get(cuenta_id) ?? cuenta_id,
      cuenta_destino_id: cuenta_destino_id ? idMapCuentas.get(cuenta_destino_id) ?? cuenta_destino_id : null,
      fecha: fecha ? toTimestamp(fecha) : null,
    });
  }

  for (const p of data.prestamos || []) {
    const { id, ...rest } = p;
    const ref = await addPrestamo(rest);
    idMapPrestamos.set(id, ref.id);
  }

  for (const pg of data.pagosPrestamos || []) {
    const { id, prestamo_id, fecha, ...rest } = pg;
    await addPagoPrestamo({
      ...rest,
      prestamo_id: idMapPrestamos.get(prestamo_id) ?? prestamo_id,
      fecha: fecha ? toTimestamp(fecha) : null,
    });
  }
}
