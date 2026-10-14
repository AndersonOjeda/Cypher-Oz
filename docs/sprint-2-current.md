# Sprint 2: guía de demostración

Fecha de verificación local: 13 de octubre de 2026, America/Bogota.

## Alcance funcional

- Productos e imágenes: creación, edición, actividad, validación de archivos y almacenamiento externo.
- Variantes y precios: SKU único, atributos por categoría, precio decimal, disponibilidad y auditoría.
- Inventario: existencias por variante, entradas, ajustes justificados, movimientos, filtros y permisos.
- Recuperación de contraseña: respuesta genérica, token temporal almacenado como hash, uso único, política de contraseña y revocación de sesiones.

## Iniciar el sistema

Desde la raíz del proyecto:

```powershell
./scripts/start-sprint1.ps1
```

Web: `http://localhost:3002`. La cuenta didáctica de administración está documentada en el README.

## Recorrido para la revisión

1. Iniciar sesión como administrador y abrir `/admin/catalogo`.
2. Crear un producto, cargar una imagen válida y comprobar el rechazo de un archivo inválido.
3. Crear una variante, intentar repetir el SKU y editar su precio.
4. Abrir `/admin/inventario`, registrar una entrada y comprobar el nuevo saldo.
5. Seleccionar `Ajuste`, registrar una variación con motivo y confirmar la operación.
6. Filtrar movimientos por tipo y fecha; comprobar actor, fecha, variación y saldos.
7. Cerrar sesión, abrir `/login` y seleccionar `¿Olvidaste tu contraseña?`.
8. Solicitar recuperación y comprobar que el mensaje no revela si la cuenta existe.
9. Abrir el enlace recibido, establecer una contraseña válida e iniciar sesión con ella.
10. Comprobar que el enlace no se puede reutilizar y que la contraseña anterior deja de funcionar.

## Validación automatizada

La CI ejecuta PostgreSQL 17, migraciones, Ruff, pytest, ESLint, TypeScript, Vitest, build de Next.js y Playwright en móvil, tableta y escritorio. Los resultados se conservan como artefacto de GitHub Actions.

La ejecución local sin PostgreSQL confirmó las pruebas funcionales nuevas y toda la suite frontend. Las pruebas de concurrencia se validan exclusivamente en PostgreSQL mediante CI.

## Pendiente externo

CO-83 exige desplegar y verificar inventario en Render STAGING. Este punto solo se cierra con una URL real, migraciones aplicadas, variables configuradas y evidencia de una entrada y un ajuste en ese entorno. Una ejecución local o de CI no sustituye esa verificación.
