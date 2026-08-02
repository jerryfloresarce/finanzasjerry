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

La idea: el Shortcut hace 2 peticiones HTTP (login + escribir en Firestore), sin backend intermedio, sin coste, y el movimiento aparece en la web al instante (la web escucha Firestore en tiempo real).

### 3.1 Sacar los IDs de tus categorías y cuentas

Ya no hace falta ir a la consola de Firebase para esto. En la web, en **Cuentas** y en **Categorías**, cada tarjeta tiene ahora un botón pequeño con un icono de copiar (junto a "Editar"/"Eliminar"). Tócalo y el ID de ese documento se copia al portapapeles.

Haz esto una vez por cada cuenta y categoría que vayas a usar desde el Shortcut, y pégalos en las Notas del iPhone (o donde te sea cómodo) para tenerlos a mano mientras montas los pasos de abajo. Son cadenas largas tipo `k3Jd82ndPQ...` — no hace falta que signifiquen nada, solo que las copies tal cual.

### 3.2 Datos que necesitarás a mano

- **API key** de Firebase: `AIzaSyAbn6ZT3C1Toe3y8zOmcoGU1INC-FiYtRE`
- **Project ID**: `finanzas-jerry`
- Tu email y contraseña de Firebase Auth (los que usas para entrar en la web).
- Los IDs de categorías/cuentas que hayas copiado en el paso 3.1.

Ninguno de estos datos es "secreto" en el sentido de dar acceso a nadie que no tenga también tu contraseña — pero aun así, no compartas el Shortcut públicamente con tu contraseña ya escrita dentro.

### 3.3 Construir el Shortcut, paso a paso

Abre la app **Atajos** en el iPhone → botón **+** para crear uno nuevo → nómbralo **"Añadir movimiento"**.

**Paso 1 — Preguntar el tipo**
Añade la acción **Elegir de menú** ("Choose from Menu"). Título: "¿Gasto o ingreso?". Añade dos opciones: `Gasto` e `Ingreso`. Esto crea dos ramas en el Atajo; en cada rama irá un valor de texto distinto (lo usarás en el paso 4).

**Paso 2 — Preguntar el importe**
Añade **Preguntar por entrada** ("Ask for Input"), tipo **Número**, con el texto "¿Cuánto?". Resultado: variable `Importe`.
> Importante: si tu iPhone está en español, el teclado numérico usará coma decimal (`12,50`). Eso es solo de cara a ti — el "Ask for Input" de tipo número siempre te da un número válido para usar en las fórmulas siguientes, independientemente del separador que hayas tecleado.

**Paso 3 — Elegir la categoría**
Añade otra **Elegir de menú**, con una opción por cada categoría que uses a menudo (ej. "Comida a domicilio", "Nómina", "Ocio"...). En cada opción, añade una acción **Texto** con el ID de Firestore de esa categoría (el que copiaste en 3.1). Guarda el resultado en variable `CategoriaID`.

**Paso 4 — Elegir la cuenta**
Igual que el paso 3, pero para tus cuentas (ej. "Cuenta Nómina", "Ahorros"). Variable `CuentaID`.

**Paso 5 — Subcategoría opcional (Five Guys, KFC, etc.)**
Añade **Preguntar por entrada** (tipo Texto), marca la opción "Permitir omitir" ("Allow Skip") si existe en tu versión de Atajos, con el texto "¿Subcategoría? (opcional)". Variable `Subcategoria`.

**Paso 6 — Iniciar sesión en Firebase**
Añade **Obtener contenido de URL** ("Get Contents of URL"):
- URL: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAbn6ZT3C1Toe3y8zOmcoGU1INC-FiYtRE`
- Método: `POST`
- Cabeceras: `Content-Type` = `application/json`
- Cuerpo: **JSON**, y dentro añade tres campos de tipo texto:
  - `email` → tu email
  - `password` → tu contraseña
  - `returnSecureToken` → `true` (elige tipo Booleano si Atajos te deja, o escribe `true` en texto)

Guarda el resultado en variable `LoginResponse`.

**Paso 7 — Sacar el token**
Añade **Obtener valor de diccionario** ("Get Dictionary Value"), clave `idToken`, diccionario = `LoginResponse`. Resultado: variable `Token`.

**Paso 8 — Fecha de hoy en formato correcto**
Añade **Fecha actual** ("Current Date") y después **Formatear fecha** ("Format Date") con formato personalizado `yyyy-MM-dd'T'HH:mm:ss'Z'`. Resultado: variable `FechaISO`. Esto evita tener que escribir la fecha a mano cada vez.

**Paso 9 — Escribir el movimiento en Firestore**
Añade otra **Obtener contenido de URL**:
- URL: `https://firestore.googleapis.com/v1/projects/finanzas-jerry/databases/(default)/documents/movimientos`
- Método: `POST`
- Cabeceras: `Authorization` = `Bearer ` + `Token` (el espacio después de "Bearer" es importante), `Content-Type` = `application/json`
- Cuerpo: **JSON**, con esta estructura exacta (usa la acción "Diccionario" de Atajos para construirlo, así se escapan bien las comillas si tecleas algo con acentos o símbolos):
  ```json
  {
    "fields": {
      "importe": { "doubleValue": Importe },
      "tipo": { "stringValue": "Gasto o Ingreso, según el paso 1" },
      "categoria_id": { "stringValue": "CategoriaID" },
      "cuenta_id": { "stringValue": "CuentaID" },
      "fecha": { "timestampValue": "FechaISO" },
      "subcategoria": { "stringValue": "Subcategoria" },
      "nota": { "stringValue": "" }
    }
  }
  ```
  (Sustituye cada nombre en cursiva por la variable correspondiente arrastrándola desde el teclado de variables de Atajos — no escribas el texto literal.)

**Paso 10 — Confirmación**
Añade **Mostrar notificación** ("Show Notification") con texto "Movimiento añadido ✓" para saber que salió bien.

### 3.4 Probar

Ejecuta el Shortcut una vez con un importe pequeño de prueba y comprueba que aparece en **Movimientos** en la web (puede tardar 1-2 segundos). Si algo falla, la acción "Obtener contenido de URL" del paso 9 te devuelve el error de Google en texto — puedes añadir temporalmente un "Mostrar resultado" después de ese paso para leerlo.

### 3.5 Atajo para ingresos, y atajo desde la pantalla de inicio

Puedes duplicar este mismo Atajo y quitarle el paso 1 (fijar `tipo` directamente a `"Ingreso"`) para tener un acceso directo de un solo toque para tus ingresos habituales (nómina, horas extra...). Añade el Atajo a la pantalla de inicio (⋯ → "Añadir a pantalla de inicio") para tenerlo a un toque, como una app más.

## 4. Orden recomendado

1. Me pasas el `firebaseConfig` → lo conecto.
2. Activas login + publicas las reglas (paso 1.2 y 1.3).
3. Activas GitHub Pages (paso 2) → entras en la web con tu email/contraseña.
4. Pulsas "Importar mis datos iniciales" en el Dashboard (aparece solo la primera vez).
5. Revisamos que todo se vea bien con tus datos reales.
6. Montas el Shortcut siguiendo el paso 3 — es autoexplicativo, pero si algo no cuadra dímelo y lo revisamos juntos.
