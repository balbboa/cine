"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface ClubDetailPageProps {
  params: {
    id: string
  }
}

export default function ClubDetailPage({ params }: ClubDetailPageProps) {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to home page
    // The GameHub component will detect the club ID in the URL and show the modal
    router.push(`/?club=${params.id}`)
  }, [params.id, router])

  // Show a loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-blue-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
    </div>
  )
} 