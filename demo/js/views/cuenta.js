// La pantalla de Ajustes: el perfil (foto, nombre, email, contraseña), el
// idioma, los temas, los datos (exportar/importar) y la sesión. Antes era
// un panel lateral; ahora es una vista propia y el botón del avatar (arriba
// a la derecha) navega hasta ella.
import { sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "../firebase-init.js?v=122";
import { state, subscribe } from "../store.js?v=122";
import { updateConfig } from "../db.js?v=122";
import { exportarDatos, importarDatos } from "../backup.js?v=122";
import { montarSelectorTemas, nombreTemaActual } from "../tema.js?v=122";
import { arrancarTour } from "../tour.js?v=122";
import { montarSelectorIdioma, nombreIdiomaActual, t } from "../idioma.js?v=122";

const ICONO_AVATAR = '<i class="ph-thin ph-user-circle" aria-hidden="true"></i>';

function irAAjustes() {
  window.location.hash = "#/ajustes";
}

// La foto del perfil, donde toque: los dos botones del avatar (escritorio y
// móvil) y la vista previa grande de Ajustes. Sin foto, el icono de siempre.
function aplicarFotoPerfil() {
  const foto = state.config?.foto_perfil || null;
  for (const id of ["btn-account-desktop", "btn-open-cuenta-topbar"]) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const conFoto = Boolean(foto);
    btn.classList.toggle("tiene-foto", conFoto);
    btn.innerHTML = conFoto ? `<img src="${foto}" alt="" class="avatar-foto" />` : ICONO_AVATAR;
  }
  const preview = document.getElementById("ajustes-avatar");
  if (preview) preview.innerHTML = foto ? `<img src="${foto}" alt="" class="avatar-foto" />` : ICONO_AVATAR;
  document.getElementById("btn-quitar-foto")?.classList.toggle("is-hidden", !foto);
}

// La foto se recorta a un cuadrado de 256 px y se guarda como JPEG dentro
// del documento de configuración: pesa unas decenas de KB, sobra para un
// avatar, y viaja con la cuenta a todos los dispositivos sin montar nada
// más (ni Storage ni subidas aparte).
async function procesarFoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const lado = 256;
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - min) / 2;
    const sy = (img.naturalHeight - min) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = lado;
    canvas.height = lado;
    canvas.getContext("2d").drawImage(img, sx, sy, min, min, 0, 0, lado, lado);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function mountCuentaPanel() {
  document.getElementById("btn-open-cuenta-topbar")?.addEventListener("click", irAAjustes);
  document.getElementById("btn-account-desktop")?.addEventListener("click", irAAjustes);

  montarSelectorTemas(document.getElementById("temas-selector"));
  montarSelectorIdioma(document.getElementById("idioma-selector"));

  // Idioma y Temas van plegados, con el valor actual a la vista; un toque
  // los abre. Al elegir, se actualiza la etiqueta y se vuelven a plegar.
  const desplegables = [
    { boton: "btn-desplegar-idioma", zona: "zona-idioma" },
    { boton: "btn-desplegar-temas", zona: "zona-temas" },
  ];
  for (const { boton, zona } of desplegables) {
    document.getElementById(boton)?.addEventListener("click", () => {
      const z = document.getElementById(zona);
      z.classList.toggle("is-hidden");
      document.getElementById(boton).classList.toggle("is-abierto", !z.classList.contains("is-hidden"));
    });
  }
  const plegar = (zona, boton) => {
    document.getElementById(zona)?.classList.add("is-hidden");
    document.getElementById(boton)?.classList.remove("is-abierto");
  };
  document.addEventListener("idioma-cambiado", () => {
    actualizarEtiquetasAjustes();
    plegar("zona-idioma", "btn-desplegar-idioma");
  });
  document.addEventListener("tema-cambiado", () => {
    actualizarEtiquetasAjustes();
    plegar("zona-temas", "btn-desplegar-temas");
  });

  // El interruptor de los avisos de cobro de préstamos (los del Dashboard).
  document.getElementById("check-aviso-cobros")?.addEventListener("change", (e) => {
    updateConfig({ aviso_cobros: e.target.checked });
    state.config = { ...state.config, aviso_cobros: e.target.checked };
  });

  // La guía de bienvenida se puede repetir cuando haga falta (enseñar la
  // app a alguien, refrescar dónde estaba algo).
  document.getElementById("btn-ver-tour")?.addEventListener("click", () => arrancarTour());

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

  // La foto de perfil.
  const inputFoto = document.getElementById("input-foto-perfil");
  document.getElementById("btn-foto-perfil")?.addEventListener("click", () => inputFoto?.click());
  inputFoto?.addEventListener("change", async () => {
    const file = inputFoto.files[0];
    inputFoto.value = "";
    if (!file) return;
    const msg = document.getElementById("ajustes-foto-msg");
    msg.textContent = "";
    try {
      const dataURL = await procesarFoto(file);
      await updateConfig({ foto_perfil: dataURL });
      // El listener de configuración tarda un latido: se aplica ya para que
      // el cambio se vea al instante.
      state.config = { ...state.config, foto_perfil: dataURL };
      aplicarFotoPerfil();
    } catch (err) {
      msg.textContent = t("No se pudo guardar la foto. Prueba con otra imagen.");
    }
  });
  document.getElementById("btn-quitar-foto")?.addEventListener("click", async () => {
    await updateConfig({ foto_perfil: null });
    state.config = { ...state.config, foto_perfil: null };
    aplicarFotoPerfil();
  });

  // El nombre: se guarda al salir del campo.
  const inputNombre = document.getElementById("input-nombre-perfil");
  inputNombre?.addEventListener("change", () => {
    updateConfig({ nombre_usuario: inputNombre.value.trim() || null });
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
    if (!confirm(t("Esto añadirá todo lo que haya en el archivo a tus datos actuales (no borra nada existente). ¿Continuar?"))) return;
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

  // La foto del avatar de arriba se pone al día con cada cambio de datos
  // (llega de este dispositivo o del otro por el listener de configuración).
  subscribe(() => aplicarFotoPerfil());
}

// Las etiquetas "actual" de los desplegables. El nombre del idioma es un
// nombre propio (Español, Deutsch…): se marca para que el traductor no lo
// toque al cambiar de idioma.
function actualizarEtiquetasAjustes() {
  const idioma = document.getElementById("idioma-actual");
  if (idioma) idioma.textContent = nombreIdiomaActual();
  const tema = document.getElementById("tema-actual");
  if (tema) tema.textContent = nombreTemaActual();
}

export function renderAjustes() {
  const emailEl = document.getElementById("cuenta-panel-email");
  if (emailEl) emailEl.textContent = auth.currentUser?.email || "—";
  // El nombre no se pisa mientras se está escribiendo en él.
  const inputNombre = document.getElementById("input-nombre-perfil");
  if (inputNombre && document.activeElement !== inputNombre) {
    inputNombre.value = state.config?.nombre_usuario || "";
  }
  const checkCobros = document.getElementById("check-aviso-cobros");
  if (checkCobros) checkCobros.checked = state.config?.aviso_cobros !== false;
  // El interruptor de innegociables es del módulo de vida: se le avisa de
  // que la pantalla está a la vista para que se ponga al día.
  document.dispatchEvent(new CustomEvent("ajustes-abiertos"));
  actualizarEtiquetasAjustes();
  aplicarFotoPerfil();
}
