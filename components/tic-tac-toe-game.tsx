'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Game } from '@/lib/db';
import type { ContextUser } from '@/lib/auth'; // Import the user type from auth context

// Define GameWithDisplayNames locally to handle potentially missing fields
interface GameWithDisplayNames extends Game {
  player1_display_name: string | null;
  player2_display_name: string | null;
}

interface TicTacToeGameProps {
  game: Game;
  currentUser: ContextUser; // Use the context user type
  initialBoard?: (string | null)[]
  currentPlayer?: 'X' | 'O'
  isPlayerX?: boolean
  onMove?: (index: number) => void
  disableBoard?: boolean
  highlightWin?: number[]
}

// Placeholder Game Component
export default function TicTacToeGame({
  game,
  currentUser,
  initialBoard,
  currentPlayer = 'X',
  isPlayerX = true,
  onMove,
  disableBoard = false,
  highlightWin = [],
}: TicTacToeGameProps) {
  const [board, setBoard] = useState<(string | null)[]>(initialBoard || Array(9).fill(null))

  // Determine player roles based on currentUser ID vs game player IDs
  // Check both regular player IDs and guest player IDs to properly identify the player's role
  const isPlayer1 = (
    currentUser.id === game.player1_id || 
    (currentUser.isGuest && currentUser.id === game.player1_guest_id)
  );

  const isPlayer2 = (
    currentUser.id === game.player2_id || 
    (currentUser.isGuest && currentUser.id === game.player2_guest_id)
  );

  // Add debug logs to help troubleshoot player identification
  console.log("[TicTacToeGame] Player identification:", {
    currentUserId: currentUser.id,
    isGuest: currentUser.isGuest,
    player1Id: game.player1_id,
    player1GuestId: game.player1_guest_id,
    player2Id: game.player2_id,
    player2GuestId: game.player2_guest_id,
    isPlayer1,
    isPlayer2
  });

  // Use local interface for type assertion
  const player1Name = (game as GameWithDisplayNames).player1_display_name || 'Player 1';
  const player2Name = (game as GameWithDisplayNames).player2_display_name || 'Player 2';

  const handleClick = (index: number) => {
    if (disableBoard || board[index] !== null) return

    const newBoard = [...board]
    newBoard[index] = isPlayerX ? 'X' : 'O'
    setBoard(newBoard)
    
    if (onMove) {
      onMove(index)
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 bg-card/50 rounded-lg text-foreground border border-border">
      <h2 className="text-xl font-semibold mb-4 text-center">{player1Name} vs {player2Name}</h2>
      <p className="text-sm text-center mb-2">Game ID: {game.id}</p>
      <p className="text-sm text-center mb-2">Status: {game.status}</p>
      <p className="text-sm text-center mb-4">You are: {isPlayer1 ? player1Name : isPlayer2 ? player2Name : 'Spectator'}</p>
      
      <div className="flex justify-center items-center mb-4">
        <div className="text-lg font-bold">Current Player: {currentPlayer}</div>
      </div>

      <div className="aspect-square bg-muted grid grid-cols-3 grid-rows-3 gap-2 p-2 rounded mb-4">
        {board.map((cell, index) => (
          <Button
            key={index}
            onClick={() => handleClick(index)}
            variant="outline"
            className={cn(
              "h-full aspect-square flex items-center justify-center text-3xl font-bold p-0 hover:bg-muted/80 border-border",
              {
                "bg-accent": highlightWin.includes(index),
                "hover:bg-accent": highlightWin.includes(index),
                "cursor-default": cell !== null || disableBoard,
                "cursor-pointer": cell === null && !disableBoard,
              }
            )}
            disabled={cell !== null || disableBoard}
          >
            {cell === 'X' && <X className="h-8 w-8 text-primary" strokeWidth={3} />}
            {cell === 'O' && <Check className="h-8 w-8 text-secondary" strokeWidth={3} />}
          </Button>
        ))}
      </div>

      <p className="text-xs text-center text-gray-400">Game logic placeholder. Implement board state, turns, move validation, etc.</p>
    </div>
  );
} 