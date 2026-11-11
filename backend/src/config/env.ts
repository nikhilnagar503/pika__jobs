import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 4000),
  appUrl: (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, ""),
  apiUrl: (process.env.API_URL || "http://localhost:4000").replace(/\/$/, ""),
  frontendOrigins: (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  adminEmail: (process.env.PIKAJOBS_ADMIN_EMAIL || "nagarn603@gmail.com").toLowerCase(),
  paymentsEnabled: process.env.PIKAJOBS_PAYMENTS_ENABLED === "true",
  taskSecret: process.env.PIKAJOBS_TASK_SECRET || "",
};

export function supabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
