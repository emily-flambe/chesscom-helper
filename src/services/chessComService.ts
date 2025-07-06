import { createApiError } from '../middleware/errorHandler'

export interface ChessComPlayer {
  username: string
  playerId: number
  title?: string
  name?: string
  country?: string
  location?: string
  joined: number
  lastOnline?: number
  followers?: number
  isStreamer?: boolean
  verified?: boolean
}

export interface ChessComGameStatus {
  username: string
  isOnline: boolean
  isPlaying: boolean
  currentGames: ChessComGame[]
}

export interface ChessComGame {
  url: string
  pgn?: string
  timeControl: string
  rated: boolean
  tcn?: string
  uuid: string
  initialSetup?: string
  fen?: string
  startTime?: number
  endTime?: number
  accuracies?: {
    white?: number
    black?: number
  }
}

const CHESS_COM_BASE_URL = 'https://api.chess.com/pub'
const REQUEST_TIMEOUT = 10000 // 10 seconds
const RATE_LIMIT_DELAY = 200 // 200ms between requests

export async function verifyPlayerExists(username: string, baseUrl?: string): Promise<boolean> {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL
  
  try {
    const response = await fetchWithTimeout(`${apiUrl}/player/${username}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'ChessComHelper/1.0'
      }
    }, REQUEST_TIMEOUT)

    return response.ok
  } catch (error) {
    console.error('Verify player exists error:', error)
    return false
  }
}

export async function getPlayerInfo(username: string, baseUrl?: string): Promise<ChessComPlayer | null> {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL
  
  try {
    const response = await fetchWithTimeout(`${apiUrl}/player/${username}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'ChessComHelper/1.0'
      }
    }, REQUEST_TIMEOUT)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw createApiError(`Chess.com API error: ${response.status}`, 502, 'CHESS_COM_API_ERROR')
    }

    const data = await response.json()
    return {
      username: data.username,
      playerId: data.player_id,
      title: data.title,
      name: data.name,
      country: data.country?.split('/').pop()?.replace('.png', ''),
      location: data.location,
      joined: data.joined,
      lastOnline: data.last_online,
      followers: data.followers,
      isStreamer: data.is_streamer,
      verified: data.verified
    }
  } catch (error) {
    console.error('Get player info error:', error)
    throw createApiError('Failed to fetch player information', 502, 'CHESS_COM_API_ERROR', error)
  }
}

export async function getPlayerCurrentGames(username: string, baseUrl?: string): Promise<ChessComGame[]> {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL
  
  try {
    const response = await fetchWithTimeout(`${apiUrl}/player/${username}/games/current`, {
      method: 'GET',
      headers: {
        'User-Agent': 'ChessComHelper/1.0'
      }
    }, REQUEST_TIMEOUT)

    if (!response.ok) {
      if (response.status === 404) {
        return []
      }
      throw createApiError(`Chess.com API error: ${response.status}`, 502, 'CHESS_COM_API_ERROR')
    }

    const data = await response.json()
    return data.games || []
  } catch (error) {
    console.error('Get player current games error:', error)
    throw createApiError('Failed to fetch current games', 502, 'CHESS_COM_API_ERROR', error)
  }
}

export async function getPlayerGameStatus(username: string, baseUrl?: string): Promise<ChessComGameStatus> {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL
  
  try {
    const [playerInfo, currentGames] = await Promise.all([
      getPlayerInfo(username, apiUrl),
      getPlayerCurrentGames(username, apiUrl)
    ])

    const isOnline = playerInfo ? isPlayerOnline(playerInfo.lastOnline) : false
    const isPlaying = currentGames.length > 0

    return {
      username,
      isOnline,
      isPlaying,
      currentGames
    }
  } catch (error) {
    console.error('Get player game status error:', error)
    throw createApiError('Failed to fetch player game status', 502, 'CHESS_COM_API_ERROR', error)
  }
}

export async function batchGetPlayerStatuses(usernames: string[], baseUrl?: string): Promise<ChessComGameStatus[]> {
  const results: ChessComGameStatus[] = []
  
  for (const username of usernames) {
    try {
      const status = await getPlayerGameStatus(username, baseUrl)
      results.push(status)
      
      if (usernames.length > 1) {
        await delay(RATE_LIMIT_DELAY)
      }
    } catch (error) {
      console.error(`Failed to get status for ${username}:`, error)
      results.push({
        username,
        isOnline: false,
        isPlaying: false,
        currentGames: []
      })
    }
  }
  
  return results
}

function isPlayerOnline(lastOnline?: number): boolean {
  if (!lastOnline) {
return false
}
  
  const fiveMinutesAgo = Date.now() / 1000 - 300
  return lastOnline > fiveMinutesAgo
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}