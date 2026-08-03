// Bloqueo con Face ID/Touch ID real usando WebAuthn (Passkeys) — la misma
// API que usa Safari en iOS para pedir tu cara de verdad, sin apps nativas.
//
// Importante para entender el alcance: esta app no tiene servidor propio
// (solo Firestore), así que no hay quien verifique la firma criptográfica
// del passkey como haría un banco de verdad. Lo que sí hace de verdad: el
// credential se crea y se guarda en el Secure Enclave de tu iPhone, ligado
// a Face ID, y `navigator.credentials.get()` solo se resuelve si Face ID
// reconoce tu cara — eso lo decide iOS, no este código, así que nadie puede
// saltárselo con el móvil ya desbloqueado. Es un cerrojo real puesto
// delante de la sesión de Firebase ya iniciada, no un sustituto del login.
//
// El id del credential se guarda en localStorage (por dispositivo, no en
// Firestore): así, si algún día abres la app desde otro móvil u ordenador
// sin ese passkey, esa pantalla nunca llega a bloquearse — simplemente no
// se activa ahí hasta que lo actives tú mismo desde "Mi cuenta" en ese
// dispositivo.

const STORAGE_KEY = "finanzasjerry_faceid_credential";

export function passkeySupported() {
  return Boolean(window.PublicKeyCredential && navigator.credentials);
}

export function hasPasskey() {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}

export function disablePasskey() {
  localStorage.removeItem(STORAGE_KEY);
}

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

export async function registerPasskey(email) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Finanzas Jerry" },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  });
  localStorage.setItem(STORAGE_KEY, bufferToBase64(credential.rawId));
}

// Devuelve true si Face ID/Touch ID confirmó que eres tú.
export async function verifyPasskey() {
  const id = localStorage.getItem(STORAGE_KEY);
  if (!id) return false;
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: base64ToBuffer(id), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return true;
  } catch (err) {
    console.error("Face ID no verificado:", err);
    return false;
  }
}
