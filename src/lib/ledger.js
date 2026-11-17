// Re-export: la lógica del libro vive en lib/ledger.js para que el servidor
// (validación de /api/theses/ledger) y el navegador usen el mismo código.
export * from "../../lib/ledger.js";
