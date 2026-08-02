import { sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "../firebase-init.js";

export function mountCuenta() {
  document.getElementById("btn-cuenta-logout")?.addEventListener("click", () => signOut(auth));

  document.getElementById("btn-reset-password")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const msg = document.getElementById("cuenta-reset-msg");
    const email = auth.currentUser?.email;
    if (!email) return;
    btn.disabled = true;
    try {
      await sendPasswordResetEmail(auth, email);
      msg.textContent = `Te hemos enviado un email a ${email} para cambiar la contraseña.`;
    } catch (err) {
      msg.style.color = "var(--danger)";
      msg.textContent = "No se pudo enviar el email. Inténtalo de nuevo.";
    } finally {
      btn.disabled = false;
    }
  });
}

export function renderCuenta() {
  const el = document.getElementById("cuenta-email");
  if (el) el.textContent = auth.currentUser?.email || "—";
}
