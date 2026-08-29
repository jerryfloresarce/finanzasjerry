import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "./firebase-init.js?v=86";

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

let onAuthReadyCallback = null;

export function onAuthReady(callback) {
  onAuthReadyCallback = callback;
}

function showApp() {
  loginScreen.classList.add("is-hidden");
  appShell.classList.remove("is-hidden");
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

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (onAuthReadyCallback) onAuthReadyCallback(user);
    showApp();
  } else {
    appShell.classList.add("is-hidden");
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
    loginError.textContent = LOGIN_ERROR_MESSAGES[err.code] || `Error inesperado (${err.code || err.message}).`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
});

logoutBtn?.addEventListener("click", () => signOut(auth));
