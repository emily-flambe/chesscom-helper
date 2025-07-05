export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
return false
}
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

export function validatePassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
return false
}
  
  if (password.length < 8 || password.length > 128) {
return false
}
  
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  
  return hasUppercase && hasLowercase && hasNumber && hasSpecialChar
}

export function validateChessComUsername(username: string): boolean {
  if (!username || typeof username !== 'string') {
return false
}
  
  if (username.length < 3 || username.length > 25) {
return false
}
  
  const usernameRegex = /^[a-zA-Z0-9_-]+$/
  return usernameRegex.test(username)
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
return ''
}
  
  return input
    .trim()
    .replace(/[<>&"']/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        '\'': '&#x27;'
      }
      return entities[char] || char
    })
}

export function validateUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
return false
}
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

export function validateNotificationFrequency(frequency: string): boolean {
  const validFrequencies = ['immediate', 'digest', 'disabled']
  return validFrequencies.includes(frequency)
}