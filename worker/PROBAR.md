# El servidor de avisos: qué es y cómo probarlo

Un Cloudflare Worker (plan gratuito) con un almacén KV y un cron que se
despierta cada minuto. La app le manda **qué** avisos tienen que sonar y
**cuándo**; el cron manda al móvil los que tocan, cifrados y firmados como
exige el estándar Web Push. El móvil los enseña con la app cerrada.

Este servidor no sabe nada de préstamos ni de agendas: solo guarda listas
(una por móvil), espera al minuto y empuja. Quien decide qué avisar es la
app (`js/avisos-calculo.js`).

## Probarlo sin Cloudflare (en un minuto)

```
node worker/prueba/probar.mjs
```

Levanta un KV de mentira (que cuenta escrituras) y un servicio de push de
mentira que hace lo que haría el navegador: **descifra** el empujón con las
claves del móvil y **comprueba la firma VAPID**. Comprueba, entre otras
cosas:

- que el aviso sale en su minuto exacto y no se repite;
- que un aviso de hace más de dos horas se da por perdido con un motivo en
  castellano;
- que si el servicio del móvil falla, se reintenta con esperas crecientes
  (1, 2, 4… minutos) hasta 8 veces, y luego se da por perdido explicando
  por qué;
- que si el móvil ya no existe (410), la suscripción se borra;
- que una pasada sin nada que hacer no escribe en KV, y que el listado de
  suscripciones se reutiliza durante 3 minutos (cupos del plan gratuito).

## Desplegarlo (la primera vez)

Hace falta un token de Cloudflare con la plantilla "Edit Cloudflare
Workers", en la variable `CLOUDFLARE_API_TOKEN`.

```
cd worker
npm install wrangler
npx wrangler kv namespace create AVISOS            # pega el id en wrangler.jsonc
node herramientas/generar-claves.mjs               # una vez; la privada es el secreto
npx wrangler secret put VAPID_PRIVADA_JWK          # pega el JWK entero
npx wrangler deploy                                # te da la URL https://…workers.dev
```

Luego, en la app, pon esa URL en `js/config-avisos.js` (`URL_AVISOS`) y
publica. La tarjeta "Avisos en el móvil" de Ajustes pasa de "aún no está
configurado" a ofrecer "Activar avisos en este móvil".

## Probarlo de verdad, en el móvil

1. Con la app instalada en la pantalla de inicio (en iPhone es obligatorio),
   Ajustes → Avisos en el móvil → **Activar**. El navegador pide permiso.
2. **Mándame un aviso de prueba ahora**: tiene que llegar en unos segundos.
3. Cierra la app del todo y apaga la pantalla. Un aviso programado (una cita
   de la agenda, un cobro) tiene que sonar a su hora.
4. La tarjeta solo dice "✓ Avisos activados · N programados" cuando el
   servidor lo confirma. Si algo no llegó, lo dice con su motivo.

Si en Android no llega con la pantalla apagada, casi siempre es el ahorro
de batería: Ajustes → Aplicaciones → Chrome → Batería → Sin restricciones.

## Rutas

| Ruta | Para qué |
|---|---|
| `GET /api/avisos/clave` | La clave pública VAPID (la app la necesita para suscribirse) |
| `POST /api/avisos/sincronizar` | La app manda su suscripción y la lista entera de avisos (sustituye la anterior) |
| `GET /api/avisos/estado?endpoint=` | Si el móvil consta suscrito, cuántos avisos tiene, cuántos salieron, cuáles se perdieron y por qué |
| `POST /api/avisos/prueba` | Un empujón ahora mismo |
| `GET /api/avisos/pendientes?endpoint=` | Lo enviado y aún no enseñado (para empujones que llegan sin contenido) |
| `POST /api/avisos/mostrados` | El service worker confirma qué enseñó |
| `POST /api/avisos/baja` | Desactivar en ese móvil |

## Si se pierden las claves VAPID

Todos los móviles tendrán que volver a activar los avisos. Guarda el JWK
privado en un sitio seguro además de en el secreto del Worker.
