import { NextResponse } from "next/server";
import { getLocalityNames } from "@/lib/localities";

// Public: just area names, no sensitive data. Used by client-side pickers.
export async function GET() {
  return NextResponse.json({ localities: await getLocalityNames() });
}
