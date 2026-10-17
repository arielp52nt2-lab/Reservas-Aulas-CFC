# Reservas de aulas CFC

Aplicación web local para registrar y consultar reservas de aulas por fecha.

## Uso

1. Abre `index.html` en un navegador moderno.
2. En **Nueva reserva**, selecciona fecha, piso, aula y horario.
3. Completa los datos de la actividad y guarda la reserva.
4. Copia el mensaje preparado o usa **Abrir correo**.

Las reservas se guardan en el almacenamiento local del navegador del equipo. Para compartir una copia del historial, usa **Descargar CSV**.

El calendario mensual muestra el total de reservas, asistentes y aulas utilizadas. La opción **Abrir correo con formato** genera un archivo `.eml` para abrirlo como borrador en Outlook conservando la tabla y los colores.

## Espacios configurados

- Piso 1: Atenea (Centro de cómputo, 24 personas) y Manuela Sáenz (Sala de capacitación, 60 personas).
- Piso 2: Albert Einstein (Sala de capacitación, 40 personas) y Platón (Sala de meditación, 25 personas).
- Piso 3: Sócrates (Sala de conferencias, 12 personas) y Leonardo da Vinci (Sala multiuso, 25 personas).
- Piso 4: Aristóteles (Auditorio, 105 personas).

## Versionado

El archivo `CHANGELOG.md` registra los cambios. Cada entrega estable se conserva en el historial Git y en una carpeta independiente dentro de `versiones`.
