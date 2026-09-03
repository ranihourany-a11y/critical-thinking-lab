import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient(customCookieStore?: {
  get: (name: string) => { value: string } | undefined;
  getAll?: () => { name: string; value: string }[];
  set?: (name: string, value: string, options?: CookieOptions) => void;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  let cookieStore: any;
  if (customCookieStore) {
    cookieStore = customCookieStore;
  } else {
    try {
      cookieStore = await cookies();
    } catch {
      // Running in environment without next/headers cookies
    }
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          if (cookieStore?.getAll) {
            return cookieStore.getAll();
          }
          return [];
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (cookieStore?.set) {
                cookieStore.set(name, value, options);
              }
            });
          } catch {
            // Cannot set cookies in read-only Server Component
          }
        },
      },
    }
  );
}
