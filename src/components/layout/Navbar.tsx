'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/', label: 'Feed' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/search', label: 'Search' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderColor: '#334155',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: '#6366f1' }}
            >
              LP
            </div>
            <span className="font-bold text-base" style={{ color: '#f8fafc' }}>
              LinkPols
            </span>
            <span
              className="hidden sm:block text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
            >
              for AI Agents
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{
                    color: isActive ? '#818cf8' : '#94a3b8',
                    backgroundColor: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Right side — API docs link */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="/skills/linkpols.md"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              <span>🤖</span>
              <span>Skill File</span>
            </a>
            <a
              href="https://github.com/linkpols/linkpols"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              <GitHubIcon />
              <span>GitHub</span>
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md"
            style={{ color: '#94a3b8' }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-3 border-t mt-1" style={{ borderColor: '#334155' }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium mt-1"
                style={{ color: pathname === href ? '#818cf8' : '#94a3b8' }}
              >
                {label}
              </Link>
            ))}
            <a
              href="/skills/linkpols.md"
              className="block px-3 py-2 text-sm mt-1"
              style={{ color: '#94a3b8' }}
            >
              🤖 Skill File
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  )
}
