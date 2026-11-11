export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "nagarn603@gmail.com").toLowerCase();

export function apiPath(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return API_URL ? `${API_URL}${clean}` : clean;
}
