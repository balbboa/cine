'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/db' // Import Database type from lib/db re-export

// Define a type for the game row, adjust based on actual schema if needed
type Game = Database['public']['Tables']['games']['Row'] // FIXME: Commented out due to missing types - Uncommented - Ensured Database type is available
// type Game = any // Using any as a fallback - Removed

export default function GamesDebugPage() {
  // Use the defined type for state
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [columns, setColumns] = useState<string[]>([])

  // Instantiate the client-side Supabase client
  const supabase = createClient()

  useEffect(() => {
    loadGames()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Assuming supabase client instance is stable or dependency array needs adjustment

  const loadGames = async () => {
    try {
      setLoading(true)
      setError(null)

      // Run diagnostics (assuming this function is still needed and valid)
      // await diagnoseGameSchema() // Removed call to non-existent function

      // Get all games using the instantiated client
      const { data, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (fetchError) {
        throw fetchError
      }

      if (data && data.length > 0) {
        setGames(data)
        // Dynamically get columns from the first game object
        setColumns(Object.keys(data[0])) 
      } else {
        setGames([])
        setColumns([]) // Clear columns if no data
        setError('No games found')
      }
    } catch (err: unknown) { // Use 'unknown' instead of 'Error'
      console.error('Error loading games:', err)
      setError(err instanceof Error ? err.message : 'Failed to load games')
    } finally {
      setLoading(false)
    }
  }

  const createTestGame = async () => {
    try {
      setLoading(true)
      setError(null)

      // Create a test game invite code
      const inviteCode = Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 36).toString(36)
      ).join('').toUpperCase()

      // Create a test game using the instantiated client
      const { data, error: insertError } = await supabase
        .from('games')
        .insert({
          player1_id: '00000000-0000-0000-0000-000000000000', // Placeholder user ID
          game_mode: 'test',
          invite_code: inviteCode,
          status: 'waiting',
          // Add other necessary fields based on schema, potentially null or default values
          // Example: player2_id: null, game_state: null, winner_id: null, current_turn_id: null
        })
        .select()
        .single() // Assuming insert returns the created row

      if (insertError) {
        throw insertError
      }

      console.log('Test game created:', data)

      // Reload games after creation
      await loadGames() // await the reload
    } catch (err: unknown) { // Use 'unknown' instead of 'Error'
      console.error('Error creating test game:', err)
      setError(err instanceof Error ? err.message : 'Failed to create test game')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Games Debugging</h1>

      <div className="space-y-4 mb-6">
        <Button onClick={loadGames} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Games'}
        </Button>

        <Button onClick={createTestGame} disabled={loading} className="ml-4">
          Create Test Game
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100"> {/* Added background for header */}
              {columns.map(column => (
                <th key={column} className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700 uppercase tracking-wider"> {/* Improved header styling */}
                  {column.replace(/_/g, ' ')} {/* Replace underscores for readability */}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {games.length > 0 ? (
              games.map((game) => (
                // Use game ID as key if available and unique, otherwise index is fallback
                <tr key={game.id || game.invite_code} className="hover:bg-gray-50"> 
                  {columns.map(column => (
                    <td key={`${game.id}-${column}`} className="border border-gray-300 px-4 py-2 text-sm text-gray-800 align-top"> {/* Improved cell styling */}
                      {/* Handle different data types more gracefully */}
                      {/* FIXME: Type assertion commented out due to missing types - Removed comment */}
                      {typeof game[column as keyof Game] === 'object' && game[column as keyof Game] !== null
                        ? <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(game[column as keyof Game], null, 2)}</pre>
                        : String(game[column as keyof Game] ?? 'N/A')} {/* Use N/A for null/undefined - Uncommented type assertion */}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length || 1} className="text-center py-4 text-gray-500">
                  {loading ? 'Loading...' : 'No games to display'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Redundant "No games found" message removed as it's handled in the table body */}
    </div>
  )
} 