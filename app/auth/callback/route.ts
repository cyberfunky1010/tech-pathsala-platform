import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const allowedDestinations = new Set(["/register", "/dashboard", "/school-admin", "/central-admin"]);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext && allowedDestinations.has(requestedNext) ? requestedNext : "/register";
  const destination = new URL(next, request.url);

  if (!code) {
    destination.pathname = "/login";
    destination.search = `?next=${encodeURIComponent(next)}&error=confirmation_failed`;
    return NextResponse.redirect(destination);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      destination.pathname = "/login";
      destination.search = `?next=${encodeURIComponent(next)}&error=confirmation_failed`;
    }
  } catch {
    destination.pathname = "/login";
    destination.search = `?next=${encodeURIComponent(next)}&error=confirmation_failed`;
  }

  return NextResponse.redirect(destination);
}
