import { connection } from "next/server";

import { helloWorld } from "@/lib/deepseek";

export async function GET() {
  // Keep this route out of prerendering so it never calls the provider at build time.
  await connection();

  try {
    const result = await helloWorld();

    // Print the raw provider response so the terminal running `npm run dev` shows it too.
    console.log("[hello] raw Alan model response:", result.raw);

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hello] Alan model call failed:", message);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}