"use client";

import FriendsPage from "@/components/friends-page";
import { useAuth } from "@/lib/auth";

export default function FriendsRoute() {
  const { user } = useAuth();
  
  return <FriendsPage userId={user?.id} />;
} 