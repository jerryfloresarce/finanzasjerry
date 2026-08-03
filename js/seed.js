// Importación única de tus datos iniciales (cuentas, categorías,
// suscripciones fijas y préstamos dados) tal como me los pasaste.
// Solo se ofrece cuando no hay ninguna cuenta creada todavía, para no
// duplicar nada si ya has empezado a usar la app.
import { addCuenta, addCategoria, addSuscripcion, addPrestamo } from "./db.js?v=16";

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
  ["Pasanaco", 600, "Pasanaco"],
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

  // Préstamo a Liz colombiana: 800€ de capital (600 + 200 de un segundo
  // préstamo), interés variable según se acuerde con ella cada mes.
  await addPrestamo({
    persona: "Liz colombiana",
    capital: 800,
    interes_porcentaje: 20,
    fecha_interes: "2026-09-06",
    estado: "Activo",
    notas: "",
  });

  // Sandra, amiga de señora Francisca: 500€ al 20%.
  await addPrestamo({
    persona: "Sandra (amiga de señora Francisca)",
    capital: 500,
    interes_porcentaje: 20,
    fecha_interes: "2026-09-25",
    estado: "Activo",
    notas: "",
  });

  // Ana (mamá): ciclo de 20 días, 30€/día excepto domingos.
  await addPrestamo({
    persona: "Ana (mamá)",
    capital: 500,
    interes_porcentaje: 20,
    fecha_interes: "2026-09-29",
    estado: "Activo",
    notas: "Ciclo de 20 días: devuelve 30€/día (excepto domingos).",
  });

  return {
    cuentas: CUENTAS.length,
    categorias: CATEGORIAS.length,
    suscripciones: SUSCRIPCIONES.length,
    prestamos: 3,
  };
}
