import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  verifyPlayerExists, 
  getPlayerInfo, 
  getPlayerCurrentGames,
  getPlayerGameStatus,
  batchGetPlayerStatuses 
} from '../src/services/chessComService'
import './types'

// Mock fetch globally
global.fetch = vi.fn()

describe('Chess.com Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyPlayerExists', () => {
    it('should return true for existing player', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('{}', { status: 200 })
      )

      const result = await verifyPlayerExists('hikaru')
      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.chess.com/pub/player/hikaru',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': 'ChessComHelper/1.0'
          })
        })
      )
    })

    it('should return false for non-existing player', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      )

      const result = await verifyPlayerExists('nonexistentplayer')
      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await verifyPlayerExists('testplayer')
      expect(result).toBe(false)
    })
  })

  describe('getPlayerInfo', () => {
    it('should return player info for existing player', async () => {
      const mockPlayerData = {
        username: 'hikaru',
        player_id: 15448422,
        title: 'GM',
        name: 'Hikaru Nakamura',
        country: 'https://api.chess.com/pub/country/US',
        location: 'Westerville, OH, USA',
        joined: 1301420643,
        last_online: 1640995200,
        followers: 50000,
        is_streamer: true,
        verified: true
      }

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockPlayerData), { status: 200 })
      )

      const result = await getPlayerInfo('hikaru')
      
      expect(result).toEqual({
        username: 'hikaru',
        playerId: 15448422,
        title: 'GM',
        name: 'Hikaru Nakamura',
        country: 'US',
        location: 'Westerville, OH, USA',
        joined: 1301420643,
        lastOnline: 1640995200,
        followers: 50000,
        isStreamer: true,
        verified: true
      })
    })

    it('should return null for non-existing player', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      )

      const result = await getPlayerInfo('nonexistentplayer')
      expect(result).toBe(null)
    })

    it('should throw error on API error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Server Error', { status: 500 })
      )

      await expect(getPlayerInfo('testplayer')).rejects.toThrow('Chess.com API error')
    })
  })

  describe('getPlayerCurrentGames', () => {
    it('should return current games for player', async () => {
      const mockGamesData = {
        games: [
          {
            url: 'https://www.chess.com/game/live/12345',
            time_control: '600',
            rated: true,
            uuid: 'game-uuid-1'
          }
        ]
      }

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockGamesData), { status: 200 })
      )

      const result = await getPlayerCurrentGames('hikaru')
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        url: 'https://www.chess.com/game/live/12345',
        time_control: '600',
        rated: true,
        uuid: 'game-uuid-1'
      })
    })

    it('should return empty array when no games', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ games: [] }), { status: 200 })
      )

      const result = await getPlayerCurrentGames('hikaru')
      expect(result).toEqual([])
    })

    it('should return empty array for 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      )

      const result = await getPlayerCurrentGames('nonexistentplayer')
      expect(result).toEqual([])
    })
  })

  describe('getPlayerGameStatus', () => {
    it('should return complete game status', async () => {
      const mockPlayerData = {
        username: 'hikaru',
        player_id: 15448422,
        last_online: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
        joined: 1301420643,
        country: 'https://api.chess.com/pub/country/US'
      }

      const mockGamesData = {
        games: [
          {
            url: 'https://www.chess.com/game/live/12345',
            time_control: '600',
            rated: true,
            uuid: 'game-uuid-1'
          }
        ]
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockPlayerData), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockGamesData), { status: 200 })
        )

      const result = await getPlayerGameStatus('hikaru')
      
      expect(result).toEqual({
        username: 'hikaru',
        isOnline: true,
        isPlaying: true,
        currentGames: mockGamesData.games
      })
    })

    it('should handle offline player with no games', async () => {
      const mockPlayerData = {
        username: 'testplayer',
        player_id: 12345,
        last_online: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        joined: 1301420643,
        country: 'https://api.chess.com/pub/country/US'
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockPlayerData), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ games: [] }), { status: 200 })
        )

      const result = await getPlayerGameStatus('testplayer')
      
      expect(result).toEqual({
        username: 'testplayer',
        isOnline: false,
        isPlaying: false,
        currentGames: []
      })
    })
  })

  describe('batchGetPlayerStatuses', () => {
    it('should return statuses for multiple players', async () => {
      const players = ['hikaru', 'magnuscarlsen']
      
      // Mock responses for both players
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            username: 'hikaru',
            player_id: 15448422,
            last_online: Math.floor(Date.now() / 1000) - 60,
            joined: 1301420643,
            country: 'https://api.chess.com/pub/country/US'
          }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ games: [] }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            username: 'magnuscarlsen',
            player_id: 5448422,
            last_online: Math.floor(Date.now() / 1000) - 120,
            joined: 1301420643,
            country: 'https://api.chess.com/pub/country/NO'
          }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            games: [{ 
              url: 'https://chess.com/game/123',
              time_control: '600',
              rated: true,
              uuid: 'game-uuid-1'
            }] 
          }), { status: 200 })
        )

      const result = await batchGetPlayerStatuses(players)
      
      expect(result).toHaveLength(2)
      expect(result[0].username).toBe('hikaru')
      expect(result[1].username).toBe('magnuscarlsen')
      expect(result[1].isPlaying).toBe(true)
    })

    it('should handle individual player failures gracefully', async () => {
      const players = ['hikaru', 'nonexistent']
      
      // First player succeeds, second fails
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ 
            username: 'hikaru',
            player_id: 15448422,
            last_online: Math.floor(Date.now() / 1000) - 60,
            joined: 1301420643,
            country: 'https://api.chess.com/pub/country/US'
          }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ games: [] }), { status: 200 })
        )
        .mockRejectedValueOnce(new Error('Player not found'))

      const result = await batchGetPlayerStatuses(players)
      
      expect(result).toHaveLength(2)
      expect(result[0].username).toBe('hikaru')
      expect(result[1].username).toBe('nonexistent')
      expect(result[1].isOnline).toBe(false)
      expect(result[1].isPlaying).toBe(false)
    })
  })
})