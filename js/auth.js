import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "./firebase-init.js?v=19";
import { hasPasskey, verifyPasskey, passkeySupported } from "./passkey.js?v=19";

const loginScreen = document.getElementById("login-screen");
const lockScreen = document.getElementById("lock-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const lockUnlockBtn = document.getElementById("btn-lock-unlock");
const lockError = document.getElementById("lock-screen-error");
const lockLogoutBtn = document.getElementById("btn-lock-logout");

let onAuthReadyCallback = null;
// Se pone a true nada más pasar el Face ID una vez, para no volver a pedirlo
// dentro de la MISMA sesión de la página (solo al abrir la app de cero).
let unlockedThisSession = false;

export function onAuthReady(callback) {
  onAuthReadyCallback = callback;
}

function showApp() {
  loginScreen.classList.add("is-hidden");
  lockScreen?.classList.add("is-hidden");
  appShell.classList.remove("is-hidden");
}

async function intentarDesbloqueo() {
  if (!lockUnlockBtn) return;
  lockError.textContent = "";
  lockUnlockBtn.disabled = true;
  lockUnlockBtn.textContent = "Verificando…";
  const ok = await verifyPasskey();
  lockUnlockBtn.disabled = false;
  lockUnlockBtn.textContent = "Desbloquear con Face ID";
  if (ok) {
    unlockedThisSession = true;
    showApp();
  } else {
    lockError.textContent = "No se pudo verificar tu identidad. Inténtalo de nuevo.";
  }
}

lockUnlockBtn?.addEventListener("click", intentarDesbloqueo);
lockLogoutBtn?.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.classList.add("is-hidden");
    // El almacén de datos (Firestore) se pone en marcha igualmente aunque
    // el bloqueo de Face ID siga en pantalla, para que en cuanto se
    // desbloquee el Dashboard ya tenga los datos listos.
    if (onAuthReadyCallback) onAuthReadyCallback(user);

    if (passkeySupported() && hasPasskey() && !unlockedThisSession) {
      appShell.classList.add("is-hidden");
      lockScreen?.classList.remove("is-hidden");
      intentarDesbloqueo();
    } else {
      showApp();
    }
  } else {
    unlockedThisSession = false;
    appShell.classList.add("is-hidden");
    lockScreen?.classList.add("is-hidden");
    loginScreen.classList.remove("is-hidden");
  }
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;
  const submitBtn = loginForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Entrando…";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("Error de login:", err.code, err.message);
    const mensajes = {
      "auth/invalid-email": "Ese email no tiene un formato válido.",
      "auth/user-not-found": "No existe ningún usuario con ese email en Firebase.",
      "auth/wrong-password": "La contraseña no coincide con ese email.",
      "auth/invalid-credential": "Email o contraseña incorrectos (revisa mayúsculas y espacios).",
      "auth/user-disabled": "Este usuario está deshabilitado en Firebase.",
      "auth/too-many-requests": "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
      "auth/network-request-failed": "No hay conexión con Firebase. Revisa tu internet.",
      "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "La apiKey de firebase-config.js no es válida.",
      "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication → Configuración → Dominios autorizados.",
    };
    loginError.textContent = mensajes[err.code] || `Error inesperado (${err.code || err.message}).`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
});

logoutBtn?.addEventListener("click", () => signOut(auth));
