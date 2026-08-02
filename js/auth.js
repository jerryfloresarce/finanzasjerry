import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "./firebase-init.js";

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

let onAuthReadyCallback = null;

export function onAuthReady(callback) {
  onAuthReadyCallback = callback;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.classList.add("is-hidden");
    appShell.classList.remove("is-hidden");
    if (onAuthReadyCallback) onAuthReadyCallback(user);
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
    loginError.textContent = "Email o contraseña incorrectos.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
});

logoutBtn?.addEventListener("click", () => signOut(auth));
