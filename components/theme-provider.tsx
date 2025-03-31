'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps as NextThemeProviderProps,
} from 'next-themes'

export interface ThemeProviderProps extends Omit<NextThemeProviderProps, 'defaultTheme'> {
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system',
  ...props 
}: ThemeProviderProps) {
  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme={defaultTheme} 
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
