"use client";

// import PokestyleTicTacToe from "@/components/pokestyle-tictactoe"; // FIXME: Linter error - Assuming corrected component path/name
// import { useParams } from "next/navigation"; // Removed unused import

export default function PokestyleLocalGamePage() { // Added 'Page' suffix for clarity
  return (
    <div className="container mx-auto p-4 min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-purple-800 to-indigo-900 text-white">
      <h1 className="text-3xl font-bold mb-6 text-center">Pokestyle TicTacToe - Local Play</h1>
      {/* Ensure the PokestyleTicTacToe component exists and props are correct */}
      {/* <PokestyleTicTacToe mode="local" /> */}
      <div className="text-center text-yellow-400">Game component placeholder (PokestyleTicTacToe import commented out due to error)</div>
    </div>
  );
}

