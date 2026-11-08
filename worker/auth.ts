/**
 * Single-password sign-in. The session cookie holds an expiry time signed with the password
 * (HMAC-SHA256), so changing APP_PASSWORD signs every device out.
 */
const COOKIE = 'session'
const MAX_AGE = 60 * 60 * 24 * 365 // stay signed in on the phone for a year

async function sign(value: string, password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
}

/** Compares two strings without leaking where they differ. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function checkSession(request: Request, password: string): Promise<boolean> {
  const cookie = request.headers.get('Cookie') ?? ''
  const token = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1]
  if (!token) return false
  const [exp, mac] = token.split('.')
  if (!exp || !mac || Number(exp) < Date.now() / 1000) return false
  return same(mac, await sign(exp, password))
}

export async function handleLogin(request: Request, password: string): Promise<Response> {
  const form = await request.formData().catch(() => null)
  const given = String(form?.get('password') ?? '')
  // Compare signatures rather than the raw strings, so the comparison is constant-time
  if (!same(await sign('login', given), await sign('login', password))) {
    await new Promise((r) => setTimeout(r, 1000)) // slow down guessing
    return loginPage('Wrong password', 401)
  }
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE)
  const token = `${exp}.${await sign(exp, password)}`
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/',
      'Set-Cookie': `${COOKIE}=${token}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    },
  })
}

export function loginPage(error = '', status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · Study Notes</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f6f3; --panel: #fff; --text: #1f1d1a; --muted: #6b665e; --line: #e3e0da; --accent: #2f5bd3; --danger: #b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg: #161513; --panel: #201f1c; --text: #ece9e3; --muted: #a39e95; --line: #34322e; --accent: #7c9bf0; --danger: #f97066; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  form { width: 100%; max-width: 22rem; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 28px 24px; }
  h1 { margin: 0 0 4px; font-size: 1.35rem; }
  p { margin: 0 0 20px; color: var(--muted); font-size: .95rem; }
  label { display: block; font-weight: 600; font-size: .9rem; margin-bottom: 6px; }
  input { width: 100%; font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--text); }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  button { margin-top: 16px; width: 100%; font: inherit; font-weight: 600; padding: 10px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer; }
  .error { color: var(--danger); margin: 12px 0 0; font-size: .9rem; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1>Study Notes</h1>
  <p>Enter your password to continue.</p>
  <label for="pw">Password</label>
  <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
  ${error ? `<div class="error" role="alert">${error}</div>` : ''}
  <button type="submit">Sign in</button>
</form>
</body>
</html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
