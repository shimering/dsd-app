import { loadEnv } from "vite";

const env = loadEnv("production", process.cwd(), "VITE_");
const issues = [];
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

try {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    parsed.hostname.includes("your-project")
  ) throw new Error("Invalid project URL");
} catch {
  issues.push("Set VITE_SUPABASE_URL to the HTTPS project URL in Cloudflare's build environment.");
}

let publicKey = typeof key === "string" && key.startsWith("sb_publishable_") && key.length > 25;
if (!publicKey && typeof key === "string") {
  try {
    const parts = key.split(".");
    publicKey = parts.length === 3 && JSON.parse(Buffer.from(parts[1], "base64url").toString()).role === "anon";
  } catch { /* Invalid public key; report only the variable name. */ }
}
if (!publicKey) issues.push("Set VITE_SUPABASE_PUBLISHABLE_KEY to the project's public publishable key.");

for (const name of Object.keys(env)) {
  if (/^VITE_.*(?:GEMINI|SERVICE_ROLE|SECRET|GOOGLE.*KEY)/i.test(name) && env[name]) {
    issues.push(`Remove ${name} from browser configuration. Private AI credentials belong in Supabase Edge Function secrets.`);
  }
}

if (issues.length) {
  console.error("Cloudflare build configuration needs attention:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Public Supabase build configuration verified. No credentials were printed.");
}
