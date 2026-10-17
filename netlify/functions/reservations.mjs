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
      const { reservation } = await request.json();
      if (!isValidReservation(reservation)) return json({ error: "Los datos de la reserva no son válidos." }, 400);
      const reservations = await readReservations(store);
      const conflict = findConflict(reservations, reservation);
      if (conflict) {
        return json(
          { error: `${reservation.room} ya está reservada de ${conflict.startTime} a ${conflict.endTime}.` },
          409,
        );
      }
      await store.setJSON(`${PREFIX}${reservation.id}`, reservation);
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
