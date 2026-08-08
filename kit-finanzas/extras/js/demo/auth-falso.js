// Modo demostración: sustituto de firebase-auth.js.
//
// Hace de portero de mentira. Entra con cualquier correo y cualquier
// contraseña, porque el objetivo es que veas la app, no que te pelees con
// un registro. El botón de cerrar sesión funciona de verdad y te devuelve a
// la pantalla de acceso, para que veas también esa parte.

const USUARIO = { uid: "demo", email: "tu@correo.com" };

const oyentes = new Set();
let usuarioActual = USUARIO;

function avisar() {
  oyentes.forEach((fn) => fn(usuarioActual));
}

export function getAuth() {
  return {
    get currentUser() {
      return usuarioActual;
    },
  };
}

export function onAuthStateChanged(auth, callback) {
  oyentes.add(callback);
  // Firebase avisa del estado inicial de forma asíncrona, y la app cuenta
  // con ello (monta cosas justo después de llamar aquí). Si avisáramos en
  // el acto, el orden sería distinto al real y podría fallar solo en la
  // demostración.
  setTimeout(() => callback(usuarioActual), 0);
  return () => oyentes.delete(callback);
}

export async function signInWithEmailAndPassword(auth, email) {
  usuarioActual = { ...USUARIO, email: email || USUARIO.email };
  avisar();
  return { user: usuarioActual };
}

export async function signOut() {
  usuarioActual = null;
  avisar();
}

export async function sendPasswordResetEmail() {
  // En la demostración no hay correo que enviar. Se resuelve sin más para
  // que el botón no dé error, y el aviso de "revisa tu correo" que sale
  // después ya avisa de que esto es una demostración.
}

export async function setPersistence() {}

export const indexedDBLocalPersistence = { tipo: "demostracion" };
export const browserLocalPersistence = { tipo: "demostracion" };
