# Control REPSE · puesta en marcha (sin Google Cloud, sin costo)

## 1. Apps Script de datos (una vez)
1. Abre tu hoja de Google → Extensiones → Apps Script.
2. Pega el contenido de `apps-script-datos.gs` (puede ser un archivo nuevo; no toques tu código de avisos ni el de la macro).
3. Engrane (Configuración del proyecto) → Propiedades de la secuencia de comandos → Agregar: nombre `CLAVE`, valor = una contraseña larga inventada por ti.
4. Implementar → Nueva implementación → tipo Aplicación web → Ejecutar como: **Yo** → Quién tiene acceso: **Cualquier persona** → Implementar. Autoriza los permisos y copia la URL que termina en /exec.

## 2. Variables de entorno en Netlify
Site configuration → Environment variables:
- `DATOS_URL` = la URL /exec del paso anterior
- `DATOS_KEY` = la misma contraseña que pusiste en CLAVE
- `AVISOS_URL` = la URL de tu Apps Script de avisos

## 3. Publicar
Sube la carpeta completa (index.html, netlify.toml, netlify/functions/). Con Git o `netlify deploy --prod` es lo más seguro para que se desplieguen las funciones. Prueba primero en un sitio aparte.

## 4. Cerrar la hoja
Cuando la app cargue bien: quita "Cualquier persona con el enlace" de la hoja y usa Archivo → Compartir → Publicar en la web → **Dejar de publicar**.
Ojo: si tu macro escribe en la hoja mediante la hoja publicada o un enlace público, avísame antes de cerrarla.

## Tu macro
No cambia: sigue escribiendo en la misma hoja y las mismas pestañas.

## Límite
La URL /.netlify/functions/datos sigue siendo pública: oculta la hoja y el código, no el acceso. Para restringirlo: contraseña de sitio de Netlify (plan Pro) o Netlify Identity.
