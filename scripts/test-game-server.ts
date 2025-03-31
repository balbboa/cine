import { WebSocket, WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

interface GameState {
  gameId: string
  players: Map<string, WebSocket>
  currentTurn: string
  board: string[]
}

const activeGames = new Map<string, GameState>()

wss.on('connection', async (ws) => {
  console.log('New client connected')

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message)
      
      switch (data.type) {
        case 'JOIN_GAME':
          await handleJoinGame(ws, data)
          break
        case 'MAKE_MOVE':
          await handleMakeMove(ws, data)
          break
        case 'LEAVE_GAME':
          handleLeaveGame(ws, data)
          break
      }
    } catch (error) {
      console.error('Error handling message:', error)
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }))
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected')
    // Clean up any games this client was in
    for (const [gameId, game] of activeGames.entries()) {
      const playerId = Array.from(game.players.entries()).find(([_, ws]) => ws === ws)?.[0]
      if (playerId) {
        game.players.delete(playerId)
        if (game.players.size === 0) {
          activeGames.delete(gameId)
        }
        break
      }
    }
  })
})

async function handleJoinGame(ws: WebSocket, data: any) {
  const { gameId, playerId } = data
  
  let game = activeGames.get(gameId)
  if (!game) {
    // Create new game
    game = {
      gameId,
      players: new Map(),
      currentTurn: playerId,
      board: Array(9).fill('')
    }
    activeGames.set(gameId, game)
  }

  game.players.set(playerId, ws)
  
  // Notify all players
  const players = Array.from(game.players.keys())
  broadcastToGame(gameId, {
    type: 'GAME_UPDATE',
    players,
    currentTurn: game.currentTurn,
    board: game.board
  })

  // If we have two players, start the game
  if (game.players.size === 2) {
    broadcastToGame(gameId, {
      type: 'GAME_START',
      message: 'Game is starting!'
    })
  }
}

async function handleMakeMove(ws: WebSocket, data: any) {
  const { gameId, playerId, position } = data
  const game = activeGames.get(gameId)
  
  if (!game) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not found' }))
    return
  }

  if (game.currentTurn !== playerId) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Not your turn' }))
    return
  }

  // Update the board
  game.board[position] = playerId === game.players.keys().next().value ? 'X' : 'O'
  
  // Check for winner
  const winner = checkWinner(game.board)
  if (winner) {
    broadcastToGame(gameId, {
      type: 'GAME_END',
      winner: playerId,
      board: game.board
    })
    return
  }

  // Switch turns
  const players = Array.from(game.players.keys())
  const currentIndex = players.indexOf(playerId)
  game.currentTurn = players[(currentIndex + 1) % 2]

  // Broadcast the move
  broadcastToGame(gameId, {
    type: 'MOVE_MADE',
    playerId,
    position,
    currentTurn: game.currentTurn,
    board: game.board
  })
}

function handleLeaveGame(ws: WebSocket, data: any) {
  const { gameId, playerId } = data
  const game = activeGames.get(gameId)
  
  if (game) {
    game.players.delete(playerId)
    if (game.players.size === 0) {
      activeGames.delete(gameId)
    } else {
      // Notify remaining player
      broadcastToGame(gameId, {
        type: 'PLAYER_LEFT',
        message: 'Opponent has left the game'
      })
    }
  }
}

function broadcastToGame(gameId: string, message: any) {
  const game = activeGames.get(gameId)
  if (game) {
    const messageStr = JSON.stringify(message)
    game.players.forEach(player => {
      if (player.readyState === WebSocket.OPEN) {
        player.send(messageStr)
      }
    })
  }
}

function checkWinner(board: string[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ]

  for (const line of lines) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }

  return null
}

console.log('Test game server running on ws://localhost:8080') 