"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Home, AlertTriangle, Loader2 } from "lucide-react";

export default function PokestyleOnlinePage() {
  const params = useParams();
  const gameId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [gameExists, setGameExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkGameExists = async () => {
      if (!gameId || !supabase) return;

      setIsLoading(true);
      setError(null);
      setGameExists(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("games")
          .select("id", { count: 'exact', head: true })
          .eq("id", gameId);

        if (fetchError) {
          console.error("Error checking game:", fetchError);
          throw new Error(fetchError.message || "Could not verify game existence.");
        }
        
        setGameExists(data !== null); 

      } catch (err) {
        console.error("Error in checkGameExists:", err);
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while checking the game.";
        setError(errorMessage);
        setGameExists(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkGameExists();
  }, [gameId, supabase]);

  if (isLoading || gameExists === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-800 to-black text-white">
        <Loader2 className="h-12 w-12 animate-spin text-blue-400 mb-4" />
        <p className="text-xl">Loading game data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-red-900 to-black text-white p-4">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Error Loading Game</h1>
        <p className="text-red-300 mb-6 text-center max-w-md">{error}</p>
        <Button onClick={() => router.push("/")} variant="destructive">
          <Home size={16} className="mr-2"/> Back to Home
        </Button>
      </div>
    );
  }

  if (!gameExists) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-900 to-black text-white p-4">
        <AlertTriangle className="h-12 w-12 text-yellow-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Game Not Found</h1>
        <p className="text-yellow-300 mb-6 text-center max-w-md">The game ID &apos;{gameId}&apos; does not seem to exist or you may not have access.</p>
        <Button onClick={() => router.push("/")} variant="outline">
           <Home size={16} className="mr-2"/> Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-black text-white">
      <div className="container mx-auto p-4">
        <div className="text-center text-yellow-400 mt-10">Game component placeholder (PokestyleTicTacToe/Header imports commented out due to potential errors)</div>
      </div>
    </div>
  );
}

