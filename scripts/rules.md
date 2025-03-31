---
# Specify the following for Cursor rules
description: Performance optimization guidelines for Next.js + Supabase applications
globs: "**/*.{js,jsx,ts,tsx}"
---

# Performance Optimization for Next.js + Supabase

You're developing a high-performance application using **Next.js and Supabase**. Follow these best practices to ensure optimal performance, fast load times, and efficient resource utilization.

## General Guidelines

1. Use **Next.js App Router** with React Server Components to reduce client-side JavaScript and improve Time to First Byte (TTFB)
2. Implement proper **component separation** - use Server Components for data fetching and Client Components only when interactivity is needed
3. Leverage **Streaming** and **Suspense** for progressive rendering of UI components
4. Configure appropriate **caching strategies** at every level (CDN, API, database)
5. Use **Edge Runtime** when possible for faster global response times
6. Optimize **bundle size** by removing unnecessary dependencies and implementing code splitting
7. Implement **optimistic UI updates** to improve perceived performance
8. Use **Incremental Static Regeneration (ISR)** for pages with semi-dynamic content

## Server Components & Data Fetching

1. Fetch data directly in Server Components without using client-side state management
2. Use `supabase-js` server client with appropriate caching headers:
   ```tsx
   import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
   import { cookies } from 'next/headers'
   
   export default async function Page() {
     const supabase = createServerComponentClient({ cookies })
     
     // React Cache can be used to deduplicate requests
     const { data } = await supabase
       .from('posts')
       .select('*')
       .order('created_at', { ascending: false })
       .returns<Post[]>()
       
     return <PostList posts={data || []} />
   }
   ```

3. Implement proper error boundaries with Suspense to prevent cascading failures:
   ```tsx
   <Suspense fallback={<PostsSkeleton />}>
     <Posts />
   </Suspense>
   ```

4. Use **Parallel Data Fetching** to request multiple resources simultaneously:
   ```tsx
   // These requests happen in parallel
   const postsPromise = getPostsData()
   const usersPromise = getUsersData()
   
   // Wait for both to resolve
   const [posts, users] = await Promise.all([postsPromise, usersPromise])
   ```

## Client Components & Interactivity

1. Minimize Client Components to reduce JavaScript bundle size
2. Use the `"use client"` directive only at the leaf components that need interactivity
3. For Supabase real-time updates, initialize subscriptions efficiently:
   ```tsx
   "use client"
   
   import { useEffect, useState } from 'react'
   import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
   
   export default function RealtimeComments({ initialComments }) {
     const [comments, setComments] = useState(initialComments)
     const supabase = createClientComponentClient()
     
     useEffect(() => {
       const channel = supabase
         .channel('comments')
         .on('postgres_changes', { 
           event: '*', 
           schema: 'public', 
           table: 'comments' 
         }, (payload) => {
           // Update state efficiently with functional updates
           setComments(current => handleRealtimeUpdate(current, payload))
         })
         .subscribe()
         
       return () => {
         supabase.removeChannel(channel)
       }
     }, [supabase])
     
     return <CommentsList comments={comments} />
   }
   ```

4. Implement **debouncing** for user inputs that trigger Supabase queries
5. Use `React.memo`, `useMemo`, and `useCallback` for expensive computations and to prevent unnecessary re-renders

## Database & Query Optimization

1. Create appropriate **indexes** on frequently queried columns in Supabase
2. Use **RLS policies** effectively without overcomplicating them
3. Implement **pagination** for large datasets:
   ```tsx
   const { data, error } = await supabase
     .from('posts')
     .select('id, title, created_at')
     .range(0, 9)  // First 10 items
     .order('created_at', { ascending: false })
   ```

4. Use **select** with only required columns to reduce payload size:
   ```tsx
   // Bad - fetches all columns
   const { data } = await supabase.from('users').select('*')
   
   // Good - fetches only needed columns
   const { data } = await supabase.from('users').select('id, name, avatar_url')
   ```

5. Implement efficient **joins** to reduce multiple requests:
   ```tsx
   const { data } = await supabase
     .from('posts')
     .select(`
       id,
       title,
       user_id,
       users (
         name,
         avatar_url
       ),
       comments (
         id,
         content
       )
     `)
     .eq('status', 'published')
   ```

6. Use **materialized views** for complex, frequently-accessed queries
7. Implement **cache invalidation** strategies with Next.js revalidation:
   ```tsx
   export const revalidate = 60 // Revalidate every 60 seconds
   ```

## Image & Asset Optimization

1. Use Next.js `Image` component with proper sizing and quality attributes:
   ```tsx
   import Image from 'next/image'
   
   export default function Avatar({ user }) {
     return (
       <Image
         src={user.avatar_url}
         alt={`${user.name}'s avatar`}
         width={40}
         height={40}
         quality={80}
         priority={false}
         placeholder="blur"
         blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
       />
     )
   }
   ```

2. Store images in Supabase Storage with appropriate caching headers
3. Implement responsive images with `srcSet` for different viewport sizes
4. Use proper image formats (WebP, AVIF) with fallbacks for older browsers
5. Lazy load below-the-fold images

## Authentication & Security

1. Implement **Supabase Auth Helpers** for Next.js with proper session management:
   ```tsx
   // middleware.ts
   import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
   import { NextResponse } from 'next/server'
   
   export async function middleware(req) {
     const res = NextResponse.next()
     const supabase = createMiddlewareClient({ req, res })
     
     // Lightweight session refresh 
     await supabase.auth.getSession()
     
     return res
   }
   ```

2. Use **Row Level Security (RLS)** policies to minimize data transfer and enforce security
3. Implement **JWT verification** efficiently using edge functions
4. Cache authenticated user data where appropriate

## Deployment & Infrastructure

1. Use **Edge Functions** for globally distributed API endpoints
2. Enable **CDN caching** for static assets and responses
3. Configure proper **Cache-Control** headers:
   ```tsx
   export async function GET() {
     const data = await getData()
     
     return new Response(JSON.stringify(data), {
       headers: {
         'content-type': 'application/json',
         'cache-control': 'public, s-maxage=60, stale-while-revalidate=600'
       },
     })
   }
   ```

4. Implement **incremental builds** for faster deployments
5. Use **Vercel Analytics** or similar tools to monitor Core Web Vitals

## Example Templates

### Optimized Data Fetching with Supabase and RSC

```tsx
// app/posts/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import PostList from './PostList'
import { Suspense } from 'react'

// Enable ISR with 1-minute revalidation
export const revalidate = 60

// Fetch data function with appropriate return type
async function getPosts() {
  const supabase = createServerComponentClient({ cookies })
  
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      created_at,
      author:user_id (
        name,
        avatar_url
      ),
      comments_count:comments(count)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error('Error fetching posts:', error)
    return []
  }
  
  return data || []
}

export default async function PostsPage() {
  const posts = await getPosts()
  
  return (
    <main className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Latest Posts</h1>
      <Suspense fallback={<div>Loading posts...</div>}>
        <PostList initialPosts={posts} />
      </Suspense>
    </main>
  )
}
```

### Optimized Client Component with Real-time Updates

```tsx
// components/RealtimePostList.tsx
"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import PostCard from './PostCard'
import { debounce } from 'lodash-es' // Import only what you need

export default function RealtimePostList({ initialPosts }) {
  const [posts, setPosts] = useState(initialPosts)
  const [search, setSearch] = useState('')
  const supabase = createClientComponentClient()
  
  // Filter posts on client for instant feedback
  const filteredPosts = useMemo(() => {
    return posts.filter(post => 
      post.title.toLowerCase().includes(search.toLowerCase())
    )
  }, [posts, search])
  
  // Debounced search function to reduce database queries
  const handleServerSearch = useCallback(
    debounce(async (term) => {
      if (!term) return
      
      const { data } = await supabase
        .from('posts')
        .select('id, title, created_at, user_id')
        .ilike('title', `%${term}%`)
        .limit(10)
      
      if (data) setPosts(data)
    }, 500),
    [supabase]
  )
  
  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('posts-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts',
      }, (payload) => {
        // Efficient state updates
        setPosts(currentPosts => {
          const { new: newPost, old: oldPost, eventType } = payload
          
          switch (eventType) {
            case 'INSERT':
              return [newPost, ...currentPosts]
            case 'UPDATE':
              return currentPosts.map(post => 
                post.id === oldPost.id ? { ...post, ...newPost } : post
              )
            case 'DELETE':
              return currentPosts.filter(post => post.id !== oldPost.id)
            default:
              return currentPosts
          }
        })
      })
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])
  
  // Handle input change with debounced server query
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearch(value)
    handleServerSearch(value)
  }
  
  return (
    <div>
      <input
        type="text"
        placeholder="Search posts..."
        value={search}
        onChange={handleSearchChange}
        className="w-full p-2 mb-4 border rounded"
      />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPosts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      
      {filteredPosts.length === 0 && (
        <p className="text-center py-4">No posts found</p>
      )}
    </div>
  )
}
```

### Optimized API Route with Edge Runtime

```tsx
// app/api/stats/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Use Edge Runtime for faster global response times
export const runtime = 'edge'

// Cache for 1 minute, stale-while-revalidate for up to 1 hour
export const revalidate = 60

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  
  // Run queries in parallel
  const [
    { data: users },
    { data: posts },
    { data: comments }
  ] = await Promise.all([
    supabase.from('users').select('count').single(),
    supabase.from('posts').select('count').single(),
    supabase.from('comments').select('count').single()
  ])
  
  const stats = {
    users: users?.count || 0,
    posts: posts?.count || 0,
    comments: comments?.count || 0,
    timestamp: new Date().toISOString()
  }
  
  return NextResponse.json(stats, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=3600'
    }
  })
}
```