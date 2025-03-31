import { randomUUID } from 'crypto'
import { createClient } from '@/lib/db'

const supabase = createClient()

async function createTestPlayers() {
const playerData1 = {
    id: randomUUID(),
    username: `TestPlayer1_${Date.now()}`,
    email: `test1_${Date.now()}@example.com`,
    avatar_url: '/avatars/default.png',
    level: 1,
    xp: 0,
    credits: 1000
}

const { data: player1, error: error1 } = await supabase
    .from('users')
    .insert(playerData1)
    .select()
    .single()
    
if (error1) throw new Error(`Error creating player 1: ${error1.message}`)

const playerData2 = {
id: randomUUID(),
username: `TestPlayer2_${Date.now()}`,
email: `test2_${Date.now()}@example.com`,
avatar_url: '/avatars/default.png',
level: 1,
xp: 0,
credits: 1000
}

const { data: player2, error: error2 } = await supabase
.from('users')
.insert(playerData2)
.select()
.single()

if (error2) throw new Error(`Error creating player 2: ${error2.message}`)

  return { player1, player2 }
}

async function createTestGame(player1Id: string, player2Id: string) {
const gameData = {
    id: randomUUID(),
    player1_id: player1Id,
    player2_id: player2Id,
    game_mode: 'quick',
    invite_code: randomUUID().slice(0, 8)
}

const { data: game, error } = await supabase
    .from('games')
    .insert(gameData)
    .select()
    .single()
    
if (error) throw new Error(`Error creating game: ${error.message}`)

  return game
}

async function simulateGameMoves(gameId: string, player1Id: string, player2Id: string) {
  const moves = [
    { user_id: player1Id, row: 0, col: 0, movie: 'Movie 1', time_to_answer: 5 },
    { user_id: player2Id, row: 1, col: 1, movie: 'Movie 2', time_to_answer: 4 },
    { user_id: player1Id, row: 2, col: 2, movie: 'Movie 3', time_to_answer: 3 },
    { user_id: player2Id, row: 0, col: 2, movie: 'Movie 4', time_to_answer: 6 },
    { user_id: player1Id, row: 1, col: 0, movie: 'Movie 5', time_to_answer: 2 },
    { user_id: player2Id, row: 2, col: 0, movie: 'Movie 6', time_to_answer: 4 },
    { user_id: player1Id, row: 0, col: 1, movie: 'Movie 7', time_to_answer: 3 }
  ]

for (const move of moves) {
const moveData = {
    game_id: gameId,
    ...move
}

const { error } = await supabase
    .from('game_moves')
    .insert(moveData)
    
if (error) throw new Error(`Error creating move: ${error.message}`)
}

const { error: updateError } = await supabase
.from('games')
.update({
    winner_id: player1Id,
    completed_at: new Date().toISOString()
})
.eq('id', gameId)

if (updateError) throw new Error(`Error updating game: ${updateError.message}`)
}

async function main() {
  try {
    console.log('Creating test players...')
    const { player1, player2 } = await createTestPlayers()
    console.log('Test players created:', { player1: player1.username, player2: player2.username })

    console.log('Creating test game...')
    const game = await createTestGame(player1.id, player2.id)
    console.log('Test game created:', game.id)

    console.log('Simulating game moves...')
    await simulateGameMoves(game.id, player1.id, player2.id)
    console.log('Game moves simulated')

    // Get the game data
    const { data: finalGame, error: gameError } = await supabase
    .from('games')
    .select(`
        *,
        game_moves(*),
        player1:users!games_player1_id_fkey(*),
        player2:users!games_player2_id_fkey(*),
        winner:users!games_winner_id_fkey(*)
    `)
    .eq('id', game.id)
    .single()
    
    if (gameError) throw new Error(`Error fetching game data: ${gameError.message}`)

    console.log('Final game state:', {
    winner: finalGame?.winner?.username,
    totalMoves: finalGame?.game_moves.length
    })

  } catch (error) {
    console.error('Error during test:', error)
}
}

main() 