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
3. Pestaña **Users** → **Add user** → pon tu email (`tu-correo@ejemplo.com`) y una contraseña. Esa es la que usarás para entrar en la web (y, si quieres, en el Shortcut).

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

- **API key** de Firebase: `TU_API_KEY`
- **Project ID**: `tu-proyecto`
- Tu email y contraseña de Firebase Auth (los que usas para entrar en la web).
- Los IDs de categorías/cuentas que hayas copiado en el paso 3.1.

Ninguno de estos datos es "secreto" en el sentido de dar acceso a nadie que no tenga también tu contraseña — pero aun así, no compartas el Shortcut públicamente con tu contraseña ya escrita dentro.

### 3.3 Los 3 pasos comunes a los 3 Atajos

Cada uno de los 3 Atajos (Gasto, Ingreso, Transferencia) empieza igual: pregunta un importe, inicia sesión en Firebase, y saca el token y la fecha. Solo cambian los pasos del medio (qué preguntas) y el cuerpo de la petición final. Monta cada Atajo por separado desde Atajos → **+** (o, más rápido: monta bien uno y duplícalo para los otros dos, cambiando solo lo que corresponda).

> **Nota sobre las "variables mágicas" de Atajos**: en varios puntos de abajo se indica meter el resultado de una acción dentro de una acción **"Texto"** y luego "congelarlo" con **Definir variable**, en vez de usar el resultado directamente. No es capricho: en la práctica, leer el resultado de una acción bastante después de haberla generado (p. ej. el de un "Elegir de menú" tras su "Terminar menú", o el de "Formatear fecha") a veces coge un valor viejo o vacío en vez del real, aunque en el editor la burbuja parezca correcta. Pasarlo primero por un "Texto" y definir una variable con nombre propio justo ahí evita ese lío. Sigue el patrón exactamente como se describe, aunque parezca un paso de más.

**A — Preguntar el importe**
Añade **Preguntar por entrada** ("Ask for Input"), tipo **Número**, texto "¿Cuánto?". Nombra el resultado `Importe`.
> Si tu iPhone está en español, el teclado usará coma decimal (`12,50`) — no importa, "Ask for Input" siempre da un número válido para las fórmulas siguientes.

**B — Iniciar sesión en Firebase**
Añade **Obtener contenido de URL**:
- URL: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=TU_API_KEY`
- Método `POST`, cabecera `Content-Type` = `application/json`
- Cuerpo JSON con: `email` (el tuyo), `password` (la tuya), `returnSecureToken` = `true`

Nombra el resultado `LoginResponse`.

**C — Sacar el token**
Añade **Obtener valor de diccionario**, clave `idToken`, diccionario = `LoginResponse`. Nombra el resultado `Token`.

**D — Fecha de hoy, en el formato exacto que pide Firestore**
1. Añade **Fecha actual**.
2. Añade **Formatear fecha**. En "Formato de fecha" elige el desplegable y selecciona **ISO 8601** (no "Corto" ni "Personalizado"), y activa el interruptor **"Hora ISO 8601"**. Comprueba que el "Ejemplo" de abajo sale con pinta de `2026-08-03T15:30:00+02:00` (fecha + hora + desfase horario al final — sin esas tres partes, Firestore rechaza la fecha con un error de "Illegal timestamp format").
3. Añade una acción **Texto** y mete dentro solo el resultado de "Formatear fecha" (nada más, ni antes ni después).
4. Añade **Definir variable** → nómbrala `FechaISO` → "a" → el **Texto** del paso anterior (no el resultado de "Formatear fecha" directamente).

A partir de aquí cada Atajo añade sus propias preguntas (categoría/cuenta, o cuenta origen/destino) y termina con la petición a Firestore. Sigue con 3.3.1, 3.3.2 o 3.3.3 según qué Atajo estés montando.

### Cómo montar un menú de elección (categoría o cuenta) — el método que funciona

Tanto para elegir categoría como cuenta (o cuenta origen/destino en la transferencia) se usa el mismo patrón, y es importante montarlo así y no con un "Diccionario" (probamos esa vía primero y falla de forma intermitente e inexplicable):

1. Añade **Elegir de menú**, con una opción por cada categoría/cuenta que uses (el texto de cada opción es solo la etiqueta que ves, da igual cómo se llame).
2. **Dentro de cada opción** (no después del menú): mantén pulsada la opción para poder pegar dentro, y mete dos acciones:
   - **Texto**, con el ID real de esa categoría/cuenta (el que copiaste con el botón de copiar ID en la web).
   - **Definir variable** → mismo nombre en todas las ramas (p. ej. `CategoriaID` o `CuentaID`) → "a" → el **Texto** de arriba.

   Para no repetir esto a mano en cada rama: monta la primera rama entera, mantén pulsada esa "Definir variable" → Copiar, luego mantén pulsada la siguiente opción del menú → Pegar debajo, y solo cambia el texto del ID dentro de la copia.
3. Fuera del menú (después de "Terminar menú") ya puedes usar `CategoriaID`/`CuentaID` con total confianza — al haberse definido dentro de cada rama con nombre propio, sí se lee bien después, a diferencia de leer el resultado del menú directamente.

### 3.3.1 Atajo "Registrar un gasto"

Después del paso D:

**E — Elegir categoría**: el menú de categorías de gasto (Comida a domicilio, Ocio...) siguiendo el método de arriba. Variable: `CategoriaID`.

**F — Elegir cuenta**: igual, con tus cuentas. Variable: `CuentaID`.

**G — Subcategoría opcional**: **Preguntar por entrada** (Texto), "Permitir omitir" activado, texto "¿Subcategoría? (opcional)". Resultado: `Subcategoria`.

**H — Escribir en Firestore**: aquí tampoco sirve el editor de filas normal de "Cuerpo JSON" — Firestore necesita cada campo envuelto en `fields` y con su tipo (`stringValue`, `doubleValue`, `timestampValue`), y ese editor de Atajos solo hace pares clave-valor de un nivel. En su lugar:

1. Añade una acción **Texto** y escribe esto letra por letra, insertando cada burbuja donde se indica (usa "Seleccionar variable" para encontrarlas, no escribas el nombre a mano):
   ```
   {"fields":{"importe":{"doubleValue":[Importe]},"tipo":{"stringValue":"Gasto"},"categoria_id":{"stringValue":"[CategoriaID]"},"cuenta_id":{"stringValue":"[CuentaID]"},"fecha":{"timestampValue":"[FechaISO]"},"subcategoria":{"stringValue":"[Subcategoria]"},"nota":{"stringValue":""}}}
   ```
   (cada `[Nombre]` es la burbuja de esa variable, no texto literal)
2. Añade **Obtener contenido de URL**:
   - URL: `https://firestore.googleapis.com/v1/projects/tu-proyecto/databases/(default)/documents/movimientos`
   - Método `POST`
   - Cabeceras: `Authorization` = `Bearer ` + burbuja `Token`, `Content-Type` = `application/json`
   - **Cuerpo de la solicitud**: cambia el tipo de "JSON" a **Archivo**, y en el campo que aparece mete la burbuja del **Texto** del paso 1.

**I — Confirmación**: **Mostrar notificación**, "Gasto añadido ✓".

### 3.3.2 Atajo "Registrar un ingreso"

Más rápido: duplica el Atajo de Gasto ya terminado y cambia solo:
- Las opciones y ramas del menú de categoría (paso E) por tus categorías de ingreso (Nómina, Paga extra, Préstamos...) — puedes reutilizar el mismo ID de una categoría que ya uses en Gasto, la categoría no es exclusiva de un tipo.
- En el Texto del JSON (paso H), `"tipo":{"stringValue":"Gasto"}` → `"tipo":{"stringValue":"Ingreso"}`.
- Notificación final: "Ingreso añadido ✓".

Todo lo demás (login, fecha, menú de cuentas, subcategoría, URL/cabeceras de Firestore) se queda igual.

### 3.3.3 Atajo "Registrar una transferencia"

También más rápido duplicando uno de los otros dos. Este no lleva categoría — es dinero moviéndose entre dos de tus propias cuentas (o un retiro a Efectivo, si tienes esa cuenta creada).

1. Borra el bloque de categoría entero (menú + ramas).
2. Deja el menú de cuentas que ya tienes como "cuenta origen" (cambia el texto de la pregunta a "¿Cuenta origen?" si quieres, y usa `CuentaOrigenID` como nombre de variable en cada rama en vez de `CuentaID`).
3. Duplica ese mismo bloque de menú completo para la "cuenta destino": pregunta "¿Cuenta destino?", mismas cuentas como opciones, mismo patrón Texto + Definir variable pero llamando a la variable `CuentaDestinoID` en cada rama (incluye "Efectivo" como opción, para los retiros).
4. Borra la pregunta de subcategoría — una transferencia no lleva.
5. Cambia el Texto del JSON a:
   ```
   {"fields":{"importe":{"doubleValue":[Importe]},"tipo":{"stringValue":"Transferencia"},"cuenta_id":{"stringValue":"[CuentaOrigenID]"},"cuenta_destino_id":{"stringValue":"[CuentaDestinoID]"},"fecha":{"timestampValue":"[FechaISO]"},"nota":{"stringValue":""}}}
   ```
   (Sin `categoria_id` ni `subcategoria`.)
6. Notificación final: "Transferencia registrada ✓".

### 3.4 Probar

Ejecuta cada Atajo tocándolo directamente desde la lista "Mis Atajos" (no desde el botón ▶ dentro del editor — a veces se comporta distinto) con un importe pequeño de prueba, y comprueba que aparece en **Movimientos** en la web (puede tardar 1-2 segundos; una transferencia se ve como "Cuenta A → Cuenta B" sin +/-, y no cuenta en los totales de gasto/ingreso ni en los gráficos).

Si algo falla, la petición a Firestore devuelve el error de Google en texto — añade temporalmente un **"Mostrar"** después de esa acción, con la respuesta de la petición, para leerlo. Los errores más comunes y su causa:
- `"Unknown name ... Cannot find field"` → al cuerpo de la petición le falta la capa `fields` (revisa el paso H, el Texto del JSON).
- `"Illegal timestamp format"` → la fecha no tiene el formato ISO 8601 completo con desfase horario (revisa el paso D).
- `"No se ha proporcionado ninguna clave"` en un "Obtener valor del diccionario" → normalmente indica que ese enfoque (Diccionario) no es fiable aquí; monta esa parte con el método de menú descrito más arriba en su lugar.

### 3.5 Añadirlos al Centro de Control (sin abrir Atajos)

Con los 3 Atajos ya creados y probados:

1. **Ajustes** → **Centro de Control**.
2. Busca la sección "Controles incluidos" y pulsa **Añadir un control** (o el **+** verde según tu versión de iOS).
3. Busca **"Atajo"** en la lista — verás una entrada por cada Atajo que tengas creado, incluidos tus 3 nuevos.
4. Añade **Registrar un ingreso**, **Registrar un gasto** y **Registrar una transferencia**, en ese orden (el orden en que los añades aquí es el orden en que aparecen).
5. Puedes arrastrar el icono ⠿ de cada uno para reordenarlos o agruparlos como en tu captura (ingreso arriba, gasto abajo).

Desde ahora, deslizando desde arriba a la derecha (o desde abajo, según el modelo) para abrir el Centro de Control, tienes los 3 a un toque — sin desbloquear del todo ni abrir ninguna app.

### 3.6 Los Atajos de Gaby (en SU iPhone)

Son exactamente los mismos 3 Atajos, montados en su teléfono. La forma más rápida: **compártele los tuyos** (Atajos → mantener pulsado el Atajo → Compartir → AirDrop o enlace de iCloud) y en su iPhone cambiáis solo tres cosas en cada uno:

1. **El login (paso B)**: en el cuerpo de la petición a `signInWithPassword`, su email (`gabryela.knauft.mrg@gmail.com`) y su contraseña, en vez de los tuyos. Así cada movimiento entra firmado con su cuenta.
2. **Los IDs de sus cuentas y categorías**: cada cuenta y categoría tiene su propio ID de Firestore, también las de ella. Se copian igual que los tuyos: en la web, **viendo el perfil de Gaby**, ir a Cuentas / Categorías y tocar el botoncito de copiar de cada una (Imagin, Efectivo, Uñas…). Sus IDs son distintos de los tuyos — no vale reutilizar los tuyos.
3. **Un campo nuevo en el JSON (paso H), y este es EL importante**: los Atajos escriben directo en Firestore, sin pasar por la app, así que no llevan el sello de perfil automático. Los tuyos no hay que tocarlos (un movimiento sin perfil cuenta como tuyo, a propósito). Los de ella tienen que añadir al final del JSON, dentro de `fields`:

   ```
   ,"perfil":{"stringValue":"gaby"}
   ```

   Ejemplo del gasto completo:

   ```
   {"fields":{"importe":{"doubleValue":[Importe]},"tipo":{"stringValue":"Gasto"},"categoria_id":{"stringValue":"[CategoriaID]"},"cuenta_id":{"stringValue":"[CuentaID]"},"fecha":{"timestampValue":"[FechaISO]"},"subcategoria":{"stringValue":"[Subcategoria]"},"nota":{"stringValue":""},"perfil":{"stringValue":"gaby"}}}
   ```

   Lo mismo en el de Ingreso y el de Transferencia.

**Si se le olvida el campo `perfil`**: el movimiento no desaparece — aparece en TU perfil en vez del suyo (sin campo = tuyo). Se arregla en un momento: se borra desde tu perfil y se vuelve a apuntar, o me lo dices y lo recoloco.

**La Revolut conjunta**: un movimiento que toque la cuenta conjunta debería llevar `"perfil":{"stringValue":"ambos"}` para que el saldo cuadre desde los dos perfiles. Como el Atajo no distingue de cuentas, lo más simple es que los movimientos de la conjunta se apunten desde la app (que los sella como "ambos" ella sola), y los Atajos se usen para el día a día de las cuentas propias.

### 3.7 El Atajo del Bizum entre vosotros

Un solo apunte que **resta en la cuenta de uno y suma en la del otro**, sin que el que recibe tenga que hacer nada. Es una Transferencia normal con dos particularidades: la cuenta de destino es DEL OTRO perfil, y el movimiento va sellado como de los dos (`"perfil":"ambos"`), que es lo que hace que cada uno lo vea en su app y su saldo cuadre.

Cómo montarlo (en tu iPhone, "Bizum a Gaby"):

1. Duplica tu Atajo de **Transferencia**.
2. Quita las preguntas de cuenta origen/destino: aquí van FIJAS.
3. En el JSON (paso H), deja los IDs escritos a mano y añade el perfil:

   ```
   {"fields":{"importe":{"doubleValue":[Importe]},"tipo":{"stringValue":"Transferencia"},"cuenta_id":{"stringValue":"TU_CUENTA_ID"},"cuenta_destino_id":{"stringValue":"CUENTA_DE_GABY_ID"},"fecha":{"timestampValue":"[FechaISO]"},"nota":{"stringValue":"Bizum"},"perfil":{"stringValue":"ambos"}}}
   ```

   - `TU_CUENTA_ID`: el ID de TU cuenta de la que sale el dinero (tu Revolut, por ejemplo) — cópialo de tu perfil, en Cuentas.
   - `CUENTA_DE_GABY_ID`: el ID de la cuenta de ella donde entra — se copia **viendo su perfil** (botón "Ver la app de Gaby"), en Cuentas.

4. En el iPhone de ella, el espejo ("Bizum a Jerry"): sus IDs de origen, los tuyos de destino, y el mismo `"perfil":"ambos"`.

En pantalla, cada uno lo ve con nombre y apellido: "Revolut → Imagin · Gaby". Un Bizum entre vosotros no cuenta como gasto ni como ingreso en los gráficos (es mover dinero de casa, no gastarlo): solo mueve los saldos, que es lo que tiene que hacer.

De momento el Atajo es el camino: el formulario de transferencias de la app solo enseña tus propias cuentas como destino. (La app ya sabe sellar como "ambos" una transferencia cruzada si algún día le llega una — el Atajo se lo demuestra.)

## 4. Orden recomendado

1. Me pasas el `firebaseConfig` → lo conecto.
2. Activas login + publicas las reglas (paso 1.2 y 1.3).
3. Activas GitHub Pages (paso 2) → entras en la web con tu email/contraseña.
4. Pulsas "Importar mis datos iniciales" en el Dashboard (aparece solo la primera vez).
5. Revisamos que todo se vea bien con tus datos reales.
6. Montas el Shortcut siguiendo el paso 3 — es autoexplicativo, pero si algo no cuadra dímelo y lo revisamos juntos.
