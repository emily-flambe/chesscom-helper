interface JWTPayload {
  userId: string
  email?: string
  iat: number
  exp: number
}

export async function generateToken(userId: string, secret: string, expiresIn: number = 86400): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const payload: JWTPayload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn
  }

  const encodedHeader = base64urlEncode(JSON.stringify(header))
  const encodedPayload = base64urlEncode(JSON.stringify(payload))
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  const signature = await sign(signatureInput, secret)
  
  return `${signatureInput}.${signature}`
}

export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [encodedHeader, encodedPayload, signature] = parts
    
    if (!encodedHeader || !encodedPayload || !signature) {
      return null
    }
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`
    
    const expectedSignature = await sign(signatureInput, secret)
    if (signature !== expectedSignature) {
      return null
    }

    const payload = JSON.parse(base64urlDecode(encodedPayload)) as JWTPayload
    
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
  }
}

async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return base64urlEncode(new Uint8Array(signature))
}

function base64urlEncode(data: string | Uint8Array): string {
  let str: string
  if (typeof data === 'string') {
    str = btoa(unescape(encodeURIComponent(data)))
  } else {
    str = btoa(String.fromCharCode(...data))
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  return decodeURIComponent(escape(atob(str)))
}