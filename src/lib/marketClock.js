// src/lib/marketClock.js — Estado de la sesión regular de NYSE.
//
// Función pura: recibe una fecha y dice si el mercado está abierto
// (lunes a viernes, 9:30 a 16:00 hora de Nueva York). No conoce feriados:
// un feriado entre semana se muestra como abierto.

const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 16 * 60;
const WEEKEND = ["Sat", "Sun"];

const NY_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function labelFor(weekday, minute) {
  if (WEEKEND.includes(weekday)) return "Fin de semana";
  if (minute < OPEN_MINUTE) return "Pre-mercado";
  if (minute < CLOSE_MINUTE) return "Mercado abierto";
  return "Mercado cerrado";
}

export function marketStatus(date = new Date()) {
  const parts = Object.fromEntries(NY_PARTS.formatToParts(date).map((p) => [p.type, p.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const label = labelFor(parts.weekday, minute);
  return {
    open: label === "Mercado abierto",
    label,
    time: `${parts.hour}:${parts.minute}`,
  };
}
