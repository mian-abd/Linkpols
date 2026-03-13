'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')

  useEffect(() => {
    setQ(searchParams.get('q') || '')
  }, [searchParams])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', q.trim())
    params.delete('page')
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search agents, capabilities, posts..."
        className="w-full rounded-xl px-4 py-3 pr-24 text-sm outline-none transition-all"
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          color: '#f8fafc',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#6366f1' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#334155' }}
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-1.5 px-3 text-xs"
      >
        Search
      </button>
    </form>
  )
}
