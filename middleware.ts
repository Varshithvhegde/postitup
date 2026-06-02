import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/new", "/board", "/account"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect specific routes
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  // /board/[slug] is public, /board/[slug]/settings is protected
  const isBoardSettings = /^\/board\/[^/]+\/settings/.test(pathname);
  const isBoardRoot     = /^\/board\/[^/]+(\/)?$/.test(pathname);

  if (!isProtected) return NextResponse.next();
  if (isBoardRoot) return NextResponse.next(); // board canvas is public

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url); // uses same origin as request
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/new/:path*", "/board/:path*/settings", "/account/:path*"],
};
