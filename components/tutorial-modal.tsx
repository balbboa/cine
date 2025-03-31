"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react" // Example icon

interface TutorialModalProps {
  trigger: React.ReactNode; // Allow custom trigger component (the FAB)
}

export function TutorialModal({ trigger }: TutorialModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            How to Play Cine-Tac-Toe
          </DialogTitle>
          <DialogDescription>
            A quick guide to get you started.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <h3 className="font-semibold">The Goal</h3>
          <p className="text-sm text-muted-foreground">
            Be the first player to get three of your marks in a row (horizontally, vertically, or diagonally) on the 3x3 grid, just like classic Tic-Tac-Toe.
          </p>
          <h3 className="font-semibold">The Twist</h3>
          <p className="text-sm text-muted-foreground">
            Each square on the grid represents the intersection of two categories (e.g., an actor and a movie genre, two directors, etc.). To claim a square, you must name a movie that fits BOTH intersecting categories.
          </p>
          <h3 className="font-semibold">Gameplay</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Players take turns selecting an empty square.</li>
            <li>Name a valid movie fitting both row and column categories.</li>
            <li>If correct, you claim the square. If incorrect, the turn passes.</li>
            <li>Use your movie knowledge to block opponents and create winning lines!</li>
          </ul>
          {/* Add more tutorial steps/images/gifs as needed */}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Got it!</Button> 
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TutorialModal; 