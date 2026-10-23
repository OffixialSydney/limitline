import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

function normalizeSupabaseUrl(raw = ""): string {
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const dash = cleaned.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash?.[1]) return `https://${dash[1]}.supabase.co`;
  return cleaned.replace(/\/rest\/v1$/i, "");
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  let user = null;

  try {
    const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

    if (supabaseUrl && supabaseKey) {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(list: CookieToSet[]) {
            list.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      });
      // getUser() validates the session with Supabase Auth on every request; getSession() is never trusted on the server.
      const { data, error } = await supabase.auth.getUser();
      if (error && process.env.NODE_ENV !== "production" && error.name !== "AuthSessionMissingError") {
        console.warn("[middleware] supabase.auth.getUser diagnostic:", {
          code: error.code,
          status: error.status,
          message: error.message,
        });
      }
      user = data?.user ?? null;
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[middleware] Unexpected error verifying session:", err);
    }
  }

  const path = request.nextUrl.pathname;
  const isApp = path.startsWith("/app");
  const isAuthPage = path === "/login" || path === "/signup";

  if (!user && isApp) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Only redirect GET navigation requests on /login or /signup so Server Action POST requests are never interrupted.
  if (user && isAuthPage && request.method === "GET") {
    const url = request.nextUrl.clone();
    url.pathname = "/app/overview";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
