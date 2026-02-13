import createMollieClient from "@mollie/api-client";

export function getMollie() {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error("Missing MOLLIE_API_KEY");
  return createMollieClient({ apiKey: key });
}
