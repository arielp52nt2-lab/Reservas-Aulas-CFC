# Historial de versiones

## 2.1.0 — 17 de octubre de 2026

- Se agregó la selección de fecha inicial y fecha final para reservar hasta siete días consecutivos en una sola operación.
- Cada día del período se registra y aparece individualmente en los calendarios semanal y mensual.
- La disponibilidad se valida para todo el período antes de guardar; si existe un conflicto, no se crea una reserva parcial.
- El correo de confirmación muestra el período completo cuando la reserva incluye varios días.

## 2.0.0 — 17 de octubre de 2026

- Se incorporó almacenamiento centralizado mediante Netlify Blobs para compartir reservas entre dispositivos.
- Las altas, ediciones y eliminaciones se guardan en una función del sitio y se reflejan automáticamente cada cuatro segundos.
- Se agregó migración inicial de las reservas locales existentes al almacenamiento compartido.
- El modo local se conserva como respaldo cuando se abre la aplicación fuera de Netlify.

## 1.5.0 — 17 de octubre de 2026

- Se reforzó la persistencia local para que una reserva, edición o eliminación solo se refleje después de guardarse correctamente en el navegador.
- Las reservas permanecen disponibles después de cerrar o recargar la página.
- Los cambios se sincronizan automáticamente entre pestañas abiertas del mismo navegador.
- Se documentó la diferencia entre almacenamiento local y un calendario compartido entre varios equipos.

## 1.4.1 — 17 de octubre de 2026

- La celda con la fecha del correo ahora utiliza un fondo gris claro y texto oscuro para mejorar su legibilidad.
- El nuevo contraste se aplica tanto a la vista previa como al cuadro copiado para Outlook o Gmail.

## 1.4.0 — 17 de octubre de 2026

- El formulario se reinicia automáticamente después de guardar o actualizar una reserva y queda listo para el siguiente registro.
- Las tarjetas del calendario semanal ahora muestran la marca o departamento que realizó la reserva.
- Las reservas del calendario mensual ahora muestran la marca o departamento junto con el número de asistentes.

## 1.3.0 — 17 de octubre de 2026

- Se eliminó la descarga automática de archivos `.eml` que generaba la advertencia de seguridad del navegador.
- El botón de correo ahora copia el cuadro con formato y abre la aplicación de correo con el asunto preparado.
- Se añadieron dos logotipos independientes, transparentes y con relieve 3D sutil en las esquinas superiores.
- Los logotipos se muestran directamente sobre la franja institucional, sin recuadros blancos.

## 1.2.0 — 17 de octubre de 2026

- Se cambió la ubicación del correo de Guayaquil a Quito.
- La tabla del correo ahora utiliza el color conchevino institucional y texto blanco en las celdas destacadas.
- Se agregó la generación de borradores `.eml` con formato HTML para Outlook.
- Se sustituyó el indicador de guardado y la versión visible por el logotipo institucional.
- Se incorporó un logotipo transparente con relieve 3D sutil.
- Las tarjetas semanales ahora muestran el piso y la cantidad reservada de asistentes.
- Se agregó un calendario mensual con total de reservas, asistentes y aulas utilizadas.
- Las entregas estables se conservan en carpetas separadas por versión.

## 1.1.0 — 17 de octubre de 2026

- Se incorporó el logo proporcionado y la paleta institucional roja, negra, gris y blanca.
- Se actualizaron los nombres, tipos y aforos máximos de las siete aulas.
- Se agregó validación para impedir reservas que superen el aforo del aula.
- El correo ahora presenta una tabla visual con el detalle de la reserva.
- Se agregó copiado enriquecido para pegar el correo con formato en Outlook o Gmail.
- Se corrigieron tildes, mayúsculas y redacción de los textos visibles.

## 1.0.0 — 17 de octubre de 2026

- Primera versión funcional.
- Registro de reservas por fecha, piso, aula y horario.
- Aulas configuradas para los pisos 1 a 4.
- Detección de cruces de horario para una misma aula.
- Calendario semanal con filtros.
- Historial con búsqueda, edición y eliminación.
- Mensaje para correo listo para copiar o abrir en el cliente de correo.
- Descarga del historial en formato CSV.
- Persistencia local en el navegador.
