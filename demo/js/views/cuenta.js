import { sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "../firebase-init.js?v=65";
import { state } from "../store.js?v=65";
import { exportarDatos, importarDatos } from "../backup.js?v=65";
import { bloquearScrollFondo, desbloquearScrollFondo } from "../scroll-lock.js?v=65";
import { montarSelectorTemas } from "../tema.js?v=65";

let panel = null;
let scrim = null;

function openPanel() {
  const emailEl = document.getElementById("cuenta-panel-email");
  if (emailEl) emailEl.textContent = auth.currentUser?.email || "—";
  panel.classList.add("is-open");
  scrim.classList.remove("is-hidden");
  // El panel se abre siempre por arriba: si se quedara donde lo dejaste la
  // vez anterior, aparecería a media lista de temas sin venir a cuento.
  panel.scrollTop = 0;
  bloquearScrollFondo("panel");
}

function closePanel() {
  panel.classList.remove("is-open");
  scrim.classList.add("is-hidden");
  desbloquearScrollFondo("panel");
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

  montarSelectorTemas(document.getElementById("temas-selector"));
  // Al elegir un tema, el panel se aparta: la animación de entrada ocupa
  // toda la pantalla y con el panel abierto se veía a medias.
  document.addEventListener("tema-cambiado", closePanel);

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
