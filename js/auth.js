import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "./firebase-init.js?v=22";
import { hasPasskey, verifyPasskey, passkeySupported } from "./passkey.js?v=22";

const loginScreen = document.getElementById("login-screen");
const lockScreen = document.getElementById("lock-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const loginFaceIdBtn = document.getElementById("btn-login-faceid");
const loginFaceIdMsg = document.getElementById("login-faceid-msg");
const btnMostrarForm = document.getElementById("btn-login-mostrar-form");
const lockUnlockBtn = document.getElementById("btn-lock-unlock");
const lockError = document.getElementById("lock-screen-error");
const lockLogoutBtn = document.getElementById("btn-lock-logout");

let onAuthReadyCallback = null;
// Se pone a true nada más pasar el Face ID una vez (desde cualquiera de los
// dos sitios: el botón del login o el de la pantalla de bloqueo), para no
// volver a pedirlo una segunda vez dentro de la MISMA carga de la página.
let unlockedThisSession = false;

export function onAuthReady(callback) {
  onAuthReadyCallback = callback;
}

function showApp() {
  loginScreen.classList.add("is-hidden");
  lockScreen?.classList.add("is-hidden");
  appShell.classList.remove("is-hidden");
}

function mostrarFormulario() {
  loginForm.classList.remove("is-hidden");
  loginFaceIdBtn?.classList.add("is-hidden");
  btnMostrarForm?.classList.add("is-hidden");
}

const LOGIN_ERROR_MESSAGES = {
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

// Caso "ya hay sesión de Firebase activa" (persistida de una vez anterior):
// Face ID solo tiene que decidir si se muestra el contenido ya cargado, no
// necesita ninguna credencial nueva.
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

btnMostrarForm?.addEventListener("click", mostrarFormulario);

// Caso "sin sesión de Firebase todavía" pero con Face ID activado en este
// dispositivo (pantalla de login). Face ID por sí solo NO puede iniciar
// sesión en Firebase — esta app no tiene servidor propio que pueda
// intercambiar "Face ID correcto" por acceso, así que solo sirve para
// confirmar que de verdad eres tú cuando SÍ hay algo que desbloquear
// (sesión ya persistida, o credenciales ya escritas en el formulario). Si
// ninguna de las dos existe, no queda otra que pedir la contraseña esta
// vez — igual que hacen las apps de banco cuando la sesión guardada
// caduca.
loginFaceIdBtn?.addEventListener("click", async () => {
  loginFaceIdMsg.textContent = "";
  loginFaceIdBtn.disabled = true;
  loginFaceIdBtn.textContent = "Verificando…";
  const ok = await verifyPasskey();
  loginFaceIdBtn.disabled = false;
  loginFaceIdBtn.innerHTML = '<i class="ph-thin ph-lock-key" aria-hidden="true"></i> Entrar con Face ID';
  if (!ok) {
    loginFaceIdMsg.textContent = "No se pudo verificar tu identidad. Inténtalo de nuevo.";
    return;
  }

  if (auth.currentUser) {
    unlockedThisSession = true;
    showApp();
    return;
  }

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;
  if (email && password) {
    unlockedThisSession = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return;
    } catch (err) {
      unlockedThisSession = false;
      console.error("Error de login tras Face ID:", err.code, err.message);
    }
  }

  loginFaceIdMsg.textContent = "Identidad verificada ✓ — tu sesión anterior caducó, escribe tu contraseña una vez más.";
  mostrarFormulario();
});

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
    if (passkeySupported() && hasPasskey()) {
      loginFaceIdBtn?.classList.remove("is-hidden");
      btnMostrarForm?.classList.remove("is-hidden");
      loginForm.classList.add("is-hidden");
    } else {
      loginFaceIdBtn?.classList.add("is-hidden");
      btnMostrarForm?.classList.add("is-hidden");
      loginForm.classList.remove("is-hidden");
    }
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
    loginError.textContent = LOGIN_ERROR_MESSAGES[err.code] || `Error inesperado (${err.code || err.message}).`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
});

logoutBtn?.addEventListener("click", () => signOut(auth));
