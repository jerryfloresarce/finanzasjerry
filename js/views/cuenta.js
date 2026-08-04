import { sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "../firebase-init.js?v=23";
import { state } from "../store.js?v=23";
import { exportarDatos, importarDatos } from "../backup.js?v=23";
import { passkeySupported, hasPasskey, registerPasskey, disablePasskey } from "../passkey.js?v=23";

let panel = null;
let scrim = null;

function renderFaceIdEstado() {
  const estadoEl = document.getElementById("cuenta-faceid-estado");
  const activarBtn = document.getElementById("btn-faceid-activar");
  const desactivarBtn = document.getElementById("btn-faceid-desactivar");
  if (!estadoEl) return;

  if (!passkeySupported()) {
    estadoEl.textContent = "Este dispositivo/navegador no admite Face ID/Touch ID en la web.";
    activarBtn.classList.add("is-hidden");
    desactivarBtn.classList.add("is-hidden");
    return;
  }

  if (hasPasskey()) {
    estadoEl.textContent = "Face ID activado en este dispositivo — se pedirá cada vez que abras la app.";
    activarBtn.classList.add("is-hidden");
    desactivarBtn.classList.remove("is-hidden");
  } else {
    estadoEl.textContent = "Face ID desactivado en este dispositivo.";
    activarBtn.classList.remove("is-hidden");
    desactivarBtn.classList.add("is-hidden");
  }
}

function openPanel() {
  const emailEl = document.getElementById("cuenta-panel-email");
  if (emailEl) emailEl.textContent = auth.currentUser?.email || "—";
  renderFaceIdEstado();
  panel.classList.add("is-open");
  scrim.classList.remove("is-hidden");
}

function closePanel() {
  panel.classList.remove("is-open");
  scrim.classList.add("is-hidden");
}

function toggle() {
  if (panel.classList.contains("is-open")) closePanel();
  else openPanel();
}

export function mountCuentaPanel() {
  panel = document.getElementById("cuenta-panel");
  scrim = document.getElementById("cuenta-panel-scrim");
  if (!panel || !scrim) return;

  document.getElementById("btn-open-cuenta-topbar")?.addEventListener("click", toggle);
  document.getElementById("btn-account-desktop")?.addEventListener("click", toggle);
  scrim.addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });

  document.getElementById("btn-cuenta-logout")?.addEventListener("click", () => signOut(auth));

  document.getElementById("btn-reset-password")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const msg = document.getElementById("cuenta-reset-msg");
    const email = auth.currentUser?.email;
    if (!email) return;
    btn.disabled = true;
    msg.textContent = "";
    try {
      await sendPasswordResetEmail(auth, email);
      msg.style.color = "var(--success)";
      msg.textContent = `Te hemos enviado un email a ${email} para cambiar la contraseña.`;
    } catch (err) {
      msg.style.color = "var(--danger)";
      msg.textContent = "No se pudo enviar el email. Inténtalo de nuevo.";
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("btn-faceid-activar")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const msg = document.getElementById("cuenta-faceid-msg");
    const email = auth.currentUser?.email;
    if (!email) return;
    btn.disabled = true;
    msg.textContent = "";
    try {
      await registerPasskey(email);
      msg.style.color = "var(--success)";
      msg.textContent = "Face ID activado. La próxima vez que abras la app te lo pedirá.";
      renderFaceIdEstado();
    } catch (err) {
      console.error("Error al activar Face ID:", err);
      msg.style.color = "var(--danger)";
      msg.textContent = "No se pudo activar. Puede que tu navegador no permita Face ID aquí, o cancelaste la verificación.";
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("btn-faceid-desactivar")?.addEventListener("click", () => {
    if (!confirm("¿Desactivar Face ID? La app se abrirá sin pedir verificación adicional en este dispositivo.")) return;
    disablePasskey();
    renderFaceIdEstado();
  });

  document.getElementById("btn-exportar-datos")?.addEventListener("click", () => {
    exportarDatos(state);
  });

  const fileInput = document.getElementById("input-importar-datos");
  document.getElementById("btn-importar-datos")?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    const msg = document.getElementById("cuenta-import-msg");
    msg.style.color = "var(--text-secondary)";
    if (!confirm("Esto añadirá todo lo que haya en el archivo a tus datos actuales (no borra nada existente). ¿Continuar?")) return;
    msg.textContent = "Importando…";
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importarDatos(data);
      msg.style.color = "var(--success)";
      msg.textContent = "Datos importados correctamente.";
    } catch (err) {
      console.error("Error al importar datos:", err);
      msg.style.color = "var(--danger)";
      msg.textContent = "No se pudo importar el archivo. ¿Es una copia válida exportada desde aquí?";
    }
  });
}
