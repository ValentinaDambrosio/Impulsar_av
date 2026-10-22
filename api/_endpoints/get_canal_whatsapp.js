import { json } from "../_lib/http.js";

export default async function handler(req, res) {
  const url = (process.env.CANAL_WHATSAPP_URL || "").trim();
  json(res, 200, { url: url || null });
}