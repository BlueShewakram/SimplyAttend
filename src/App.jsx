import React, { useState, useEffect } from 'react';
import Scanner from './components/Scanner';
import Dashboard from './components/Dashboard';
import TeacherPanel from './components/TeacherPanel';
import { Camera, LayoutDashboard, Sparkles, Clock, Wifi } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('scanner');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#03030b] text-white font-sans selection:bg-violet-500/30">
      {/* ── Dynamic Ambient Background ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-violet-600/20 to-blue-900/40 blur-[120px] rounded-full mix-blend-screen animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-gradient-to-tl from-cyan-800/30 to-indigo-900/20 blur-[150px] rounded-full mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[20%] left-[60%] w-[30%] h-[40%] bg-fuchsia-500/10 blur-[100px] rounded-full mix-blend-screen animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-8 backdrop-blur-xl bg-black/20 border border-white/5 p-4 rounded-3xl shadow-2xl">
          {/* Logo + time */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-cyan-400 to-violet-600 rounded-2xl shadow-lg shadow-violet-500/20 ring-1 ring-white/20">
                <Sparkles className="text-white" size={22} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-zinc-400">SimplyAttend</h1>
                <p className="text-cyan-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 mt-0.5">
                  <Wifi size={10} className="animate-pulse" /> Live Sync Active
                </p>
              </div>
            </div>

            {/* Live date/time pill */}
            <div className="hidden sm:flex items-center gap-2 bg-black/30 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl shadow-inner">
              <Clock size={14} className="text-cyan-400 animate-pulse-slow" />
              <span className="text-zinc-300 text-xs font-semibold">{dateStr}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-cyan-400 text-xs font-bold font-mono tracking-wider">{timeStr}</span>
            </div>
          </div>

          {/* Nav */}
          <div className="flex items-center gap-2">
            <div className="flex bg-black/30 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl gap-2 shadow-inner">
              <button
                onClick={() => setActiveTab('scanner')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeTab === 'scanner'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] ring-1 ring-cyan-400/30'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Camera size={16} className={activeTab === 'scanner' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-zinc-500'} />
                Scanner
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeTab === 'dashboard'
                    ? 'bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)] ring-1 ring-violet-400/30'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <LayoutDashboard size={16} className={activeTab === 'dashboard' ? 'text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]' : 'text-zinc-500'} />
                Dashboard
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main>
          {activeTab === 'scanner' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-4 items-start">
              {/* Left: Scanner */}
              <Scanner />
              {/* Right: Teacher panel */}
              <TeacherPanel />
            </div>
          ) : (
            <Dashboard />
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="mt-12 text-center text-[10px] uppercase tracking-widest font-bold">
          <span className="text-zinc-600">SimplyAttend v1.0 — Built by </span>
          <span className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">Shewakram</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
