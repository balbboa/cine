import React, { useState, useEffect, useCallback } from 'react';
import { useChannel } from '../hooks/useChannel';

interface PlayerInfo {
  id: string;
  name: string;
  avatar?: string;
}

interface PokestyleTicTacToeProps {
  gameId: string;
  playerId: string;
  playerName: string;
  playerAvatar?: string;
}

interface GameData {
  rowCategories?: string[];
  colCategories?: string[];
  rowSelections?: boolean[];
  colSelections?: boolean[];
  board?: string[][];
  currentPlayer?: string;
  winner?: string | null;
  gameStatus?: string;
  timeLeft?: number;
  timerActive?: boolean;
}

const PokestyleTicTacToe: React.FC<PokestyleTicTacToeProps> = ({ gameId, playerId, playerName, playerAvatar }) => {
  // Game state
  const [rowCategories, setRowCategories] = useState<string[]>([]);
  const [colCategories, setColCategories] = useState<string[]>([]);
  const [rowSelections, setRowSelections] = useState<boolean[]>([false, false, false]);
  const [colSelections, setColSelections] = useState<boolean[]>([false, false, false]);
  const [board, setBoard] = useState<string[][]>(Array(3).fill(null).map(() => Array(3).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState<string>('');
  const [winner, setWinner] = useState<string | null>(null);
  
  // Game status
  const [gameStatus, setGameStatus] = useState<string>('waiting');
  
  // Timer state
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  
  // Heartbeat interval
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Channel for real-time communication
  const { channel } = useChannel(`game:${gameId}`);
  
  // Handle game timeout
  const handleTimeUp = useCallback(() => {
    if (channel) {
      channel.push('time_up', { player_id: playerId });
    }
  }, [channel, playerId]);
  
  // Join the game
  const joinGame = useCallback(() => {
    if (channel) {
      channel.push('join_game', { 
        player_id: playerId, 
        player_name: playerName,
        player_avatar: playerAvatar 
      });
    }
  }, [channel, playerId, playerName, playerAvatar]);
  
  // Leave the game
  const leaveGame = useCallback(() => {
    if (channel) {
      channel.push('leave_game', { player_id: playerId });
    }
  }, [channel, playerId]);
  
  // Send heartbeat to keep connection alive
  const sendHeartbeat = useCallback(() => {
    if (channel) {
      channel.push('heartbeat', { player_id: playerId });
    }
  }, [channel, playerId]);
  
  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (timerActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && currentPlayer === playerId) {
      // Time's up for current player
      handleTimeUp();
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timerActive, timeLeft, currentPlayer, playerId, handleTimeUp]);
  
  // Component mount effect
  useEffect(() => {
    // Join the game
    joinGame();
    
    // Set up heartbeat interval
    const interval = setInterval(() => {
      sendHeartbeat();
    }, 30000);
    
    setHeartbeatInterval(interval);
    
    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      leaveGame();
    };
  }, [heartbeatInterval, joinGame, leaveGame, sendHeartbeat]);
  
  // Game update handler
  const handleGameUpdate = useCallback((gameData: GameData) => {
    if (gameData.rowCategories) {
      setRowCategories(gameData.rowCategories);
    }

    if (gameData.colCategories) {
      setColCategories(gameData.colCategories);
    }

    if (gameData.rowSelections) {
      setRowSelections(gameData.rowSelections);
    }

    if (gameData.colSelections) {
      setColSelections(gameData.colSelections);
    }

    if (gameData.board) {
      setBoard(gameData.board);
    }

    if (gameData.currentPlayer) {
      setCurrentPlayer(gameData.currentPlayer);
      setTimerActive(gameData.currentPlayer === playerId);
    }

    if (gameData.winner !== undefined) {
      setWinner(gameData.winner);
    }

    if (gameData.gameStatus) {
      setGameStatus(gameData.gameStatus);
    }

    if (gameData.timeLeft !== undefined) {
      setTimeLeft(gameData.timeLeft);
    }

    if (gameData.timerActive !== undefined) {
      setTimerActive(gameData.timerActive);
    }
  }, [playerId]);
  
  const handlePlayerJoined = useCallback((data: { player: PlayerInfo }) => {
    if (data.player.id !== playerId) {
      // Removed setWaitingForOpponent
    }
  }, [playerId]);
  
  const handlePlayerLeft = useCallback((data: { player_id: string }) => {
    if (data.player_id !== playerId) {
      // Removed setWaitingForOpponent
      setGameStatus('waiting');
    }
  }, [playerId]);
  
  const handleGameStart = useCallback((data: GameData) => {
    handleGameUpdate(data);
    setGameStatus('playing');
    setTimerActive(data.currentPlayer === playerId);
  }, [handleGameUpdate, playerId]);
  
  const handleGameEnd = useCallback((data: { winner: string | null }) => {
    setWinner(data.winner);
    setGameStatus('ended');
    setTimerActive(false);
  }, []);
  
  // Channel message effect
  useEffect(() => {
    if (channel) {
      channel.on('game_update', handleGameUpdate);
      channel.on('player_joined', handlePlayerJoined);
      channel.on('player_left', handlePlayerLeft);
      channel.on('game_start', handleGameStart);
      channel.on('game_end', handleGameEnd);
    }
    
    return () => {
      if (channel) {
        channel.off('game_update');
        channel.off('player_joined');
        channel.off('player_left');
        channel.off('game_start');
        channel.off('game_end');
      }
    };
  }, [channel, handleGameUpdate, handlePlayerJoined, handlePlayerLeft, handleGameStart, handleGameEnd]);
  
  const makeMove = (row: number, col: number) => {
    if (
      gameStatus === 'playing' &&
      currentPlayer === playerId &&
      !board[row][col] &&
      timerActive
    ) {
      if (channel) {
        channel.push('make_move', { player_id: playerId, row, col });
      }
    }
  };
  
  const selectCategory = (type: 'row' | 'col', index: number) => {
    if (gameStatus === 'category_selection' && currentPlayer === playerId) {
      if (channel) {
        channel.push('select_category', { player_id: playerId, type, index });
      }
    }
  };
  
  const renderBoard = () => {
    return (
      <div className="game-board">
        <div className="categories-container">
          <div className="row-categories">
            {rowCategories.map((category, index) => (
              <div 
                key={`row-${index}`} 
                className={`category ${rowSelections[index] ? 'selected' : ''}`}
                onClick={() => selectCategory('row', index)}
              >
                {category}
              </div>
            ))}
          </div>
          <div className="col-categories">
            {colCategories.map((category, index) => (
              <div 
                key={`col-${index}`} 
                className={`category ${colSelections[index] ? 'selected' : ''}`}
                onClick={() => selectCategory('col', index)}
              >
                {category}
              </div>
            ))}
          </div>
        </div>
        <div className="board-grid">
          {board.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="board-row">
              {row.map((cell, colIndex) => (
                <div 
                  key={`cell-${rowIndex}-${colIndex}`} 
                  className={`board-cell ${cell ? 'filled' : ''}`}
                  onClick={() => makeMove(rowIndex, colIndex)}
                >
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const renderGameStatus = () => {
    if (gameStatus === 'waiting') {
      return <div className="game-status waiting">Waiting for opponent...</div>;
    } else if (gameStatus === 'playing') {
      return (
        <div className={`game-status ${currentPlayer === playerId ? 'your-turn' : 'opponents-turn'}`}>
          {currentPlayer === playerId ? 'Your turn' : "Opponent's turn"} | Time Left: {timeLeft}s
        </div>
      );
    } else if (gameStatus === 'ended') {
      return (
        <div className="game-status ended">
          {winner === playerId ? 'You win!' : winner ? "Opponent wins!" : "It's a draw!"}
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="pokestyle-tictactoe">
      <h2>Pokémon-style Tic Tac Toe</h2>
      {renderGameStatus()}
      {gameStatus !== 'waiting' && renderBoard()}
    </div>
  );
};

export default PokestyleTicTacToe;
