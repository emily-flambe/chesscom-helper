import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'

export interface User {
  id: string
  email: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export interface CreateUserData {
  email: string
  passwordHash: string
}

export interface UpdateUserData {
  email?: string
  passwordHash?: string
}

export async function createUser(db: D1Database, userData: CreateUserData): Promise<User> {
  const id = await generateSecureId()
  const now = new Date().toISOString()

  try {
    const result = await db.prepare(`
      INSERT INTO users (id, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, userData.email, userData.passwordHash, now, now).run()

    if (!result.success) {
      throw createApiError('Failed to create user', 500, 'USER_CREATION_FAILED')
    }

    return {
      id,
      email: userData.email,
      passwordHash: userData.passwordHash,
      createdAt: now,
      updatedAt: now
    }
  } catch (error) {
    console.error('Create user error:', error)
    throw createApiError('Failed to create user', 500, 'USER_CREATION_FAILED', error)
  }
}

export async function getUserById(db: D1Database, userId: string): Promise<User | null> {
  try {
    const result = await db.prepare(`
      SELECT id, email, password_hash, created_at, updated_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first()

    if (!result) {
return null
}

    return {
      id: result.id as string,
      email: result.email as string,
      passwordHash: result.password_hash as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    }
  } catch (error) {
    console.error('Get user by ID error:', error)
    throw createApiError('Failed to fetch user', 500, 'USER_FETCH_FAILED', error)
  }
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  try {
    const result = await db.prepare(`
      SELECT id, email, password_hash, created_at, updated_at
      FROM users 
      WHERE email = ?
    `).bind(email).first()

    if (!result) {
return null
}

    return {
      id: result.id as string,
      email: result.email as string,
      passwordHash: result.password_hash as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    }
  } catch (error) {
    console.error('Get user by email error:', error)
    throw createApiError('Failed to fetch user', 500, 'USER_FETCH_FAILED', error)
  }
}

export async function updateUser(db: D1Database, userId: string, updateData: UpdateUserData): Promise<User> {
  const now = new Date().toISOString()
  const updates: string[] = []
  const values: any[] = []

  if (updateData.email) {
    updates.push('email = ?')
    values.push(updateData.email)
  }

  if (updateData.passwordHash) {
    updates.push('password_hash = ?')
    values.push(updateData.passwordHash)
  }

  if (updates.length === 0) {
    throw createApiError('No valid fields to update', 400, 'INVALID_UPDATE_DATA')
  }

  updates.push('updated_at = ?')
  values.push(now, userId)

  try {
    const result = await db.prepare(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run()

    if (!result.success) {
      throw createApiError('Failed to update user', 500, 'USER_UPDATE_FAILED')
    }

    const updatedUser = await getUserById(db, userId)
    if (!updatedUser) {
      throw createApiError('User not found after update', 404, 'USER_NOT_FOUND')
    }

    return updatedUser
  } catch (error) {
    console.error('Update user error:', error)
    throw createApiError('Failed to update user', 500, 'USER_UPDATE_FAILED', error)
  }
}

export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  try {
    const result = await db.prepare(`
      DELETE FROM users WHERE id = ?
    `).bind(userId).run()

    if (!result.success) {
      throw createApiError('Failed to delete user', 500, 'USER_DELETE_FAILED')
    }
  } catch (error) {
    console.error('Delete user error:', error)
    throw createApiError('Failed to delete user', 500, 'USER_DELETE_FAILED', error)
  }
}