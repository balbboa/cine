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
  const { user, isGuest } = useAuth() // Add isGuest from auth context
  const [isLoading, setIsLoading] = useState(true)
  const [pageTitle, setPageTitle] = useState('Cine-Tac-Toe Game')
  const [error, setError] = useState<string | null>(null)
  const [gameData, setGameData] = useState<Game | null>(null) // State to hold game data
  
  // Ensure guest cookie persists - synchronize on component mount
  useEffect(() => {
    if (isGuest && user?.id) {
      // Set the cookie with a 7-day expiry
      document.cookie = `guest-user-token=${user.id}; path=/; max-age=604800; SameSite=Lax`;
      console.log("Guest cookie synchronized in game page");
    }
  }, [isGuest, user]);
  
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
        // Fetch game directly using Supabase client with expanded player data
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
          
          // Check if current user is a participant (including guest IDs)
          if (user) {
            const isPlayer1 = fetchedGame.player1_id === user.id || 
                              fetchedGame.player1_guest_id === user.id;
            const isPlayer2 = fetchedGame.player2_id === user.id || 
                              fetchedGame.player2_guest_id === user.id;
                              
            console.log(`User participation check: isPlayer1=${isPlayer1}, isPlayer2=${isPlayer2}`);
            console.log(`User ID: ${user.id}, isGuest: ${isGuest}`);
            console.log(`Game player1_id: ${fetchedGame.player1_id}, player1_guest_id: ${fetchedGame.player1_guest_id}`);
            console.log(`Game player2_id: ${fetchedGame.player2_id}, player2_guest_id: ${fetchedGame.player2_guest_id}`);
            
            if (!isPlayer1 && !isPlayer2 && fetchedGame.status !== 'completed') {
              // Allow spectators for completed games, but restrict access to ongoing games
              console.log("User is not a participant in this game");
              // Just a warning for now - allow spectators, but log the access
            }
          } else {
            console.log("No user found, continuing as spectator");
          }
          
          setGameData(fetchedGame);
          // Set title based on fetched data (e.g., using player names)
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
    // Add dependency on user and isGuest to re-run when auth state changes
  }, [gameId, user, isGuest]) 
  
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
          <TicTacToeGame
            game={gameData}
            currentUser={user}
          /> 
        ) : gameId === 'local' ? (
          <div className="text-center text-yellow-400">Local Game Placeholder</div>
        ) : (
          // Show placeholder or specific message if game data couldn't load but no error was thrown
          !isLoading && !error && <div className="text-center text-gray-400">Waiting for game data...</div>
        )}
        
      </main>
    </>
  )
} 