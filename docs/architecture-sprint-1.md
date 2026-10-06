# Sprint 1 — decisiones de implementación

Fuente: Documento Maestro v3.0, capítulos 6–13 y 16–21. Alcance: CO-36/HU-01,
CO-55/HU-02, CO-41/HU-30 y preparación ausente CO-73/CO-30.

## Trazabilidad

| Historia | Requisitos | Entidades | Pantallas | Pruebas |
|---|---|---|---|---|
| CO-36 | RF-01; RNF-01,05,06,20,25,26,47 | users | /registro | test_auth.py; auth-form.test.tsx; sprint1.spec.ts |
| CO-55 | RF-02,03; RNF-03,04,07,08,35,38 | users, users_authsession | /login, /cuenta | test_auth.py; account.test.tsx; sprint1.spec.ts |
| CO-41 | RF-48; RN-36,39,40,41; RNF-20,21,47 | store_settings | botón transversal | test_configuration.py; whatsapp-button.test.tsx; sprint1.spec.ts |

## Autenticación

Se cumple JWT del capítulo 18.2 con SimpleJWT. Access: 5 minutos; refresh: 7 días.
Son decisiones técnicas iniciales, configurables en settings, no reglas comerciales
nuevas. Ambas cookies son HttpOnly, SameSite=Lax y Secure en producción. Desarrollo
local usa HTTP, por lo que Secure se desactiva solo en settings de desarrollo.
No hay tokens en localStorage ni en respuestas JSON.

Cada par JWT se vincula por `sid` a una AuthSession en PostgreSQL. Cada request
protegida comprueba usuario activo y sesión no revocada. Logout revoca la sesión,
invalidando inmediatamente el access y el refresh copiados. Refresh usa
`select_for_update` y rota el JTI bajo transacción: dos solicitudes simultáneas
con el mismo refresh no pueden tener éxito ambas. Sesiones en otros dispositivos
se mantienen independientes.

Todas las operaciones de autenticación requieren CSRF, incluso registro y login.
GET /api/v1/auth/csrf/ devuelve un token CSRF enmascarado; la cookie CSRF también
es HttpOnly. Login rota el secreto CSRF. Los orígenes se validan en Django.
El cliente HTTP mantiene el token CSRF solo en memoria y agrupa los refresh
simultáneos de una pestaña.

Topología web: navegador → Next.js `/api/v1/` → Django. Las reescrituras presentan
la API bajo el mismo origen web y transmiten cookies. FRONTEND_URL debe coincidir
con el origen público, HTTPS en producción. Un despliegue en dominios separados
requiere revisar SameSite/CORS/CSRF antes de cambiar esta topología.

El registro acepta exclusivamente nombre, correo y contraseña, fija CLIENT y
rechaza campos adicionales. Correo normalizado y UNIQUE sobre Lower(email) en
PostgreSQL. Validadores estándar Django: mínimo 8 caracteres, no contraseña común,
no solo números y no similar a los datos del usuario. Máximo de entrada 128.

La protección inicial de frecuencia es 30 solicitudes/minuto/IP en autenticación,
usando el cache local de Django. No es una defensa distribuida: al desplegar varios
workers se debe añadir límite en el proxy/hosting, sin incorporar Redis al MVP.

## Configuración

`store_settings` contiene los cinco parámetros de referencia del capítulo 8.3 y
WhatsApp habilitado/número/mensaje. Solo ADMIN puede consultar/modificar el conjunto.
El endpoint público expone exclusivamente las tres claves de WhatsApp. La interfaz
recarga configuración al recuperar foco; no requiere recompilar para cambiarla.
WhatsApp inicia deshabilitado sin número comercial inventado.

No se implementan productos, carrito, pedidos ni ninguna historia del Sprint 2.
La cuenta muestra únicamente identidad y logout; edición de perfil queda en HU-03.

## Referencias técnicas consultadas

- https://docs.djangoproject.com/en/5.2/releases/5.2/
- https://django-rest-framework-simplejwt.readthedocs.io/en/stable/
- https://nextjs.org/docs/app/getting-started/installation
