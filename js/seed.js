// Importación única de tus datos iniciales (cuentas, categorías,
// suscripciones fijas y préstamos dados) tal como me los pasaste.
// Solo se ofrece cuando no hay ninguna cuenta creada todavía, para no
// duplicar nada si ya has empezado a usar la app.
import { addCuenta, addCategoria, addSuscripcion, addPrestamo, addPagoPrestamo, toTimestamp } from "./db.js";

const hoy = new Date().toISOString().slice(0, 10);

const CUENTAS = [
  { nombre: "Imagin", tipo: "Corriente", saldo_inicial: 888.79, fecha_inicio: hoy, activa: true },
  { nombre: "Santander", tipo: "Corriente", saldo_inicial: 0, fecha_inicio: hoy, activa: true },
  { nombre: "Revolut", tipo: "Corriente", saldo_inicial: 5.28, fecha_inicio: hoy, activa: true },
  { nombre: "Revolut (cuenta conjunta)", tipo: "Corriente", saldo_inicial: 3.98, fecha_inicio: hoy, activa: true },
  { nombre: "Trade Republic", tipo: "Ahorro", saldo_inicial: 1509.48, fecha_inicio: hoy, activa: true },
  { nombre: "Efectivo", tipo: "Efectivo", saldo_inicial: 0, fecha_inicio: hoy, activa: true },
];

const CATEGORIAS = [
  { nombre: "Suministros y facturas", tipo: "Fijo", limite_mensual: null },
  { nombre: "Pasanaco", tipo: "Fijo", limite_mensual: null },
  { nombre: "Gimnasio", tipo: "Fijo", limite_mensual: null },
  { nombre: "Préstamo Bankinter", tipo: "Fijo", limite_mensual: null },
  { nombre: "Suscripciones digitales", tipo: "Fijo", limite_mensual: null },
  { nombre: "Comida a domicilio", tipo: "Variable", limite_mensual: 150 },
  { nombre: "Compras y hogar", tipo: "Variable", limite_mensual: null },
  { nombre: "Ropa", tipo: "Variable", limite_mensual: null },
  { nombre: "Ocio", tipo: "Ocio", limite_mensual: null },
  { nombre: "Préstamos dados", tipo: "PrestamoDado", limite_mensual: null },
];

// suscripciones: [nombre, precio, categoriaNombre]
const SUSCRIPCIONES = [
  ["Luz", 105.62, "Suministros y facturas"],
  ["Digi", 20, "Suministros y facturas"],
  ["Aquaservice", 36.03, "Suministros y facturas"],
  ["Pasanaco", 400, "Pasanaco"],
  ["Gimnasio (Jerry, Gaby y Dennys)", 150, "Gimnasio"],
  ["Préstamo Bankinter", 309.26, "Préstamo Bankinter"],
  ["Glovo Prime", 8, "Suscripciones digitales"],
  ["Claude Pro", 22, "Suscripciones digitales"],
];

export async function seedInitialData() {
  const cuentaIds = {};
  for (const c of CUENTAS) {
    const ref = await addCuenta(c);
    cuentaIds[c.nombre] = ref.id;
  }

  const categoriaIds = {};
  for (const c of CATEGORIAS) {
    const ref = await addCategoria(c);
    categoriaIds[c.nombre] = ref.id;
  }

  const cuentaPrincipal = cuentaIds["Imagin"];
  for (const [nombre, precio, catNombre] of SUSCRIPCIONES) {
    await addSuscripcion({
      nombre,
      precio,
      frecuencia: "Mensual",
      categoria_id: categoriaIds[catNombre],
      cuenta_id: cuentaPrincipal,
      proximo_pago: hoy,
      activa: true,
    });
  }

  // Préstamo 1 a Liz colombiana: 600€ capital + 100€ interés,
  // devuelto en 2 pagos de 350€ (06/07 y 06/08/2026).
  const liz1 = await addPrestamo({
    persona: "Liz colombiana",
    capital_inicial: 600,
    interes_porcentaje: Number(((100 / 600) * 100).toFixed(2)),
    fecha_inicio: "2026-07-06",
    estado: "Activo",
    notas: "Pago 1: 350€ el 06/07/2026. Pago 2: 350€ el 06/08/2026. Marca cada uno como pagado cuando lo cobres.",
  });
  await addPagoPrestamo({
    prestamo_id: liz1.id,
    fecha: toTimestamp("2026-07-06"),
    tipo: "Ambos",
    importe: 350,
    importe_capital: 300,
    importe_interes: 50,
    pagado: false,
  });
  await addPagoPrestamo({
    prestamo_id: liz1.id,
    fecha: toTimestamp("2026-08-06"),
    tipo: "Ambos",
    importe: 350,
    importe_capital: 300,
    importe_interes: 50,
    pagado: false,
  });

  // Préstamo 2 a Liz colombiana: 200€ capital + 100€ interés, máximo 05/09/2026.
  const liz2 = await addPrestamo({
    persona: "Liz colombiana",
    capital_inicial: 200,
    interes_porcentaje: 50,
    fecha_inicio: "2026-07-18",
    estado: "Activo",
    notas: "Lo devuelve a finales de agosto. Máximo 05/09/2026: 300€ (200 capital + 100 interés).",
  });
  await addPagoPrestamo({
    prestamo_id: liz2.id,
    fecha: toTimestamp("2026-09-05"),
    tipo: "Ambos",
    importe: 300,
    importe_capital: 200,
    importe_interes: 100,
    pagado: false,
  });

  // Sandra, amiga de señora Francisca: 500€ al 20%, interés ya cobrado.
  const sandra = await addPrestamo({
    persona: "Sandra (amiga de señora Francisca)",
    capital_inicial: 500,
    interes_porcentaje: 20,
    fecha_inicio: "2026-07-25",
    estado: "Activo",
    notas: "Interés pagado el 25/07/2026. Capital (500€) todavía pendiente.",
  });
  await addPagoPrestamo({
    prestamo_id: sandra.id,
    fecha: toTimestamp("2026-07-25"),
    tipo: "Interes",
    importe: 100,
    importe_capital: 0,
    importe_interes: 100,
    pagado: true,
  });

  // Préstamo sin nombre de persona todavía — necesito que me digas quién es
  // y cuánto paga cada día para completar el calendario de cobros.
  await addPrestamo({
    persona: "(pendiente — dime el nombre)",
    capital_inicial: 500,
    interes_porcentaje: 0,
    fecha_inicio: "2026-07-29",
    estado: "Activo",
    notas:
      "Calendario de cobro diario del 07/08/2026 al 29/08/2026 (sin cobro los domingos: 09/08, 16/08, 23/08). " +
      "Falta el nombre de la persona y el importe de cada cuota diaria — dímelos y te los registro como pagos.",
  });

  return {
    cuentas: CUENTAS.length,
    categorias: CATEGORIAS.length,
    suscripciones: SUSCRIPCIONES.length,
    prestamos: 4,
  };
}
