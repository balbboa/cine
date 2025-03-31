'use client'

import React, { createContext, useState, useContext, useEffect } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Check for saved theme preference in localStorage
    const savedTheme = typeof window !== 'undefined' 
      ? localStorage.getItem('cine-tac-toe-theme') as Theme
      : null
    
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      // Check for system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
    
    // Add listener for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const userSavedTheme = localStorage.getItem('cine-tac-toe-theme')
      if (!userSavedTheme) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    
    mediaQuery.addEventListener('change', handleMediaChange)
    setIsInitialized(true)
    
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  useEffect(() => {
    if (!isInitialized) return
    
    // Apply theme class to document
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('cine-tac-toe-theme', theme)
    }
  }, [theme, isInitialized])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
} 