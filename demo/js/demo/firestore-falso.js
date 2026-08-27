// Modo demostración: sustituto de firebase-firestore.js.
//
// Una base de datos de mentira que vive en la memoria del navegador. Tiene
// las mismas funciones que usa la app (collection, addDoc, onSnapshot…) con
// la misma forma, así que la app funciona entera: puedes añadir un gasto,
// borrarlo, ver los gráficos moverse. Lo único que no hace es guardar: al
// recargar la página, vuelve a estar como al principio.

import { datosDeDemostracion } from "./datos-demo.js?v=72";

const almacen = new Map();
const oyentes = new Set();
let siguienteId = 1;

function coleccion(nombre) {
  if (!almacen.has(nombre)) almacen.set(nombre, new Map());
  return almacen.get(nombre);
}

// Se avisa en el siguiente ciclo, no en el acto, porque Firestore también lo
// hace así: la app agrupa los avisos que llegan juntos y si aquí fueran
// síncronos se comportaría distinto a como se comporta de verdad.
let avisoPendiente = null;
function avisar() {
  if (avisoPendiente) return;
  avisoPendiente = setTimeout(() => {
    avisoPendiente = null;
    oyentes.forEach((fn) => fn());
  }, 0);
}

for (const [nombre, filas] of Object.entries(datosDeDemostracion())) {
  const col = coleccion(nombre);
  filas.forEach((fila) => {
    const { id, ...resto } = fila;
    col.set(id, resto);
  });
}

export function getFirestore() {
  return { tipo: "demostracion" };
}

export function collection(db, nombre) {
  return { tipo: "coleccion", nombre };
}

export function doc(db, nombre, id) {
  return { tipo: "documento", nombre, id };
}

export function orderBy(campo, direccion = "asc") {
  return { campo, direccion };
}

export function query(ref, ...clausulas) {
  return { ...ref, orden: clausulas.filter((c) => c && c.campo) };
}

function instantaneaDeColeccion(ref) {
  const col = coleccion(ref.nombre);
  let filas = [...col.entries()].map(([id, datos]) => ({ id, ...datos }));
  for (const { campo, direccion } of ref.orden || []) {
    filas.sort((a, b) => {
      const va = valorOrdenable(a[campo]);
      const vb = valorOrdenable(b[campo]);
      if (va === vb) return 0;
      return (va < vb ? -1 : 1) * (direccion === "desc" ? -1 : 1);
    });
  }
  return { docs: filas.map(({ id, ...datos }) => ({ id, data: () => datos })) };
}

function valorOrdenable(v) {
  if (v && typeof v.toDate === "function") return v.toDate().getTime();
  return v ?? 0;
}

export function onSnapshot(ref, callback) {
  const emitir = () => {
    if (ref.tipo === "documento") {
      const datos = coleccion(ref.nombre).get(ref.id);
      callback({ exists: () => Boolean(datos), data: () => datos || {} });
      return;
    }
    callback(instantaneaDeColeccion(ref));
  };
  oyentes.add(emitir);
  setTimeout(emitir, 0);
  return () => oyentes.delete(emitir);
}

export async function addDoc(ref, datos) {
  const id = `demo-${siguienteId++}`;
  coleccion(ref.nombre).set(id, { ...datos });
  avisar();
  return { id };
}

export async function updateDoc(ref, datos) {
  const col = coleccion(ref.nombre);
  col.set(ref.id, { ...(col.get(ref.id) || {}), ...datos });
  avisar();
}

export async function deleteDoc(ref) {
  coleccion(ref.nombre).delete(ref.id);
  avisar();
}

export async function setDoc(ref, datos, opciones = {}) {
  const col = coleccion(ref.nombre);
  col.set(ref.id, opciones.merge ? { ...(col.get(ref.id) || {}), ...datos } : { ...datos });
  avisar();
}

export const Timestamp = {
  fromDate: (fecha) => ({ toDate: () => fecha }),
};

export async function disableNetwork() {}
export async function enableNetwork() {}
