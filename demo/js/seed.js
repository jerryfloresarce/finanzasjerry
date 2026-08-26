// Los datos con los que arranca la app la primera vez.
//
// Aquí no hay nada de nadie: son unas cuentas y unas categorías genéricas
// para que la app no empiece vacía del todo. El asistente reescribe este
// archivo entero con TUS bancos y TUS categorías si eliges la versión a
// medida; si eliges la estándar, se queda esto y ya lo cambias desde la app
// cuando quieras (Cuentas y Categorías tienen sus botones de editar).
//
// Solo se ofrece cuando no hay ninguna cuenta creada todavía, para no
// duplicar nada si ya has empezado a usarla.

import { addCuenta, addCategoria, addSuscripcion } from "./db.js?v=67";

const hoy = new Date().toISOString().slice(0, 10);

// saldo_inicial es lo que tenías en esa cuenta el día fecha_inicio. A partir
// de ahí, el saldo que ves lo calcula la app sumando tus movimientos, así
// que nunca se puede descuadrar. Se dejan a cero: pon el tuyo desde la app.
const CUENTAS = [
  { nombre: "Cuenta corriente", tipo: "Corriente", saldo_inicial: 0, fecha_inicio: hoy, activa: true },
  { nombre: "Ahorro", tipo: "Ahorro", saldo_inicial: 0, fecha_inicio: hoy, activa: true },
  { nombre: "Efectivo", tipo: "Efectivo", saldo_inicial: 0, fecha_inicio: hoy, activa: true },
];

// "Fijo" es lo que pagas sí o sí todos los meses; "Variable", lo que depende
// de cómo te dé el mes. El límite mensual es opcional: si lo pones, el
// Dashboard te enseña cuánto llevas gastado de ese tope.
const CATEGORIAS = [
  { nombre: "Vivienda", tipo: "Fijo", limite_mensual: null },
  { nombre: "Suministros y facturas", tipo: "Fijo", limite_mensual: null },
  { nombre: "Suscripciones digitales", tipo: "Fijo", limite_mensual: null },
  { nombre: "Transporte", tipo: "Fijo", limite_mensual: null },
  { nombre: "Compra del súper", tipo: "Variable", limite_mensual: null },
  { nombre: "Comer fuera", tipo: "Variable", limite_mensual: null },
  { nombre: "Ocio", tipo: "Variable", limite_mensual: null },
  { nombre: "Salud", tipo: "Variable", limite_mensual: null },
  { nombre: "Compras y hogar", tipo: "Variable", limite_mensual: null },
  { nombre: "Otros", tipo: "Variable", limite_mensual: null },
];

// Sin suscripciones de serie: las tuyas las añades desde "Gastos fijos", o
// se las dices al asistente y te las deja puestas.
const SUSCRIPCIONES = [];

export async function seedInitialData() {
  const idCategorias = new Map();

  for (const c of CUENTAS) await addCuenta(c);

  for (const c of CATEGORIAS) {
    const ref = await addCategoria(c);
    idCategorias.set(c.nombre, ref.id);
  }

  for (const s of SUSCRIPCIONES) {
    const { categoria, ...resto } = s;
    await addSuscripcion({ ...resto, categoria_id: idCategorias.get(categoria) ?? null });
  }

  return {
    cuentas: CUENTAS.length,
    categorias: CATEGORIAS.length,
    suscripciones: SUSCRIPCIONES.length,
    prestamos: 0,
  };
}
