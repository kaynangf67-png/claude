import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const APP_PREFIXES = ["/inicio", "/desafio", "/guia", "/progresso", "/perfil", "/relatorio", "/onboarding"];

/**
 * Só age quando o Supabase está configurado: renova a sessão nos cookies e faz um
 * redirecionamento otimista para /entrar. A proteção real dos dados é o RLS no banco.
 * No modo demonstração a sessão vive no localStorage e a checagem é feita no cliente.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isApp = APP_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));
  if (isApp && !data?.claims) {
    const to = request.nextUrl.clone();
    to.pathname = "/entrar";
    to.search = `?voltar=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
