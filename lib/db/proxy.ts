import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session once per navigation and writes updated auth
 * cookies to both the request (for the rendering code) and the response (for the browser).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  let env;
  try {
    env = publicEnv();
  } catch {
    // Supabase not configured (e.g. a preview without env vars): serve pages without a session.
    return response;
  }

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not put code between client creation and this call: it triggers the refresh.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  // Optimistic redirects for a smooth flow. The real check is getCurrentUser() plus RLS.
  if (!signedIn && isProtectedPath(pathname)) return redirectTo("/login", request, response);
  if (signedIn && isAuthPath(pathname)) return redirectTo("/app", request, response);

  return response;
}

export function isProtectedPath(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
}

export function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/registrieren";
}

/** Redirects while keeping any refreshed auth cookies from the session update. */
function redirectTo(path: string, request: NextRequest, sessionResponse: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
