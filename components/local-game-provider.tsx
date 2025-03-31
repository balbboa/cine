"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Types for the game state
type Player = 1 | 2;
type CellValue = { player: Player; movie: string } | null;
type GameBoard = CellValue[][];
type GameStatus = "playing" | "draw" | "won" | "waiting";

// Context interface
interface LocalGameContextType {
  // Game state
  board: GameBoard;
  currentPlayer: Player;
  gameStatus: GameStatus;
  winner: Player | null;
  selectedCell: [number, number] | null;
  
  // Game actions
  handleCellClick: (row: number, col: number) => void;
  makeMove: (row: number, col: number, movie: string) => void;
  resetGame: () => void;
  
  // Game settings
  gameStarted: boolean;
  startGame: () => void;
}

// Initial state for the game context
const initialGameContext: LocalGameContextType = {
  board: Array(3).fill(null).map(() => Array(3).fill(null)),
  currentPlayer: 1,
  gameStatus: "waiting",
  winner: null,
  selectedCell: null,
  
  handleCellClick: () => {},
  makeMove: () => {},
  resetGame: () => {},
  
  gameStarted: false,
  startGame: () => {},
};

// Create the context
const LocalGameContext = createContext<LocalGameContextType>(initialGameContext);

// Custom hook for accessing the context
export const useLocalGame = () => {
  const context = useContext(LocalGameContext);
  if (!context) {
    throw new Error("useLocalGame must be used within a LocalGameProvider");
  }
  return context;
};

// Check if the game is won
const checkWinner = (board: GameBoard): Player | null => {
  // Check rows
  for (let i = 0; i < 3; i++) {
    if (
      board[i][0] &&
      board[i][1] &&
      board[i][2] &&
      board[i][0]?.player === board[i][1]?.player &&
      board[i][1]?.player === board[i][2]?.player
    ) {
      return board[i][0]?.player || null;
    }
  }

  // Check columns
  for (let i = 0; i < 3; i++) {
    if (
      board[0][i] &&
      board[1][i] &&
      board[2][i] &&
      board[0][i]?.player === board[1][i]?.player &&
      board[1][i]?.player === board[2][i]?.player
    ) {
      return board[0][i]?.player || null;
    }
  }

  // Check diagonals
  if (
    board[0][0] &&
    board[1][1] &&
    board[2][2] &&
    board[0][0]?.player === board[1][1]?.player &&
    board[1][1]?.player === board[2][2]?.player
  ) {
    return board[0][0]?.player || null;
  }

  if (
    board[0][2] &&
    board[1][1] &&
    board[2][0] &&
    board[0][2]?.player === board[1][1]?.player &&
    board[1][1]?.player === board[2][0]?.player
  ) {
    return board[0][2]?.player || null;
  }

  return null;
};

// Check if the board is full (draw)
const isBoardFull = (board: GameBoard): boolean => {
  return board.every(row => row.every(cell => cell !== null));
};

// Props for the provider component
interface LocalGameProviderProps {
  children: ReactNode;
}

// Provider component
export function LocalGameProvider({ children }: LocalGameProviderProps) {
  // Game state
  const [board, setBoard] = useState<GameBoard>(initialGameContext.board);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(initialGameContext.currentPlayer);
  const [gameStatus, setGameStatus] = useState<GameStatus>(initialGameContext.gameStatus);
  const [winner, setWinner] = useState<Player | null>(initialGameContext.winner);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(initialGameContext.selectedCell);
  const [gameStarted, setGameStarted] = useState<boolean>(initialGameContext.gameStarted);

  // Reset the game
  const resetGame = () => {
    setBoard(Array(3).fill(null).map(() => Array(3).fill(null)));
    setCurrentPlayer(1);
    setGameStatus("waiting");
    setWinner(null);
    setSelectedCell(null);
    setGameStarted(false);
  };

  // Start the game
  const startGame = () => {
    resetGame();
    setGameStatus("playing");
    setGameStarted(true);
  };

  // Handle a cell click
  const handleCellClick = (row: number, col: number) => {
    if (!gameStarted) return;
    if (gameStatus !== "playing") return;
    if (board[row][col] !== null) return;

    setSelectedCell([row, col]);
  };

  // Make a move on the board
  const makeMove = (row: number, col: number, movie: string) => {
    if (!gameStarted) return;
    if (gameStatus !== "playing") return;
    if (board[row][col] !== null) return;

    // Update the board with the player's move
    const newBoard = [...board];
    newBoard[row][col] = { player: currentPlayer, movie };
    setBoard(newBoard);
    setSelectedCell(null);

    // Check for game end conditions
    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      setGameStatus("won");
      return;
    }

    if (isBoardFull(newBoard)) {
      setGameStatus("draw");
      return;
    }

    // Switch to the next player
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
  };

  // Effect to update game status when the board changes
  useEffect(() => {
    if (!gameStarted) return;

    const gameWinner = checkWinner(board);
    
    if (gameWinner) {
      setWinner(gameWinner);
      setGameStatus("won");
    } else if (isBoardFull(board)) {
      setGameStatus("draw");
    }
  }, [board, gameStarted]);

  // Context value that will be provided
  const contextValue: LocalGameContextType = {
    board,
    currentPlayer,
    gameStatus,
    winner,
    selectedCell,
    handleCellClick,
    makeMove,
    resetGame,
    gameStarted,
    startGame,
  };

  return (
    <LocalGameContext.Provider value={contextValue}>
      {children}
    </LocalGameContext.Provider>
  );
}

export default LocalGameProvider;

