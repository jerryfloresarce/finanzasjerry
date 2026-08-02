# Finanzas Jerry — guía de puesta en marcha

Todo el código ya está listo. Esto es lo que falta para que la web funcione de verdad: conectar tu proyecto de Firebase, publicar la web en GitHub Pages, y configurar el Shortcut del iPhone.

## 1. Firebase — conectar tu proyecto

### 1.1 Sacar tu `firebaseConfig`

1. Ve a [Firebase Console](https://console.firebase.google.com/) → proyecto **Finanzas Jerry**.
2. ⚙️ (arriba a la izquierda) → **Configuración del proyecto**.
3. Baja hasta "Tus apps". Si no tienes ninguna app web todavía, pulsa el icono `</>` para crear una (nombre: "Finanzas Jerry Web", no hace falta Firebase Hosting).
4. Copia el objeto `firebaseConfig` que te aparece.
5. Pégamelo en el chat y yo lo pongo en `js/firebase-config.js` y hago commit.

### 1.2 Activar el login

1. En Firebase Console → **Authentication** → pestaña **Sign-in method**.
2. Activa el proveedor **Email/contraseña**.
3. Pestaña **Users** → **Add user** → pon tu email (`arce.jerry54@gmail.com`) y una contraseña. Esa es la que usarás para entrar en la web (y, si quieres, en el Shortcut).

### 1.3 Publicar las reglas de seguridad

1. Firebase Console → **Firestore Database** → pestaña **Reglas**.
2. Borra lo que haya y pega el contenido de `firestore.rules` (está en la raíz del repo).
3. **Publicar**.

Esto asegura que solo tú (con sesión iniciada) puedas leer o escribir tus datos — nadie más, aunque conozca la URL de la web.

## 2. GitHub Pages — publicar la web

1. En GitHub, entra en `jerryfloresarce/finanzasjerry` → **Settings** → **Pages**.
2. En "Build and deployment" → Source: **Deploy from a branch**.
3. Branch: **main**, carpeta: **/ (root)**. Guardar.
4. En 1-2 minutos tu web estará en `https://jerryfloresarce.github.io/finanzasjerry/`.

Cada vez que yo haga push a `main`, GitHub Pages se actualiza solo.

## 3. Shortcut de iPhone — añadir movimientos con un toque

La idea: el Shortcut hace 2 peticiones HTTP (login + escribir en Firestore), sin backend intermedio, sin coste.

### 3.1 Datos que necesitarás a mano

- Tu **API key** de Firebase (la del `firebaseConfig`, campo `apiKey`).
- Tu **Project ID** (campo `projectId`).
- Tu email y contraseña de Firebase Auth (paso 1.2).
- Los `id` de tus categorías y cuentas en Firestore (se ven en Firebase Console → Firestore Database → cada documento tiene un ID largo tipo `aB3dK9...`). Te ayudo a sacarlos cuando lleguemos aquí.

### 3.2 Pasos en la app Atajos (Shortcuts)

1. Nuevo Atajo → nómbralo "Añadir gasto".
2. **Preguntar por importe** (tipo número) → guardar en variable `Importe`.
3. **Preguntar por menú** con tus categorías habituales → guardar en variable `CategoriaID` (usa "Diccionario de texto" o "Elegir de menú" para mapear nombre → id).
4. Acción **Obtener contenido de URL**:
   - URL: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=TU_API_KEY`
   - Método: POST
   - Cuerpo (JSON): `{"email": "tu@email.com", "password": "tu_contraseña", "returnSecureToken": true}`
   - Guarda el resultado en variable `LoginResponse`.
5. Acción **Obtener valor de diccionario** → clave `idToken`, de `LoginResponse` → variable `Token`.
6. Acción **Obtener contenido de URL**:
   - URL: `https://firestore.googleapis.com/v1/projects/TU_PROJECT_ID/databases/(default)/documents/movimientos`
   - Método: POST
   - Cabecera: `Authorization` = `Bearer` + `Token`
   - Cuerpo (JSON), con el formato que exige la API de Firestore:
     ```json
     {
       "fields": {
         "importe": { "doubleValue": Importe },
         "tipo": { "stringValue": "Gasto" },
         "categoria_id": { "stringValue": "CategoriaID" },
         "cuenta_id": { "stringValue": "TU_CUENTA_ID" },
         "fecha": { "timestampValue": "2026-08-02T00:00:00Z" },
         "nota": { "stringValue": "" }
       }
     }
     ```
7. Añade "Mostrar notificación" al final tipo "Gasto añadido ✓" para confirmación.

Te preparo este Shortcut contigo paso a paso por videollamada de texto cuando lleguemos a esta fase — es más fácil verlo construido que leerlo. Si quieres, cuando esté todo lo demás listo, hacemos esta parte juntos.

## 4. Orden recomendado

1. Me pasas el `firebaseConfig` → lo conecto.
2. Activas login + publicas las reglas (paso 1.2 y 1.3).
3. Activas GitHub Pages (paso 2) → entras en la web con tu email/contraseña.
4. Pulsas "Importar mis datos iniciales" en el Dashboard (aparece solo la primera vez).
5. Revisamos que todo se vea bien con tus datos reales.
6. Montamos el Shortcut juntos (paso 3).
