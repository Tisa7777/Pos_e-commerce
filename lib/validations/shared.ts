import { z } from "zod";

// We accept any canonical 8-4-4-4-12 UUID-looking string here because the
// seeded portfolio data uses deterministic IDs that Postgres stores as uuid
// values, but they do not all satisfy Zod's stricter RFC variant check.
const uuidLikePattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function uuidLikeSchema(message = "Invalid ID.") {
  return z.string().regex(uuidLikePattern, message);
}
