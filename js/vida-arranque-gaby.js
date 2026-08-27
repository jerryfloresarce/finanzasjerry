// El arranque del perfil de Gaby: sus cuentas con sus saldos, sus
// categorías, sus gastos fijos y sus huchas, tal y como los contó Jerry.
// Se ofrece una sola vez, desde la pantalla Hoy de su perfil, cuando aún
// no tiene ninguna cuenta — y todo lo que crea queda sellado como suyo
// por los ganchos de vida-perfil.js, porque se ejecuta viendo su perfil.
//
// También deja compartida la Revolut conjunta: la cuenta pasa a
// perfil "ambos" (visible y con el mismo saldo para los dos) junto con
// sus movimientos de siempre, que son los que forman ese saldo.
//
// Este archivo es PERSONAL (vida-*): el kit lo excluye entero.

import { addCuenta, addCategoria, addSuscripcion, addMetaAhorro, updateCuenta, updateMovimiento, fechaISO } from "./db.js?v=72";
import { crudos, esGaby } from "./vida-perfil.js?v=72";

// ¿Toca ofrecer el arranque? Solo en su perfil, con los datos ya cargados
// y ni una cuenta suya creada todavía.
export function necesitaArranqueGaby(state) {
  return esGaby() && state?.ready && state.cuentas.length === 0;
}

export async function arrancarPerfilGaby() {
  const hoy = fechaISO();

  // 1 · Sus cuentas, con el saldo que tienen hoy.
  const cuentas = [
    { nombre: "Imagin", tipo: "Corriente", saldo_inicial: 0.95 },
    { nombre: "Trade Republic", tipo: "Ahorro", saldo_inicial: 1.29 },
    { nombre: "Revolut", tipo: "Corriente", saldo_inicial: 1.89 },
    { nombre: "Efectivo", tipo: "Efectivo", saldo_inicial: 36.02 },
  ];
  const refs = {};
  for (const c of cuentas) {
    refs[c.nombre] = await addCuenta({ ...c, fecha_inicio: hoy, activa: true, icono: null });
  }

  // 2 · Sus categorías (los iconos salen solos por el nombre).
  const categorias = [
    { nombre: "Nómina (tienda)", tipo: "Fijo" },
    { nombre: "Regalos de la familia", tipo: "Variable" },
    { nombre: "Suscripciones", tipo: "Fijo" },
    { nombre: "Uñas", tipo: "Ocio" },
    { nombre: "Compra de casa", tipo: "Variable" },
    { nombre: "Comer fuera", tipo: "Ocio" },
    { nombre: "Caprichos", tipo: "Ocio" },
    { nombre: "Transporte", tipo: "Variable" },
  ];
  const catRefs = {};
  for (const c of categorias) catRefs[c.nombre] = await addCategoria(c);

  // 3 · Sus gastos fijos. Todos salen de Imagin menos las uñas, que a
  //     veces son en efectivo: la cuenta se elige igualmente al pagar.
  const imagin = refs["Imagin"].id;
  const catSusc = catRefs["Suscripciones"].id;
  const fijos = [
    { nombre: "Disney+", precio: 6.99, frecuencia: "Mensual" },
    { nombre: "iCloud+", precio: 0.99, frecuencia: "Mensual" },
    { nombre: "Gmail (Google One)", precio: 1.99, frecuencia: "Mensual" },
    { nombre: "Planner (agenda)", precio: 9.99, frecuencia: "Anual" },
    { nombre: "Canva", precio: 12, frecuencia: "Mensual" },
    { nombre: "Claude", precio: 21.78, frecuencia: "Mensual" },
    { nombre: "Spotify", precio: 16.99, frecuencia: "Mensual" },
    { nombre: "Crunchyroll", precio: 5.99, frecuencia: "Mensual" },
    { nombre: "Uñas", precio: 40, frecuencia: "Mensual", categoria_id: catRefs["Uñas"].id },
  ];
  for (const s of fijos) {
    await addSuscripcion({ categoria_id: catSusc, cuenta_id: imagin, activa: true, ...s });
  }

  // 4 · Sus huchas. Los objetivos son de partida: se corrigen tocando la
  //     meta cuando sepa cuánto quiere de verdad.
  const huchas = [
    { nombre: "Viaje a Brasil", objetivo: 1500, icono: "✈️" },
    { nombre: "Corea del Sur con su hermana", objetivo: 2500, icono: "💜" },
    { nombre: "Su PC Gaming", objetivo: 1200, icono: "🖥️" },
  ];
  for (const h of huchas) {
    await addMetaAhorro({ ...h, fecha_objetivo: null, aportaciones: [], creada: hoy });
  }

  // 5 · La Revolut conjunta pasa a ser de los dos: la cuenta de Jerry que
  //     ya existe se marca "ambos" y sus movimientos también, porque el
  //     saldo sale de ellos y tiene que cuadrar desde los dos perfiles.
  const conjunta = (crudos.cuentas || []).find((c) => /revolut/i.test(c.nombre || "") && /conjunt/i.test(c.nombre || ""));
  if (conjunta && conjunta.perfil !== "ambos") {
    await updateCuenta(conjunta.id, { perfil: "ambos" });
    const suyos = (crudos.movimientos || []).filter(
      (m) => (m.cuenta_id === conjunta.id || m.cuenta_destino_id === conjunta.id) && m.perfil !== "ambos"
    );
    for (const m of suyos) await updateMovimiento(m.id, { perfil: "ambos" });
  }

  return { conjuntaCompartida: Boolean(conjunta) };
}
