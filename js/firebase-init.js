import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, setPersistence, indexedDBLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=23";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// La opción más duradera de sesión guardada que ofrece Firebase en el
// navegador (por defecto ya suele usar esta, pero se deja explícito para
// que no dependa de qué versión del SDK decida por su cuenta). Aun así,
// en modo standalone (icono en pantalla de inicio) iOS puede vaciar este
// almacenamiento tras un tiempo de inactividad — si eso pasa, no hay forma
// de evitarlo desde aquí sin un servidor propio.
setPersistence(auth, indexedDBLocalPersistence).catch((err) => {
  console.error("No se pudo configurar la persistencia de sesión:", err);
});
