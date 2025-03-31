'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { 
  // User, // Removed unused import
  LogOut, 
  // Settings, // Remove unused import
  UserCircle 
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface UserMenuProps {
  username: string
  level?: number
  avatarUrl?: string | null
  onProfileClick: () => void
}

export function UserMenu({ username, level = 1, avatarUrl, onProfileClick }: UserMenuProps) {
  const { signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  
  const handleLogout = async () => {
    console.log('Logging out...')
    setIsLoggingOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error logging out:', error)
      setIsLoggingOut(false)
    }
  }
  
  const initials = username
    ? username.substring(0, 2).toUpperCase()
    : 'U'
  
  return (
    <div className="flex items-center gap-3">
      <div className="bg-white/30 dark:bg-gray-800/50 text-white dark:text-gray-200 px-4 py-2 rounded-full flex items-center">
        <span className="font-medium mr-2">{username}</span>
        <div className="bg-yellow-400 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100 text-xs font-bold px-2 py-1 rounded-full">
          LVL {level}
        </div>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="border-white/30 text-white hover:bg-white/20 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/50 rounded-full h-10 w-10 p-0"
          >
            <Avatar>
              <AvatarImage src={avatarUrl || undefined} alt={username} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 text-white text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="bg-white/90 backdrop-blur dark:bg-gray-900/90 border-white/30 dark:border-gray-700/50"
        >
          <DropdownMenuItem 
            className="cursor-pointer text-gray-700 dark:text-gray-300 focus:bg-white/20 dark:focus:bg-gray-800/50"
            onClick={onProfileClick}
          >
            <UserCircle className="h-4 w-4 mr-2" />
            <span>Profile</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-gray-300/50 dark:bg-gray-700/50" />
          
          <DropdownMenuItem 
            className="cursor-pointer text-red-600 dark:text-red-400 focus:bg-white/20 dark:focus:bg-gray-800/50"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 