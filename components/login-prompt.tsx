"use client";

import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

interface LoginPromptProps {
  featureName: string;
}

export default function LoginPrompt({ featureName }: LoginPromptProps) {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  const handleSignUp = () => {
    router.push('/register'); // Assuming '/register' is your signup route
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-card/80 rounded-lg border border-border shadow-lg">
      <User className="h-16 w-16 text-muted-foreground mb-6" />
      <h3 className="text-2xl font-semibold text-foreground mb-3">
        Access Your {featureName}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Please log in or create an account to view your {featureName.toLowerCase()} and connect with other players.
      </p>
      <div className="flex gap-4">
        <Button 
          onClick={handleLogin}
          className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-primary-foreground shadow-md transition duration-300 ease-in-out transform hover:-translate-y-1"
        >
          Log In
        </Button>
        <Button 
          onClick={handleSignUp}
          variant="outline"
          className="border-border text-foreground hover:bg-accent hover:text-accent-foreground transition duration-300 ease-in-out"
        >
          Sign Up
        </Button>
      </div>
    </div>
  );
} 