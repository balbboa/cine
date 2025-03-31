'use client'

import { Suspense } from 'react'
import { RegisterForm } from './register-form'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-black p-4">
      <Suspense fallback={
        <div className="max-w-md w-full space-y-8 bg-black/30 p-8 rounded-xl backdrop-blur-sm">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-white">Loading...</h2>
          </div>
        </div>
      }>
        <RegisterForm />
      </Suspense>
    </div>
  )
} 