# Cine-Tac-Toe

A fun movie-themed tic-tac-toe game where you have to name movies in specific categories to make your move.

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- A Supabase account and project

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/cine-tac-toe.git
   cd cine-tac-toe
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### Database Setup

1. Set up the database schema and initial data:
   ```bash
   npm run setup-db
   ```

   This script will:
   - Create all necessary tables
   - Set up relationships between tables
   - Configure Row Level Security policies
   - Add sample data for badges and store items
   - Create functions for user management and game mechanics

2. Verify your environment:
   ```bash
   npm run check-env
   ```

### Running the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **User Authentication**: Sign up, sign in, and profile management
- **Game Mechanics**: Play Cine-Tac-Toe against other players
- **Movie Knowledge**: Test your knowledge of movies across various categories
- **Leveling System**: Gain XP and level up as you play
- **Achievements**: Earn badges for accomplishments
- **Store**: Purchase items to customize your profile

## Database Schema

The application uses the following tables:
- `users`: User profiles with game statistics
- `games`: Game records
- `game_moves`: Individual moves made in games
- `badges`: Achievement badges
- `user_badges`: Junction table for users and their badges
- `store_items`: Items available in the store
- `clubs`: Movie clubs that users can join
- `