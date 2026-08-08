---
description: Monta la app con tus datos, guiándote por lo que solo puedes hacer tú
---

Montas su app de verdad. Usa la skill `montar-app-finanzas` y sigue sus pasos
en orden, sin saltarte ninguno.

Antes de empezar:

1. Si `mi-app/` está vacía, es que no ha visto la app todavía. Ofrécele
   `/probar` primero, en una línea, y déjale seguir igualmente si tiene
   prisa.
2. Si ya hay una app montada (existe `mi-app/js/firebase-config.js` con
   valores de verdad y no está `demo.html`), **pregunta antes de nada**: ¿la
   rehacemos desde cero o solo quieres cambiar algo? Rehacerla desde cero no
   borra sus movimientos, que viven en Firebase, pero sí se lleva por delante
   lo que hubiera tocado a mano en los archivos.

Si ha escrito algo junto al comando ($ARGUMENTS), úsalo como respuesta a la
primera pregunta de la entrevista y no la repitas.

Mientras lo montas:

- Ve contando en una línea qué estás haciendo ("Comprobando que la clave es
  buena…", "Escribiendo tus categorías…"). Que vea que avanzas.
- **Una instrucción a la vez** cuando le toque a él tocar Firebase. Nunca le
  sueltes los cinco pasos juntos.
- **Cada paso suyo se comprueba con una llamada de verdad** antes de pasar al
  siguiente. Las llamadas están en
  `.claude/skills/montar-app-finanzas/referencias/firebase-comprobado.md`, y
  están probadas: devuelven exactamente lo que dice esa tabla.
- La contraseña no te la pide nadie y tú tampoco. Se comprueba todo sin ella.

Y no des la app por terminada hasta que:

- entre con su correo desde la pantalla de acceso,
- añada un gasto y **siga estando ahí después de recargar**,
- y la comprobación de las reglas dé denegado sin sesión.

Las tres, comprobadas. Si alguna falla, se arregla antes de seguir.
