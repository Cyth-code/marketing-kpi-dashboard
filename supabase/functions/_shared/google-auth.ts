// Mints a Google OAuth2 access token from a service-account key using a
// signed JWT (RS256) — no external deps, pure Deno Web Crypto.

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

/**
 * @param scope space-separated OAuth scopes
 * @returns bearer access token
 */
export async function getAccessToken(scope: string): Promise<string> {
  const email = Deno.env.get("GOOGLE_SA_EMAIL");
  // Private key stored with literal "\n" — convert back to real newlines.
  const key = Deno.env.get("GOOGLE_SA_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Missing GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY secrets");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(
    JSON.stringify(claim),
  )}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );

  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

// ---- shared date helpers: complete ISO weeks (Mon–Sun) ----

/** Monday of the ISO week containing `d`. */
export function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // 0 = Monday
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The last `n` complete weeks as [{start, end}] (Mon–Sun), oldest first. */
export function lastCompleteWeeks(n: number): { start: Date; end: Date }[] {
  const today = new Date();
  const thisMonday = mondayOf(today);
  const weeks: { start: Date; end: Date }[] = [];
  for (let i = n; i >= 1; i--) {
    const start = new Date(thisMonday);
    start.setUTCDate(start.getUTCDate() - i * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    weeks.push({ start, end });
  }
  return weeks;
}
