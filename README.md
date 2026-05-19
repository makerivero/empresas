# Portal TecnoStore Empresas

App web responsive para clientes empresariales de soporte técnico y mantenimiento IT.

## Estado

Esta versión está lista para subir a GitHub y desplegar en Vercel. La app arranca limpia con un usuario administrador inicial y guarda la información en el navegador hasta conectar Firebase. Los archivos de Firebase ya están preparados para conectar Authentication, Firestore y Storage cuando estén las credenciales.

## Ejecutar local

```bash
npm install
npm run dev
```

## Deploy en Vercel

1. Subir este proyecto a GitHub.
2. Crear un nuevo proyecto en Vercel conectado al repositorio.
3. Framework: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.

## Firebase

1. Crear proyecto en Firebase.
2. Activar Authentication con email/password.
3. Crear Firestore.
4. Crear Storage si se van a usar adjuntos.
5. Copiar `.env.example` a `.env` y completar las variables.
6. Copiar `.firebaserc.example` a `.firebaserc` y reemplazar el ID del proyecto.
7. Publicar reglas e índices:

```bash
firebase deploy --only firestore
```

## Logo

El logo real está en `public/assets/logo.png` para que Vercel lo publique en producción. También queda una copia en `assets/logo.png` como respaldo local.

## Usuario inicial

- Admin: `admin@tecnostore.com`
- Contraseña: `Tecno2026!`

## Notas de implementación

- En el portal cliente, el selector de equipos muestra solo equipos asignados a la empresa.
- Se agregó `Otro / consulta general` para tickets que no correspondan a un equipo puntual.
- En empresas, el admin puede cargar el email y clave provisoria del login cliente.
- En usuarios, se pueden cargar técnicos, vendedores y asistentes comerciales.
- En planes, el equipo comercial puede crear o editar propuestas.
- En ventas, el administrador o asistente comercial puede crear zonas abiertas, dar prioridad opcional a un vendedor y cargar prospectos pegando listados.
- Los vendedores ven las zonas disponibles, cambian estado de visitas, pueden crear clientes y compartir planes por WhatsApp.
- El panel de ventas incluye filtros por vendedor, zona y estado, más un resumen por vendedor.
