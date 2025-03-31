"use client"

import { useState, useEffect } from "react"
import { Copy, Check, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import type { User } from "@/lib/db"

interface WaitingRoomProps {
  inviteCode: string
  onCancel: () => void
  user: User | null
  playerInfo: {
    player1: { username: string; avatar: string } | null
    player2: { username: string; avatar: string } | null
  }
}

export default function WaitingRoom({ inviteCode, onCancel, user, playerInfo }: WaitingRoomProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [waitingTime, setWaitingTime] = useState(0)

  // Track waiting time
  useEffect(() => {
    const interval = setInterval(() => {
      setWaitingTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Format waiting time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  // Copy invite code to clipboard
  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)

    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard",
    })

    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl font-bold text-white dark:text-gray-200">Waiting for Opponent</h2>

      <div className="flex justify-center">
        <div className="bg-white/20 dark:bg-gray-800/30 p-6 rounded-xl border border-white/20 dark:border-gray-700/30 max-w-md w-full">
          <div className="flex flex-col items-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarImage
                src={
                  playerInfo.player1?.avatar ||
                  user?.avatar_url ||
                  `/placeholder.svg?height=80&width=80&text=${(user?.username || "P1").substring(0, 2)}`
                }
                alt={playerInfo.player1?.username || user?.username || "Player 1"}
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 text-white text-xl">
                {(playerInfo.player1?.username || user?.username || "P1").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <h3 className="text-lg font-semibold text-white dark:text-gray-200">
              {playerInfo.player1?.username || user?.username || "Player 1"}
            </h3>

            <div className="flex items-center mt-2 text-white/60 dark:text-gray-400/60 text-sm">
              <Clock className="h-4 w-4 mr-1" />
              <span>Waiting for {formatTime(waitingTime)}</span>
            </div>
          </div>

          <div className="mt-6 border-t border-white/20 dark:border-gray-700/30 pt-6">
            <p className="text-white/80 dark:text-gray-300/80 mb-3">Share this code with your friend:</p>

            <div className="bg-white/30 dark:bg-gray-800/50 p-4 rounded-lg text-center mb-4 relative">
              <span className="text-2xl font-mono font-bold tracking-widest text-white dark:text-gray-200">
                {inviteCode}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white dark:text-gray-300/70 dark:hover:text-gray-200"
                onClick={copyInviteCode}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-white/60 dark:text-gray-400/60 text-sm mb-4">
              <Users className="h-4 w-4" />
              <span>Waiting for player to join...</span>
            </div>

            <div className="animate-pulse flex justify-center">
              <div className="h-2 w-2 bg-blue-500 dark:bg-blue-600 rounded-full mx-1"></div>
              <div className="h-2 w-2 bg-blue-500 dark:bg-blue-600 rounded-full mx-1 animation-delay-200"></div>
              <div className="h-2 w-2 bg-blue-500 dark:bg-blue-600 rounded-full mx-1 animation-delay-400"></div>
            </div>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        className="border-white/30 text-white hover:bg-white/20 dark:border-gray-700/30 dark:text-gray-200 dark:hover:bg-gray-800/50"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  )
}

