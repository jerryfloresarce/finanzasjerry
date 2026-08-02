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

> **Nota:** si ya habías publicado las reglas antes, tienes que volver a publicarlas ahora — se ha añadido una colección nueva (`configuracion`, para recordar qué banners ya has resuelto en todos tus dispositivos) y necesita el mismo permiso que las demás. Repite los pasos 1-3 de aquí arriba pegando el `firestore.rules` actualizado.

## 2. GitHub Pages — publicar la web

1. En GitHub, entra en `jerryfloresarce/finanzasjerry` → **Settings** → **Pages**.
2. En "Build and deployment" → Source: **Deploy from a branch**.
3. Branch: **main**, carpeta: **/ (root)**. Guardar.
4. En 1-2 minutos tu web estará en `https://jerryfloresarce.github.io/finanzasjerry/`.

Cada vez que yo haga push a `main`, GitHub Pages se actualiza solo.

## 3. Shortcuts de iPhone — añadir movimientos con un toque

La idea: 3 Atajos independientes — **Registrar un ingreso**, **Registrar un gasto** y **Registrar una transferencia** — cada uno hace 2 peticiones HTTP (login + escribir en Firestore), sin backend intermedio, sin coste, y el movimiento aparece en la web al instante (la web escucha Firestore en tiempo real). Al ser 3 atajos separados (no uno con menú), puedes añadir cada uno como un **control del Centro de Control** del iPhone y tenerlos a un toque sin ni abrir la app Atajos.

Las transferencias (mover dinero entre tus propias cuentas, o un retiro a efectivo) no son ni gasto ni ingreso — no cuentan en los totales de gastos/ingresos ni en los gráficos, solo mueven el saldo de una cuenta a otra.

### 3.1 Sacar los IDs de tus categorías y cuentas

Ya no hace falta ir a la consola de Firebase para esto. En la web, en **Cuentas** y en **Categorías**, cada tarjeta tiene ahora un botón pequeño con un icono de copiar (junto a "Editar"/"Eliminar"). Tócalo y el ID de ese documento se copia al portapapeles.

Haz esto una vez por cada cuenta y categoría que vayas a usar desde el Shortcut, y pégalos en las Notas del iPhone (o donde te sea cómodo) para tenerlos a mano mientras montas los pasos de abajo. Son cadenas largas tipo `k3Jd82ndPQ...` — no hace falta que signifiquen nada, solo que las copies tal cual.

### 3.2 Datos que necesitarás a mano

- **API key** de Firebase: `AIzaSyAbn6ZT3C1Toe3y8zOmcoGU1INC-FiYtRE`
- **Project ID**: `finanzas-jerry`
- Tu email y contraseña de Firebase Auth (los que usas para entrar en la web).
- Los IDs de categorías/cuentas que hayas copiado en el paso 3.1.

Ninguno de estos datos es "secreto" en el sentido de dar acceso a nadie que no tenga también tu contraseña — pero aun así, no compartas el Shortcut públicamente con tu contraseña ya escrita dentro.

### 3.3 Los 3 pasos comunes a los 3 Atajos

Cada uno de los 3 Atajos (Gasto, Ingreso, Transferencia) empieza igual: pregunta un importe, inicia sesión en Firebase, y saca el token. Solo cambian los pasos del medio (qué preguntas) y el cuerpo de la petición final. Monta cada Atajo por separado desde Atajos → **+**.

**A — Preguntar el importe**
Añade **Preguntar por entrada** ("Ask for Input"), tipo **Número**, texto "¿Cuánto?". Nombra el resultado `Importe`.
> Si tu iPhone está en español, el teclado usará coma decimal (`12,50`) — no importa, "Ask for Input" siempre da un número válido para las fórmulas siguientes.

**B — Iniciar sesión en Firebase**
Añade **Obtener contenido de URL**:
- URL: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAbn6ZT3C1Toe3y8zOmcoGU1INC-FiYtRE`
- Método `POST`, cabecera `Content-Type` = `application/json`
- Cuerpo JSON con: `email` (el tuyo), `password` (la tuya), `returnSecureToken` = `true`

Nombra el resultado `LoginResponse`.

**C — Sacar el token**
Añade **Obtener valor de diccionario**, clave `idToken`, diccionario = `LoginResponse`. Nombra el resultado `Token`.

**D — Fecha de hoy**
Añade **Fecha actual** y luego **Formatear fecha** con formato personalizado `yyyy-MM-dd'T'HH:mm:ss'Z'`. Nombra el resultado `FechaISO`.

A partir de aquí cada Atajo añade sus propias preguntas (categoría/cuenta, o cuenta origen/destino) y termina con la petición a Firestore. Sigue con 3.3.1, 3.3.2 o 3.3.3 según qué Atajo estés montando.

### 3.3.1 Atajo "Registrar un gasto"

Después del paso D:

**E — Elegir categoría**: **Elegir de menú**, una opción por categoría de gasto que uses (Comida a domicilio, Ocio...). En cada opción, acción **Texto** con el ID de esa categoría (el que copiaste en 3.1). Resultado: `CategoriaID`.

**F — Elegir cuenta**: igual, con tus cuentas. Resultado: `CuentaID`.

**G — Subcategoría opcional**: **Preguntar por entrada** (Texto), "Permitir omitir" activado, texto "¿Subcategoría? (opcional)". Resultado: `Subcategoria`.

**H — Escribir en Firestore**: **Obtener contenido de URL**:
- URL: `https://firestore.googleapis.com/v1/projects/finanzas-jerry/databases/(default)/documents/movimientos`
- Método `POST`, cabeceras `Authorization` = `Bearer ` + `Token`, `Content-Type` = `application/json`
- Cuerpo JSON (arrastra cada variable desde el teclado de Atajos, no escribas el texto literal):
  ```json
  {
    "fields": {
      "importe": { "doubleValue": Importe },
      "tipo": { "stringValue": "Gasto" },
      "categoria_id": { "stringValue": "CategoriaID" },
      "cuenta_id": { "stringValue": "CuentaID" },
      "fecha": { "timestampValue": "FechaISO" },
      "subcategoria": { "stringValue": "Subcategoria" },
      "nota": { "stringValue": "" }
    }
  }
  ```

**I — Confirmación**: **Mostrar notificación**, "Gasto añadido ✓".

### 3.3.2 Atajo "Registrar un ingreso"

Igual que el de gasto (pasos E-I), pero:
- En el menú de categorías (paso E), usa tus categorías de ingreso (Nómina, Horas extra...).
- En el cuerpo JSON (paso H), `"tipo": { "stringValue": "Ingreso" }`.
- Notificación final: "Ingreso añadido ✓".

### 3.3.3 Atajo "Registrar una transferencia"

Este no lleva categoría — es dinero moviéndose entre dos de tus propias cuentas (o un retiro a Efectivo, si tienes esa cuenta creada). Después del paso D:

**E — Elegir cuenta de origen**: **Elegir de menú**, una opción por cada cuenta desde la que sueles mover dinero. En cada opción, **Texto** con su ID. Resultado: `CuentaOrigenID`.

**F — Elegir cuenta de destino**: igual, con las cuentas a las que sueles mandar dinero (incluye "Efectivo" si la tienes, para los retiros). Resultado: `CuentaDestinoID`.

**G — Escribir en Firestore**: **Obtener contenido de URL**, misma URL/método/cabeceras que arriba, cuerpo:
  ```json
  {
    "fields": {
      "importe": { "doubleValue": Importe },
      "tipo": { "stringValue": "Transferencia" },
      "cuenta_id": { "stringValue": "CuentaOrigenID" },
      "cuenta_destino_id": { "stringValue": "CuentaDestinoID" },
      "fecha": { "timestampValue": "FechaISO" },
      "nota": { "stringValue": "" }
    }
  }
  ```
  (Sin `categoria_id` ni `subcategoria` — una transferencia no lleva categoría.)

**H — Confirmación**: **Mostrar notificación**, "Transferencia registrada ✓".

### 3.4 Probar

Ejecuta cada Atajo una vez con un importe pequeño de prueba y comprueba que aparece en **Movimientos** en la web (puede tardar 1-2 segundos; una transferencia se ve como "Cuenta A → Cuenta B" sin +/-, y no cuenta en los totales de gasto/ingreso ni en los gráficos). Si algo falla, la petición a Firestore devuelve el error de Google en texto — añade temporalmente un "Mostrar resultado" después de esa acción para leerlo.

### 3.5 Añadirlos al Centro de Control (sin abrir Atajos)

Con los 3 Atajos ya creados y probados:

1. **Ajustes** → **Centro de Control**.
2. Busca la sección "Controles incluidos" y pulsa **Añadir un control** (o el **+** verde según tu versión de iOS).
3. Busca **"Atajo"** en la lista — verás una entrada por cada Atajo que tengas creado, incluidos tus 3 nuevos.
4. Añade **Registrar un ingreso**, **Registrar un gasto** y **Registrar una transferencia**, en ese orden (el orden en que los añades aquí es el orden en que aparecen).
5. Puedes arrastrar el icono ⠿ de cada uno para reordenarlos o agruparlos como en tu captura (ingreso arriba, gasto abajo).

Desde ahora, deslizando desde arriba a la derecha (o desde abajo, según el modelo) para abrir el Centro de Control, tienes los 3 a un toque — sin desbloquear del todo ni abrir ninguna app.

## 4. Orden recomendado

1. Me pasas el `firebaseConfig` → lo conecto.
2. Activas login + publicas las reglas (paso 1.2 y 1.3).
3. Activas GitHub Pages (paso 2) → entras en la web con tu email/contraseña.
4. Pulsas "Importar mis datos iniciales" en el Dashboard (aparece solo la primera vez).
5. Revisamos que todo se vea bien con tus datos reales.
6. Montas el Shortcut siguiendo el paso 3 — es autoexplicativo, pero si algo no cuadra dímelo y lo revisamos juntos.
