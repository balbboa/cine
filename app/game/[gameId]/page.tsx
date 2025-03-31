'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
// import LocalTicTacToe from '@/components/local-tictactoe'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'
// import { getGameById } from '@/lib/db' // Function does not exist here
import { createClient } from '@/lib/supabase/client' // Import Supabase client
import type { Game } from '@/lib/db' // Import Game type
import TicTacToeGame from '@/components/tic-tac-toe-game' // Import TicTacToeGame

// Define GameWithDisplayNames locally
interface GameWithDisplayNames extends Game {
  player1_display_name: string | null;
  player2_display_name: string | null;
}

type GamePageProps = {
  params: {
    gameId: string
  }
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = params
  const { user /*, isLoading: _authLoading, isGuest */ } = useAuth() // Remove unused variables
  const [isLoading, setIsLoading] = useState(true)
  const [pageTitle, setPageTitle] = useState('Cine-Tac-Toe Game')
  const [error, setError] = useState<string | null>(null)
  const [gameData, setGameData] = useState<Game | null>(null) // State to hold game data
  
  useEffect(() => {
    const initGame = async () => {
      setIsLoading(true)
      setError(null)
      setGameData(null)
      setPageTitle('Cine-Tac-Toe Game')

      // No need to auto-create guest here, game fetch determines players
      if (!gameId || gameId === 'local') {
          // Handle local game scenario if needed, or show error
          if(gameId === 'local'){
              setPageTitle('Local Cine-Tac-Toe Game');
              // Potentially set dummy game data for local mode
          } else {
              setError("Invalid game ID.");
          }
          setIsLoading(false);
          return;
      }

      try {
        console.log(`Fetching game data for ID: ${gameId}`);
        // const fetchedGame = await getGameById(gameId); // Original call

        // Fetch game directly using Supabase client
        const supabase = createClient();
        const { data: fetchedGame, error: fetchError } = await supabase
          .from('games')
          .select('*') // Select all columns, or specify needed ones
          .eq('id', gameId)
          .single();

        if (fetchError) throw fetchError; // Throw if fetch fails

        if (!fetchedGame) {
          setError("Game not found or you don't have access.");
        } else {
          console.log("Fetched game data:", fetchedGame);
          setGameData(fetchedGame);
          // Set title based on fetched data (e.g., using player names)
          // Use local interface for type assertion
          const p1Name = (fetchedGame as GameWithDisplayNames).player1_display_name || 'Player 1'; 
          const p2Name = (fetchedGame as GameWithDisplayNames).player2_display_name || 'Player 2'; 
          setPageTitle(`${p1Name} vs ${p2Name}`);
        }

      } catch (err) {
        console.error('Error initializing game:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load game data. Please try again.'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }
    
    initGame()
    // Removed dependency on user/autoCreateGuestUser, depends only on gameId
  }, [gameId]) 
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-black">
        <div className="text-2xl text-white animate-pulse">Loading game...</div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-black p-4">
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-6 max-w-md text-center shadow-lg">
          <h2 className="text-xl font-bold text-red-300 mb-2">Error Initializing Game</h2>
          <p className="text-red-200 mb-4">{error}</p>
          <Link href="/">
            <Button variant="outline" className="mt-4 bg-transparent text-white hover:bg-white/10 border-white/50 hover:border-white">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }
  
  return (
    <>
      <header className="max-w-xl mx-auto px-4 pt-4 sm:pt-6 mb-4 flex justify-between items-center">
        <Link href="/">
          <Button variant="outline" size="sm" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border-white/30">
            <Home size={16} />
            <span>Back to Game Hub</span>
          </Button>
        </Link>
      </header>
      <main className="min-h-screen bg-gradient-to-b from-blue-900 to-black pt-2 sm:pt-4">
        <h1 className="text-3xl font-bold text-center text-white mb-6">{pageTitle}</h1>
        
        {/* Conditionally render game component */} 
        {gameData && user ? (
          <TicTacToeGame // Use the imported component
            game={gameData}
            currentUser={user}
          /> 
        ) : gameId === 'local' ? (
          // <LocalTicTacToe gameId={gameId} user={user} /> // Uncomment if you have a local version
          <div className="text-center text-yellow-400">Local Game Placeholder</div>
        ) : (
          // Show placeholder or specific message if game data couldn't load but no error was thrown
          !isLoading && !error && <div className="text-center text-gray-400">Waiting for game data...</div>
        )}
        
      </main>
    </>
  )
} 