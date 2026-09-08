// La pantalla de Ajustes: el perfil (foto, nombre, email, contraseña), el
// idioma, los temas, los datos (exportar/importar) y la sesión. Antes era
// un panel lateral; ahora es una vista propia y el botón del avatar (arriba
// a la derecha) navega hasta ella.
import { sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "../firebase-init.js?v=125";
import { state, subscribe } from "../store.js?v=125";
import { updateConfig } from "../db.js?v=125";
import { exportarDatos, importarDatos } from "../backup.js?v=125";
import { montarSelectorTemas, nombreTemaActual } from "../tema.js?v=125";
import { arrancarTour } from "../tour.js?v=125";
import { montarSelectorIdioma, nombreIdiomaActual, t } from "../idioma.js?v=125";
import { openModal, closeModal } from "../modal.js?v=125";

const ICONO_AVATAR = '<i class="ph-thin ph-user-circle" aria-hidden="true"></i>';

// El nombre y la foto se guardan en el documento de configuración bajo una
// clave con sufijo de perfil: en una casa con dos perfiles, cada uno tiene
// los suyos y no se pisan (igual que hace el tema con usarClaveDeTema). Un
// módulo externo pone el sufijo; si nadie lo toca, todo como siempre.
let SUFIJO_PERFIL = "";
export function usarSufijoDePerfil(sufijo) {
  SUFIJO_PERFIL = sufijo || "";
}
const claveFoto = () => "foto_perfil" + SUFIJO_PERFIL;
const claveNombre = () => "nombre_usuario" + SUFIJO_PERFIL;
const fotoActual = () => state.config?.[claveFoto()] || null;

function irAAjustes() {
  window.location.hash = "#/ajustes";
}

// La foto del perfil, donde toque: los dos botones del avatar (escritorio y
// móvil) y la vista previa grande de Ajustes. Sin foto, el icono de siempre.
function aplicarFotoPerfil() {
  const foto = fotoActual();
  for (const id of ["btn-account-desktop", "btn-open-cuenta-topbar"]) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const conFoto = Boolean(foto);
    btn.classList.toggle("tiene-foto", conFoto);
    btn.innerHTML = conFoto ? `<img src="${foto}" alt="" class="avatar-foto" />` : ICONO_AVATAR;
  }
  const preview = document.getElementById("ajustes-avatar");
  if (preview) preview.innerHTML = foto ? `<img src="${foto}" alt="" class="avatar-foto" />` : ICONO_AVATAR;
}

// El visor de la foto: al tocar el avatar de Ajustes, la foto en grande y,
// debajo, sus dos acciones — cambiarla o quitarla. Todo lo de la foto vive
// aquí dentro, no suelto en la tarjeta.
function abrirFotoPerfil() {
  const foto = fotoActual();
  openModal(
    `
    <h2 class="modal__title">Tu foto de perfil</h2>
    <div class="foto-grande" id="foto-grande">${foto ? `<img src="${foto}" alt="" />` : ICONO_AVATAR}</div>
    <p class="field-error" id="ajustes-foto-msg" style="text-align:center;"></p>
    <div class="modal__actions" style="justify-content:center; flex-wrap:wrap;">
      <button type="button" class="btn btn--primary btn--sm" id="btn-foto-cambiar">Cambiar la foto</button>
      ${foto ? `<button type="button" class="btn btn--ghost btn--sm" id="btn-quitar-foto">Quitar la foto</button>` : ""}
      <button type="button" class="btn btn--ghost btn--sm" id="btn-foto-cerrar">Cerrar</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-foto-cerrar").addEventListener("click", closeModal);
        root.querySelector("#btn-foto-cambiar").addEventListener("click", () => {
          document.getElementById("input-foto-perfil")?.click();
        });
        root.querySelector("#btn-quitar-foto")?.addEventListener("click", async () => {
          await updateConfig({ [claveFoto()]: null });
          state.config = { ...state.config, [claveFoto()]: null };
          aplicarFotoPerfil();
          abrirFotoPerfil();
        });
      },
    }
  );
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

  // La foto de perfil: el avatar abre el visor, y el selector de archivo
  // (que vive oculto en la tarjeta) se dispara desde el botón del visor.
  document.getElementById("btn-foto-ver")?.addEventListener("click", abrirFotoPerfil);
  const inputFoto = document.getElementById("input-foto-perfil");
  inputFoto?.addEventListener("change", async () => {
    const file = inputFoto.files[0];
    inputFoto.value = "";
    if (!file) return;
    const msg = document.getElementById("ajustes-foto-msg");
    if (msg) msg.textContent = "";
    try {
      const dataURL = await procesarFoto(file);
      await updateConfig({ [claveFoto()]: dataURL });
      // El listener de configuración tarda un latido: se aplica ya para que
      // el cambio se vea al instante — también dentro del visor, si está
      // abierto.
      state.config = { ...state.config, [claveFoto()]: dataURL };
      aplicarFotoPerfil();
      if (document.getElementById("foto-grande")) abrirFotoPerfil();
    } catch (err) {
      if (msg) msg.textContent = t("No se pudo guardar la foto. Prueba con otra imagen.");
    }
  });

  // El nombre: se guarda al salir del campo, y el grande de al lado de la
  // foto se va poniendo al día mientras se escribe.
  const inputNombre = document.getElementById("input-nombre-perfil");
  inputNombre?.addEventListener("input", () => pintarNombrePerfil(inputNombre.value));
  inputNombre?.addEventListener("change", () => {
    updateConfig({ [claveNombre()]: inputNombre.value.trim() || null });
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

// El nombre grande junto a la foto: el que haya puesto, o "Tu nombre" en
// apagado mientras no haya ninguno.
function pintarNombrePerfil(valor) {
  const vista = document.getElementById("perfil-nombre-vista");
  if (!vista) return;
  const nombre = (valor ?? "").trim();
  vista.textContent = nombre || t("Tu nombre");
  vista.classList.toggle("perfil-nombre--vacio", !nombre);
}

export function renderAjustes() {
  const emailEl = document.getElementById("cuenta-panel-email");
  if (emailEl) emailEl.textContent = auth.currentUser?.email || "—";
  // El nombre no se pisa mientras se está escribiendo en él.
  const inputNombre = document.getElementById("input-nombre-perfil");
  if (inputNombre && document.activeElement !== inputNombre) {
    inputNombre.value = state.config?.[claveNombre()] || "";
  }
  pintarNombrePerfil(state.config?.[claveNombre()] || "");
  const checkCobros = document.getElementById("check-aviso-cobros");
  if (checkCobros) checkCobros.checked = state.config?.aviso_cobros !== false;
  // El interruptor de innegociables es del módulo de vida: se le avisa de
  // que la pantalla está a la vista para que se ponga al día.
  document.dispatchEvent(new CustomEvent("ajustes-abiertos"));
  actualizarEtiquetasAjustes();
  aplicarFotoPerfil();
}
