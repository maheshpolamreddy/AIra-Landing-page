'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'
import { AiAssistant } from '@/components/ai-assistant'

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [showInitialTag, setShowInitialTag] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    // Initial Animated Tag: trigger 1.5 seconds after page load
    if (typeof window !== 'undefined') {
      const shown = sessionStorage.getItem('aira-greeting-shown')
      if (!shown) {
        const timer = setTimeout(() => {
          setShowInitialTag(true)
          setIsPulsing(true)
          sessionStorage.setItem('aira-greeting-shown', 'true')
          
          // Stop active shake animation after 3 seconds, returning to normal float
          setTimeout(() => {
            setIsPulsing(false)
          }, 3000)
        }, 1500) // 1.5 seconds delay

        return () => clearTimeout(timer)
      }
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes orb-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes orb-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.3), 0 0 25px rgba(6, 182, 212, 0.15); }
          50% { box-shadow: 0 0 35px rgba(59, 130, 246, 0.6), 0 0 50px rgba(6, 182, 212, 0.35); }
        }
        @keyframes greeting-shake {
          0%, 100% { transform: scale(1); }
          10%, 30%, 50%, 70%, 90% { transform: scale(1.06) rotate(3deg); }
          20%, 40%, 60%, 80% { transform: scale(1.06) rotate(-3deg); }
        }
        @keyframes orbit-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes tag-slide-in {
          0% { transform: scale(0.85) translateY(12px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes tag-slide-in-desktop {
          0% { transform: scale(0.85) translateX(15px); opacity: 0; }
          100% { transform: scale(1) translateX(0); opacity: 1; }
        }
        .orb-float-anim {
          animation: orb-float 6s ease-in-out infinite;
        }
        .orb-glow-anim {
          animation: orb-glow 4s ease-in-out infinite;
        }
        .greeting-shake-anim {
          animation: greeting-shake 1.5s ease-in-out infinite;
        }
        .animate-orbit {
          animation: orbit-rotate 10s linear infinite;
          transform-origin: 50px 50px;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
          transform-origin: 50px 50px;
        }
        .animate-tag-slide-in {
          animation: tag-slide-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @media (min-width: 768px) {
          .animate-tag-slide-in {
            animation: tag-slide-in-desktop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
        }
        .bg-orb-gradient {
          background: linear-gradient(135deg, #ffffff, #f0fdfa, #eff6ff);
        }
      `}</style>

      {/* Floating Launcher and Tooltip Wrapper */}
      <div className="fixed bottom-5 right-5 md:bottom-6 md:right-6 z-40 flex flex-col md:flex-row items-end md:items-center pointer-events-none gap-3">
        
        {/* Initial Animated Greeting Tag */}
        {showInitialTag && (
          <div className="bg-white/95 border border-blue-500/25 text-slate-800 px-4 py-2.5 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.12)] text-xs font-semibold animate-tag-slide-in backdrop-blur-md pointer-events-auto select-none flex items-center gap-2.5 whitespace-nowrap mb-2 md:mb-0">
            {/* Pulsing indicator */}
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="leading-tight text-slate-800/95">Aɪra Assistant — Ask anything</span>
            <button
              onClick={() => setShowInitialTag(false)}
              suppressHydrationWarning
              className="text-slate-400 hover:text-slate-600 transition-colors ml-1 p-0.5 hover:bg-slate-100 rounded cursor-pointer"
              title="Close tag"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Floating Orb Launcher Button */}
        <button
          onClick={() => {
            setIsOpen(true)
            setShowInitialTag(false)
          }}
          suppressHydrationWarning
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full relative flex items-center justify-center shadow-xl border border-white/50 transition-all duration-300 hover:scale-[1.08] active:scale-95 cursor-pointer pointer-events-auto bg-orb-gradient orb-glow-anim ${
            isPulsing ? 'greeting-shake-anim' : 'orb-float-anim'
          }`}
          title="Aɪra AI Assistant"
        >
          {/* Subtle Outer Glow Rings */}
          <div className="absolute -inset-1.5 rounded-full border border-blue-500/10 bg-blue-500/5 -z-10 animate-pulse" />
          <div className="absolute -inset-3 rounded-full bg-cyan-500/5 -z-20 animate-[pulse-soft_6s_ease-in-out_infinite]" />
          
          {/* Pulsing ring indicating availability */}
          <div className="absolute inset-0 rounded-full bg-blue-500/15 -z-10 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />

          {/* Premium Vector Sparkles Launcher Design */}
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[90%] h-[90%] select-none z-10">
            {/* Shifting Radial Glow Behind */}
            <circle cx="50" cy="50" r="45" fill="url(#radialGlowBlue)" opacity="0.3" />

            {/* Outer Glowing Ring with Blue-Cyan Gradient */}
            <circle cx="50" cy="50" r="42" stroke="url(#ringBlueGrad)" strokeWidth="2.5" />

            {/* Inner Frosty Glass Dome (White/Blue Translucency) */}
            <circle cx="50" cy="50" r="39.5" fill="url(#glassWhiteBlue)" stroke="url(#innerBorderGrad)" strokeWidth="1" />

            {/* Revolving orbital particles */}
            <g className="animate-orbit">
              <circle cx="50" cy="8" r="2.5" fill="#3b82f6" filter="url(#glowBlue)" />
              <circle cx="50" cy="92" r="2" fill="#06b6d4" filter="url(#glowBlue)" />
            </g>

            {/* Large Sparkle Logo in Center (White & Blue themed) */}
            <g className="animate-pulse-slow">
              {/* Left smaller sparkle */}
              <path d="M26 53C26 53 31 53 33 48C35 53 40 53 40 53C40 53 35 53 33 58C31 53 26 53 26 53Z" fill="url(#sparkleBlueGrad)" filter="url(#glowBlue)" />
              {/* Center large sparkle */}
              <path d="M38 50C38 50 48 50 51 40C54 50 64 50 64 50C64 50 54 50 51 60C48 50 38 50 38 50Z" fill="url(#sparkleBlueGrad)" filter="url(#glowBlue)" />
              {/* Top right smaller sparkle */}
              <path d="M60 37C60 37 64 37 65.5 33C67 37 71 37 71 37C71 37 67 37 65.5 41C64 37 60 37 60 37Z" fill="url(#sparkleBlueGrad)" filter="url(#glowBlue)" />
            </g>

            {/* Glossy 3D reflection arc */}
            <path d="M16 35C23 23 35 15 50 15C65 15 77 23 84 35C77 26 65 21 50 21C35 21 23 26 16 35Z" fill="white" opacity="0.45" />

            <defs>
              <radialGradient id="radialGlowBlue" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="ringBlueGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="40%" stopColor="#3b82f6" />
                <stop offset="80%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="glassWhiteBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#eff6ff" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="innerBorderGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="sparkleBlueGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="30%" stopColor="#93c5fd" />
                <stop offset="70%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>

          {/* Active indicator (Green Dot) */}
          <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full z-20 flex items-center justify-center shadow-lg" title="Aɪra Assistant is available">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </div>
        </button>
      </div>

      {/* Center Modal & Full-screen Overlay */}
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 transition-all duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />

        {/* Modal Window Container */}
        <div 
          className={`relative w-full h-full md:h-[80vh] md:max-h-[850px] md:max-w-2xl transition-all duration-500 ease-out transform ${
            isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-90 translate-y-12 opacity-0'
          }`}
        >
          {isOpen && (
            <AiAssistant 
              isModal={true} 
              onClose={() => setIsOpen(false)} 
            />
          )}
        </div>
      </div>
    </>
  )
}
