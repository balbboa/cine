"use client"

import React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { ShoppingBag, Palette, Sparkles, Tag, Star, AlertCircle, CheckCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/db"
import Image from "next/image"

// Define types reflecting the data structure used in this component
type StoreItemProp = { // Define prop type for StoreItem
  id: number;
  name: string;
  description: string;
  price: number;
  type: string;
  image_url?: string | null; // Add optional image_url
}

interface StoreProps {
  isLoggedIn: boolean
  onLogin: () => void
  user: User | null
}

export default function Store({ isLoggedIn, onLogin, user }: StoreProps) {
  const { toast } = useToast()
  const [storeItems, setStoreItems] = useState<StoreItemProp[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null)

  const supabaseClient = createClient()

  useEffect(() => {
    const loadStoreItems = async () => {
      setLoading(true)
      try {
        const { data: items, error } = await supabaseClient
          .from('store_items')
          .select('*')
          .order('price', { ascending: true })

        if (error) throw error
        setStoreItems(items || [])
      } catch (error) {
        console.error("Error loading store items:", error)
      } finally {
        setLoading(false)
      }
    }

    loadStoreItems()
  }, [supabaseClient])

  const handlePurchase = useCallback(async (item: StoreItemProp) => {
    if (!isLoggedIn || !user) {
      onLogin()
      return
    }

    setPurchasing(true)
    setPurchaseError(null)
    setPurchaseSuccess(null)

    try {
      const { data: freshUserData, error: userFetchError } = await supabaseClient
        .from('users')
        .select('credits')
        .eq('id', user.id)
        .single()

      if (userFetchError || !freshUserData) {
        throw new Error("Could not verify your credits.")
      }

      const newCredits = freshUserData.credits - item.price;
      const { error: creditError } = await supabaseClient
          .from('users')
          .update({ credits: newCredits })
          .eq('id', user.id);
          
      if (creditError) {
          console.error('Credit deduction error:', creditError);
          throw new Error("Failed to update credits. Purchase cancelled.");
      }

      setPurchaseSuccess(`You\'ve successfully purchased ${item.name}`)

      toast({
        title: "Item Purchased!",
        description: `You've successfully purchased ${item.name}`,
      })
    } catch (error) {
      console.error("Error purchasing item:", error)
      setPurchaseError("An error occurred while purchasing the item")
    } finally {
      setPurchasing(false)
    }
  }, [isLoggedIn, onLogin, toast, user, supabaseClient])

  const isItemOwned = useCallback(() => {
    // Since inventory is removed, assume items are not owned or implement new logic
    return false; 
  }, [])

  const getItemsByType = useCallback((type: string) => {
    return Array.isArray(storeItems) ? storeItems.filter((item) => item.type === type) : []
  }, [storeItems])

  const themeItems = useMemo(() => getItemsByType("board"), [getItemsByType])
  const symbolItems = useMemo(() => getItemsByType("symbol"), [getItemsByType])
  const boosterItems = useMemo(() => getItemsByType("booster"), [getItemsByType])

  interface StoreItemCardProps {
    item: StoreItemProp
    isOwned: boolean
    onPurchase: (item: StoreItemProp) => void
    purchasing: boolean
    type?: "board" | "symbol" | "booster"
  }

  function StoreItemCard({ item, isOwned, onPurchase, purchasing }: StoreItemCardProps) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={`bg-white/10 dark:bg-gray-900/20 rounded-xl p-4 border border-white/20 dark:border-gray-700/30 flex flex-col justify-between shadow-lg ${isOwned ? 'opacity-60' : ''}`}
      >
        <div>
          <h3 className="text-lg font-semibold text-white dark:text-gray-200 mb-1">{item.name || 'Unnamed Item'}</h3>
          <p className="text-sm text-white/70 dark:text-gray-300/70 mb-3 h-10 overflow-hidden">{item.description || 'No description available.'}</p>
          {item.image_url && 
            <Image 
              src={item.image_url} 
              alt={item.name || ''} 
              width={64}
              height={64}
              className="h-16 w-16 object-cover rounded mb-2"
            />
          }
        </div>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10 dark:border-gray-700/30">
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">
            <Star className="h-3 w-3 mr-1" />
            {item.price ?? 'N/A'} Credits
          </Badge>
          <Button
            size="sm"
            onClick={() => !isOwned && onPurchase(item)}
            disabled={isOwned || purchasing}
            className={`transition-colors ${isOwned ? "bg-green-600 hover:bg-green-700 cursor-default" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {isOwned ? 'Owned' : purchasing ? 'Purchasing...' : 'Buy'}
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white dark:text-gray-200">Store</h2>

        {isLoggedIn && user && (
          <div className="bg-white/20 dark:bg-gray-800/30 px-4 py-2 rounded-full text-white dark:text-gray-200 flex items-center">
            <Star className="h-4 w-4 text-yellow-400 dark:text-yellow-500 mr-2" />
            <span>{user.credits} Credits</span>
          </div>
        )}
      </div>

      {purchaseError && (
        <Alert
          variant="destructive"
          className="bg-red-500/20 border-red-500/50 text-white dark:bg-red-900/20 dark:border-red-900/50 dark:text-gray-200"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{purchaseError}</AlertDescription>
        </Alert>
      )}

      {purchaseSuccess && (
        <Alert className="bg-green-500/20 border-green-500/50 text-white dark:bg-green-900/20 dark:border-green-900/50 dark:text-gray-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{purchaseSuccess}</AlertDescription>
        </Alert>
      )}

      {isLoggedIn ? (
        <div className="space-y-6">
          <Tabs defaultValue="themes">
            <TabsList className="bg-white/20 dark:bg-gray-800/30 p-1">
              <TabsTrigger
                value="themes"
                className="data-[state=active]:bg-white/30 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700/50 dark:data-[state=active]:text-gray-100 text-white/70 dark:text-gray-300/70"
              >
                <Palette className="h-4 w-4 mr-1" />
                Themes
              </TabsTrigger>
              <TabsTrigger
                value="symbols"
                className="data-[state=active]:bg-white/30 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700/50 dark:data-[state=active]:text-gray-100 text-white/70 dark:text-gray-300/70"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Symbols
              </TabsTrigger>
              <TabsTrigger
                value="boosters"
                className="data-[state=active]:bg-white/30 data-[state=active]:text-white dark:data-[state=active]:bg-gray-700/50 dark:data-[state=active]:text-gray-100 text-white/70 dark:text-gray-300/70"
              >
                <Tag className="h-4 w-4 mr-1" />
                Boosters
              </TabsTrigger>
            </TabsList>

            <TabsContent value="themes" className="mt-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <StoreItemSkeleton key={i} />
                    ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {themeItems.map((item) => (
                    <StoreItemCard 
                      key={item.id} 
                      item={item} 
                      isOwned={isItemOwned()} 
                      onPurchase={handlePurchase} 
                      purchasing={purchasing} 
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="symbols" className="mt-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <StoreItemSkeleton key={i} />
                    ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {symbolItems.map((item) => (
                    <StoreItemCard 
                      key={item.id} 
                      item={item} 
                      isOwned={isItemOwned()} 
                      onPurchase={handlePurchase} 
                      purchasing={purchasing} 
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="boosters" className="mt-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <StoreItemSkeleton key={i} />
                    ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {boosterItems.map((item) => (
                    <StoreItemCard 
                      key={item.id} 
                      item={item} 
                      isOwned={isItemOwned()} 
                      onPurchase={handlePurchase} 
                      purchasing={purchasing} 
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl backdrop-blur-md bg-white/10 dark:bg-gray-900/20 border border-white/20 dark:border-gray-700/30">
          <ShoppingBag className="h-12 w-12 text-white/70 dark:text-gray-300/70 mb-4" />
          <h3 className="text-xl font-semibold text-white dark:text-gray-200 mb-2">Sign in to access the Store</h3>
          <p className="text-white/70 dark:text-gray-300/70 text-center mb-4">
            Log in to browse and purchase items for your game experience
          </p>
          <Button
            onClick={onLogin}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white dark:from-blue-600 dark:to-purple-700 dark:hover:from-blue-700 dark:hover:to-purple-800"
          >
            Sign In
          </Button>
        </div>
      )}
    </div>
  )
}

interface StoreItemProps {
  item: StoreItemProp;
  isOwned: boolean;
  onPurchase: (item: StoreItemProp) => void;
  purchasing: boolean;
  type?: "board" | "symbol" | "booster";
}

// Extract StoreItem as a separate memoized component to avoid unnecessary rerenders
const StoreItem = React.memo(({ item, isOwned, onPurchase, purchasing, type = "board" }: StoreItemProps) => {
  // Determine gradient colors based on item type
  const gradientClass = useMemo(() => {
    switch (type) {
      case "symbol": 
        return "from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600";
      case "booster": 
        return "from-green-400 to-teal-500 dark:from-green-500 dark:to-teal-600";
      default: 
        return "from-blue-400 to-purple-500 dark:from-blue-500 dark:to-purple-600";
    }
  }, [type]);
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="backdrop-blur-md bg-white/10 dark:bg-gray-900/20 rounded-xl p-4 border border-white/20 dark:border-gray-700/30 shadow-lg flex"
    >
      <div className={`w-20 h-20 bg-gradient-to-br ${gradientClass} rounded-lg mr-4 flex-shrink-0 flex items-center justify-center text-2xl`}>
        {type === "symbol" && "🎬"}
        {type === "booster" && "⚡"}
      </div>
      <div className="flex-1">
        <h3 className="text-white dark:text-gray-200 font-semibold">{item.name}</h3>
        <p className="text-white/70 dark:text-gray-300/70 text-sm mb-2">{item.description}</p>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Star className="h-4 w-4 text-yellow-400 dark:text-yellow-500 mr-1" />
            <span className="text-white dark:text-gray-200 font-medium">{item.price}</span>
          </div>

          {isOwned ? (
            <Badge className="bg-green-500 dark:bg-green-600 text-white">Owned</Badge>
          ) : (
            <Button
              size="sm"
              onClick={() => onPurchase(item)}
              disabled={purchasing}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white dark:from-blue-600 dark:to-purple-700 dark:hover:from-blue-700 dark:hover:to-purple-800"
            >
              {purchasing ? "Processing..." : "Purchase"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

StoreItem.displayName = "StoreItem";

function StoreItemSkeleton() {
  return (
    <div className="backdrop-blur-md bg-white/10 dark:bg-gray-900/20 rounded-xl p-4 border border-white/20 dark:border-gray-700/30 shadow-lg flex">
      <Skeleton className="w-20 h-20 rounded-lg mr-4 flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  )
}

