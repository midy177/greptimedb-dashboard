// AES-256-GCM connect token — shared secret between URL generator and this dashboard.
// Anyone who can read the source can decrypt; this prevents plaintext credentials in URLs/logs,
// not adversarial attack.
const SECRET_KEY = '5jbcoK9IW61HYXXxLz0fOPhrejfO1ZRf' // exactly 32 bytes

// Short keys to keep encrypted token compact: h=host, u=username, p=password, d=database
type ConnectCredentials = { h?: string; u?: string; p?: string; d?: string }

const getKey = async (): Promise<CryptoKey> => {
  const keyBytes = new TextEncoder().encode(SECRET_KEY)
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

const toBase64url = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64url = (str: string): Uint8Array => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export const encryptConnectToken = async (credentials: ConnectCredentials): Promise<string> => {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(credentials))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const combined = new Uint8Array(iv.byteLength + cipher.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipher), iv.byteLength)
  return toBase64url(combined.buffer)
}

export const decryptConnectToken = async (token: string): Promise<ConnectCredentials | null> => {
  try {
    const key = await getKey()
    const combined = fromBase64url(token)
    const iv = combined.slice(0, 12)
    const cipher = combined.slice(12)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return JSON.parse(new TextDecoder().decode(plain)) as ConnectCredentials
  } catch {
    return null
  }
}
