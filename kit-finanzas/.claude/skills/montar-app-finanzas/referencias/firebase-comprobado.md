# Firebase, paso a paso y comprobado

Firebase es el sitio de Google donde se van a guardar los movimientos del
usuario. Es gratis para lo que va a usar (el plan gratuito da de sobra para
las finanzas de una persona) y es lo único que hay que crear a mano.

Estas pantallas **no las puedes tocar tú**: están detrás de una cuenta de
Google. Lo que sí puedes es pedirle una cosa a la vez y **comprobar cada una
antes de pasar a la siguiente**. Las llamadas de comprobación de este archivo
están probadas contra un proyecto de Firebase de verdad: devuelven
exactamente lo que aquí se dice.

Explícale de paso, cuando le pidas crear la cuenta, que Firebase no le va a
cobrar nada y que no le pide tarjeta para el plan gratuito.

---

## 1 · Crear el proyecto

Dile, tal cual:

> Entra en **console.firebase.google.com** con tu cuenta de Google.
> Pulsa **Crear un proyecto**, ponle el nombre que quieras (por ejemplo
> "Mis Finanzas") y dale a Continuar. Cuando te pregunte por Google
> Analytics, puedes decir que **no**: no hace falta para nada.
> Cuando termine, dime el **ID del proyecto** — sale debajo del nombre, y es
> como el nombre pero en minúsculas y con guiones.

## 2 · Crear la app web y sacar la configuración

> Ya dentro del proyecto, arriba a la izquierda hay una **rueda dentada** →
> **Configuración del proyecto**. Baja hasta donde pone **Tus apps** y pulsa
> el icono `</>`. Ponle un apodo cualquiera y **no** marques Firebase
> Hosting. Al terminar te enseña un bloque que empieza por
> `const firebaseConfig = {`. Cópiamelo entero y pégamelo aquí.

Ese bloque no es un secreto: va dentro de una web, así que cualquiera que
abra su página lo puede ver, y Google cuenta con ello. Lo que protege sus
datos es su contraseña y las reglas del paso 5. Si te pregunta, díselo así.

### Comprobación: ¿la clave sirve?

```sh
curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=LA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"prueba@ejemplo.com","continueUri":"http://localhost"}'
```

| Devuelve | Qué significa | Qué le dices |
|---|---|---|
| `"kind": "identitytoolkit#CreateAuthUriResponse"` con un `sessionId` | ✓ la clave es buena | Seguimos |
| `"API key not valid. Please pass a valid API key."` | La clave está mal copiada, o es de otro proyecto | Que vuelva a **Configuración del proyecto → Tus apps** y copie el bloque otra vez entero |

## 3 · Activar el acceso por correo y contraseña

> En el menú de la izquierda: **Compilación → Authentication → Comenzar**.
> En la pestaña **Sign-in method** (Método de acceso), pulsa
> **Correo electrónico/contraseña**, actívalo con el interruptor de arriba
> y **Guardar**. El segundo interruptor, el de "vínculo de correo", déjalo
> apagado.

### Comprobación: ¿está activado?

Se prueba a entrar con un usuario que no existe. No hace falta ninguna
contraseña de verdad: lo que se mira es **qué error** devuelve.

```sh
curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=LA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"nadie@ejemplo.invalid","password":"xxxxxxxx","returnSecureToken":true}'
```

| Devuelve | Qué significa |
|---|---|
| `INVALID_LOGIN_CREDENTIALS` | ✓ está activado. El acceso funciona; lo único que falla es que ese usuario no existe, que es justo lo que se buscaba |
| `OPERATION_NOT_ALLOWED` | ✗ falta activarlo. Que repita el paso 3 |
| `API key not valid` | Se ha colado la clave mal; vuelve al paso 2 |

> Lo de `INVALID_LOGIN_CREDENTIALS` está comprobado contra un proyecto real.
> Lo de `OPERATION_NOT_ALLOWED` es lo que documenta Firebase para un método
> de acceso apagado, pero no se ha podido reproducir aquí. Si te sale otra
> cosa, no la des por buena: enséñasela tal cual y decide con ella delante.

## 4 · Crear su usuario

> En **Authentication → Users** (Usuarios) → **Add user** (Añadir usuario).
> Pon tu correo y una contraseña de al menos 6 caracteres.
> **Esa contraseña no me la digas**: la vas a escribir tú en la pantalla de
> acceso de tu app y ya está. Apúntatela donde guardes las demás.

No hay registro público en esta app: los usuarios se crean así, a mano. Eso
es a propósito — significa que nadie puede darse de alta en sus datos.

## 5 · Crear la base de datos

> Menú de la izquierda: **Compilación → Firestore Database → Crear base de
> datos**. Elige **modo de producción** (el de producción, no el de prueba:
> el de prueba deja tus datos abiertos durante un mes). La ubicación, la que
> te salga más cerca (`eur3` o `europe-west` si estás en España). Y crear.

## 6 · Publicar las reglas

Las reglas son el candado. Sin ellas, cualquiera con la dirección puede leer
y escribir sus movimientos.

> En **Firestore Database → pestaña Reglas**: borra todo lo que haya y pega
> el contenido del archivo `firestore.rules` que tienes en tu carpeta.
> Después, **Publicar**.

Pásale tú el contenido del archivo, no le hagas buscarlo.

### Comprobación: ¿están sus datos protegidos?

Esta es **la comprobación más importante de todo el proceso**. Se pide leer
sus datos sin haber iniciado sesión: tiene que salir denegado.

```sh
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://firestore.googleapis.com/v1/projects/EL_ID_DEL_PROYECTO/databases/(default)/documents/cuentas"
```

Y para ver el mensaje entero, la misma llamada sin `-o /dev/null -w`.

| Devuelve | Qué significa | Qué haces |
|---|---|---|
| `403` con `"Missing or insufficient permissions."` | ✓ perfecto: sus datos están cerrados | Sigue |
| `403` con `"Permission denied on resource project ..."` | El ID del proyecto está mal escrito, o ese proyecto no existe | Que te lo diga otra vez desde **Configuración del proyecto** |
| `200` con datos o con `{}` | ✗ **para todo**. Las reglas están abiertas: cualquiera puede leer sus cuentas. Dile que repita el paso 6 y no sigas hasta que dé 403 | Repite el paso 6 |
| `404` | Lo más probable es que no exista todavía la base de datos: repite el paso 5 | Repite el paso 5 |

> Los dos primeros casos están comprobados contra proyectos reales, y se
> distinguen por el mensaje aunque los dos sean 403. El `404` es lo
> razonable para una base de datos que no existe, pero no se ha podido
> reproducir: si sale, enséñaselo tal cual antes de dar por hecha la causa.

---

## Errores conocidos

| Lo que ve el usuario | Causa | Solución |
|---|---|---|
| La app abre en blanco, sin pantalla de acceso | `js/firebase-config.js` mal pegado (falta una coma, o se coló el `const firebaseConfig =`) | Reescríbelo tú entero desde los valores que te dio |
| `auth/invalid-api-key` al entrar | La clave no es la de ese proyecto | Paso 2 otra vez |
| `auth/invalid-credential` o "usuario o contraseña incorrectos" | El usuario no está creado, o la contraseña no es esa | Paso 4. Puede crear el usuario otra vez con otra contraseña |
| `Missing or insufficient permissions` **dentro de la app, ya con sesión** | Las reglas no se publicaron, o se publicaron a medias | Paso 6. Ojo: las reglas hay que **publicarlas**, no basta con pegarlas |
| Entra, pero al recargar se pierde lo que añadió | Los datos no llegan a Firestore: casi siempre son las reglas | Paso 6 |
| "No tengo cuenta de Google" | Hace falta una para Firebase | Que se cree una gratis en accounts.google.com. No hace falta que use ese correo para nada más |
