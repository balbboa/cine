'use client'

import Link from 'next/link'
import JoinGame from '@/components/join-game'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

export default function JoinPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-black p-4">
      <div className="max-w-xl w-full mx-auto flex flex-col items-center">
        <Link href="/" className="self-start mb-6">
          <Button variant="outline" size="sm" className="flex items-center gap-2 text-white border-white/30 hover:bg-white/10">
            <Home size={16} />
            <span>Back to Home</span>
          </Button>
        </Link>
        
        <h1 className="text-4xl font-bold text-white mb-8 text-center">Join a Cine-Tac-Toe Game</h1>
        
        <JoinGame />
        
        <div className="mt-8 text-center">
          <p className="text-gray-300">
            Want to create your own game?{' '}
            <Link href="/game-hub" className="text-blue-400 hover:text-blue-300">
              Visit the Game Hub
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
} 