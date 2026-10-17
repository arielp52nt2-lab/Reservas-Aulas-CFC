import { getStore } from "@netlify/blobs";

const STORE_NAME = "cfc-reservas";
const PREFIX = "reservation/";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

function isValidReservation(item) {
  return Boolean(
    item &&
      typeof item.id === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      typeof item.floor === "string" &&
      typeof item.room === "string" &&
      /^\d{2}:\d{2}$/.test(item.startTime) &&
      /^\d{2}:\d{2}$/.test(item.endTime) &&
      typeof item.responsible === "string" &&
      typeof item.department === "string" &&
      typeof item.topic === "string" &&
      Number(item.attendees) > 0,
  );
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

async function readReservations(store) {
  const { blobs } = await store.list({ prefix: PREFIX });
  const values = await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json", consistency: "strong" })));
  return values.filter(isValidReservation).sort((a, b) =>
    `${a.date} ${a.startTime} ${a.room}`.localeCompare(`${b.date} ${b.startTime} ${b.room}`, "es"),
  );
}

function findConflict(reservations, candidate) {
  return reservations.find(
    (item) =>
      item.id !== candidate.id &&
      item.date === candidate.date &&
      item.room === candidate.room &&
      timeToMinutes(candidate.startTime) < timeToMinutes(item.endTime) &&
      timeToMinutes(candidate.endTime) > timeToMinutes(item.startTime),
  );
}

export default async function handler(request) {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  try {
    if (request.method === "GET") {
      return json({ reservations: await readReservations(store) });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const incoming = Array.isArray(body.reservations) ? body.reservations : [body.reservation];
      if (!incoming.length || incoming.length > 7 || incoming.some((item) => !isValidReservation(item))) {
        return json({ error: "Los datos de las reservas no son válidos o superan el máximo de 7 días." }, 400);
      }
      if (new Set(incoming.map((item) => item.id)).size !== incoming.length) {
        return json({ error: "Las reservas contienen identificadores repetidos." }, 400);
      }

      const reservations = await readReservations(store);
      const checkedReservations = [...reservations];
      let conflictDetails = null;
      for (const reservation of incoming) {
        const conflict = findConflict(checkedReservations, reservation);
        if (conflict) {
          conflictDetails = { reservation, conflict };
          break;
        }
        checkedReservations.push(reservation);
      }
      if (conflictDetails) {
        return json(
          {
            error: `${conflictDetails.reservation.room} ya está reservada el ${conflictDetails.reservation.date} de ${conflictDetails.conflict.startTime} a ${conflictDetails.conflict.endTime}.`,
          },
          409,
        );
      }
      await Promise.all(incoming.map((reservation) => store.setJSON(`${PREFIX}${reservation.id}`, reservation)));
      return json({ reservations: await readReservations(store) });
    }

    if (request.method === "PUT") {
      const { reservations = [] } = await request.json();
      const valid = reservations.filter(isValidReservation);
      const existing = await readReservations(store);
      const existingIds = new Set(existing.map((item) => item.id));
      await Promise.all(
        valid.filter((item) => !existingIds.has(item.id)).map((item) => store.setJSON(`${PREFIX}${item.id}`, item)),
      );
      return json({ reservations: await readReservations(store) });
    }

    if (request.method === "DELETE") {
      const { id } = await request.json();
      if (!id || typeof id !== "string") return json({ error: "Falta el identificador de la reserva." }, 400);
      await store.delete(`${PREFIX}${id}`);
      return json({ reservations: await readReservations(store) });
    }

    return json({ error: "Método no permitido." }, 405);
  } catch (error) {
    console.error("Error en reservas compartidas", error);
    return json({ error: "No se pudo acceder al almacenamiento compartido." }, 500);
  }
}
