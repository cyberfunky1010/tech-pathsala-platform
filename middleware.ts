import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isAuthPage = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup";
  const protectedPath = request.nextUrl.pathname.startsWith("/dashboard")
    ? "/dashboard"
    : request.nextUrl.pathname.startsWith("/school-admin")
      ? "/school-admin"
      : request.nextUrl.pathname.startsWith("/register")
        ? "/register"
        : request.nextUrl.pathname.startsWith("/central-admin")
          ? "/central-admin"
      : null;
  if (data.user && isAuthPage) {
    const next = request.nextUrl.searchParams.get("next");
    const destination = next === "/school-admin" || next === "/dashboard" || next === "/register" || next === "/central-admin"
      ? next
      : "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }
  if (!data.user && protectedPath) {
    return NextResponse.redirect(new URL(`/login?next=${protectedPath}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/school-admin/:path*", "/register/:path*", "/central-admin/:path*", "/login", "/signup"],
};
