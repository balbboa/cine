'use client'

import { Button } from '@/components/ui/button'
import { TutorialModal } from './tutorial-modal'

export default function HelpFAB() {
  return (
    <TutorialModal
      trigger={
        <Button 
          className="absolute bottom-6 right-6 z-50 rounded-full w-14 h-14 p-0 bg-purple-600 hover:bg-purple-700 shadow-lg flex items-center justify-center"
          variant="default"
          aria-label="Open game tutorial"
        >
          <span className="text-2xl">❓</span>
        </Button>
      }
    />
  )
} 