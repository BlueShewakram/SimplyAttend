import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../supabaseClient';
import { ScanLine, AlertCircle, StopCircle, CheckCircle2, Clock, UserCheck, Camera } from 'lucide-react';

function getStatus(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  if (h < 8 || (h === 8 && m <= 15)) return 'Present';
  return 'Late';
}

export default function Scanner() {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [recentCheckins, setRecentCheckins] = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const html5QrRef = useRef(null);
  const transitionLock = useRef(false);

  // ── Fetch today's real check-ins ──
  useEffect(() => {
    let alive = true;

    async function fetchToday() {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data } = await supabase
        .from('attendance')
        .select('*')
        .gte('created_at', startOfDay)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data && alive) {
        setRecentCheckins(data.map(log => ({
          id: log.id,
          name: log.student_id || 'Unknown',
          time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: getStatus(new Date(log.created_at)),
        })));
        setTodayCount(data.length);
      }
    }

    fetchToday();

    const channel = supabase
      .channel('scanner_checkins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, (payload) => {
        if (!alive) return;
        const log = payload.new;
        setRecentCheckins(prev => [{
          id: log.id,
          name: log.student_id || 'Unknown',
          time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: getStatus(new Date(log.created_at)),
        }, ...prev.slice(0, 9)]);
        setTodayCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Start camera ──
  const startScanning = useCallback(async () => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    setError(null);
    setScanResult(null);

    try {
      // Create a fresh instance each time
      if (html5QrRef.current) {
        try { await html5QrRef.current.stop(); } catch (_) { }
        try { html5QrRef.current.clear(); } catch (_) { }
      }

      html5QrRef.current = new Html5Qrcode('qr-reader');

      await html5QrRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          disableFlip: false,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText) => {
          // On successful scan
          try {
            transitionLock.current = true;
            await html5QrRef.current.stop();
          } catch (_) { }
          setIsScanning(false);

          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

          // Check for duplicate
          const { data: existing } = await supabase
            .from('attendance')
            .select('id')
            .eq('student_id', decodedText)
            .gte('created_at', startOfDay)
            .limit(1);

          if (existing && existing.length > 0) {
            setScanResult({ text: decodedText, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'Already Scanned' });
            setTimeout(() => {
              setScanResult(null);
              transitionLock.current = false;
              startScanning();
            }, 3000);
            transitionLock.current = false;
            return;
          }

          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const status = getStatus(now);
          setScanResult({ text: decodedText, time: timeStr, status });

          // Optimistically update the list so we don't have to wait for server update
          setRecentCheckins(prev => [{
            id: Date.now(), // temp id
            name: decodedText,
            time: timeStr,
            status: status
          }, ...prev.slice(0, 9)]);
          setTodayCount(prev => prev + 1);

          const { error: dbError } = await supabase
            .from('attendance')
            .insert([{ student_id: decodedText }]);

          if (dbError) {
            setError(`Failed to save. ${dbError.message}`);
            setScanResult(null);
          } else {
            setTimeout(() => {
              setScanResult(null);
              transitionLock.current = false;
              startScanning();
            }, 3000);
          }
          transitionLock.current = false;
        },
        () => { } // ignore per-frame decode failures
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Camera start error:', err);
      const msg = typeof err === 'string' ? err : err?.message || 'Could not access camera.';
      // Only show error if it's not a transition issue (we'll just retry)
      if (msg.includes('transition')) {
        setTimeout(() => {
          transitionLock.current = false;
          startScanning();
        }, 500);
        return;
      }
      // Detect "camera in use" errors and give a friendlier message
      if (msg.toLowerCase().includes('in use') || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('notreadable') || msg.includes('TrackStartError') || msg.includes('AbortError')) {
        setError('Camera is in use by another tab. Close the other tab or switch to it first.');
      } else {
        setError(msg);
      }
      setIsScanning(false);
    } finally {
      transitionLock.current = false;
    }
  }, []);

  // ── Stop camera ──
  const stopScanning = useCallback(async () => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.stop();
      }
    } catch (_) { }
    setIsScanning(false);
    transitionLock.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        try { html5QrRef.current.stop(); } catch (_) { }
        html5QrRef.current = null;
      }
    };
  }, []);

  // ── Page Visibility: release camera when tab is hidden, re-acquire when visible ──
  useEffect(() => {
    const wasScanningRef = { current: false };

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Tab is now hidden — release the camera so other tabs can use it
        if (isScanning || html5QrRef.current) {
          wasScanningRef.current = true;
          try {
            if (html5QrRef.current) {
              await html5QrRef.current.stop();
            }
          } catch (_) { }
          setIsScanning(false);
          transitionLock.current = false;
        }
      } else {
        // Tab is now visible again — re-acquire the camera
        if (wasScanningRef.current) {
          wasScanningRef.current = false;
          // Small delay to let the other tab release the camera
          setTimeout(() => {
            transitionLock.current = false;
            startScanning();
          }, 600);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isScanning, startScanning]);

  // Auto-start on first mount only
  useEffect(() => {
    const timer = setTimeout(() => startScanning(), 500);
    return () => clearTimeout(timer);
  }, [startScanning]);

  return (
    <div className="backdrop-blur-xl bg-[#06110b]/60 border border-white/5 rounded-3xl overflow-hidden shadow-2xl h-full flex flex-col relative group">
      <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/5 blur-[60px] rounded-full pointer-events-none transition-all group-hover:bg-cyan-500/10"></div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-cyan-500/10 rounded-lg sm:rounded-xl ring-1 ring-cyan-500/20 shadow-inner">
            <ScanLine size={16} className="text-cyan-400" />
          </div>
          <span className="font-bold text-white text-sm sm:text-base tracking-wide">Student Check-In</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-zinc-800/50 border border-zinc-700/40 px-2 py-1 rounded-full">
            <UserCheck size={11} className="text-cyan-400" />
            <span className="text-zinc-300 text-[10px] sm:text-xs font-semibold">{todayCount} today</span>
          </div>
          {isScanning && (
            <div className="flex items-center gap-1 sm:gap-1.5 bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-cyan-400 text-[10px] sm:text-xs font-bold tracking-wide">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Camera viewport ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 260, background: '#000' }}>
        {/* QR Reader — always in DOM */}
        <div id="qr-reader" style={{ width: '100%', minHeight: 260 }} />

        {/* Corner brackets overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute top-6 left-6 w-10 h-10 border-t-2 border-l-2 border-cyan-400 rounded-tl-md"></div>
            <div className="absolute top-6 right-6 w-10 h-10 border-t-2 border-r-2 border-cyan-400 rounded-tr-md"></div>
            <div className="absolute bottom-6 left-6 w-10 h-10 border-b-2 border-l-2 border-cyan-400 rounded-bl-md"></div>
            <div className="absolute bottom-6 right-6 w-10 h-10 border-b-2 border-r-2 border-cyan-400 rounded-br-md"></div>
          </div>
        )}

        {/* Animated scanning line */}
        {isScanning && (
          <div className="absolute inset-x-6 z-10 pointer-events-none overflow-hidden" style={{ top: '1.5rem', height: 'calc(100% - 3rem)' }}>
            <div
              className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80"
              style={{ animation: 'scanline 2s ease-in-out infinite' }}
            />
          </div>
        )}

        {/* Success / Warning overlay */}
        {scanResult && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 animate-fade-in">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ring-2 ring-offset-2 ring-offset-black ${scanResult.status === 'Already Scanned'
              ? 'bg-amber-500/20 ring-amber-500/30'
              : 'bg-emerald-500/20 ring-emerald-500/30'
              }`}>
              {scanResult.status === 'Already Scanned' ? (
                <AlertCircle className="w-9 h-9 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              )}
            </div>
            <p className="text-white font-bold text-lg">{scanResult.text}</p>
            <p className="text-zinc-400 text-xs mt-1 flex items-center gap-1">
              <Clock size={11} /> {scanResult.time}
            </p>
            <span className={`mt-2 px-3 py-0.5 rounded-full text-xs font-semibold ${scanResult.status === 'Present'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : scanResult.status === 'Already Scanned'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
              {scanResult.status}
            </span>
            <p className="text-zinc-600 text-[10px] mt-3 animate-pulse">Resuming in 3s…</p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 px-6 text-center animate-fade-in">
            <AlertCircle size={36} className="text-rose-500 mb-3" />
            <p className="text-rose-400 font-semibold text-sm mb-1">Camera Error</p>
            <p className="text-zinc-500 text-xs mb-4 max-w-xs">{error}</p>
            <button
              onClick={() => { setError(null); transitionLock.current = false; startScanning(); }}
              className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-sm rounded-lg border border-cyan-600/30 transition-all flex items-center gap-2"
            >
              <Camera size={14} /> Allow Camera & Retry
            </button>
          </div>
        )}

        {/* Stopped state */}
        {!isScanning && !scanResult && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 z-20">
            <ScanLine size={40} className="text-zinc-700" />
            <p className="text-zinc-500 text-sm">Scanner is paused</p>
            <button
              onClick={() => { transitionLock.current = false; startScanning(); }}
              className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-sm rounded-lg border border-cyan-600/30 transition-all flex items-center gap-2"
            >
              <Camera size={14} /> Start Scanning
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      {isScanning && (
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-black/40 border-t border-white/5 backdrop-blur-md relative z-10 shadow-inner">
          <p className="text-zinc-400 text-[11px] sm:text-xs font-medium tracking-wide">
            Scanning for <span className="text-white font-bold">QR codes</span> — hold steady
          </p>
          <button
            onClick={() => { stopScanning(); setError(null); setScanResult(null); }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]"
          >
            <StopCircle size={13} /> Stop
          </button>
        </div>
      )}

      {/* ── Recent Check-ins ── */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 flex-1 relative z-10 bg-gradient-to-b from-transparent to-black/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 sm:mb-4">Recent Check-ins</p>
        <div className="flex flex-col gap-2 sm:gap-3">
          {recentCheckins.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Clock size={22} className="text-zinc-600" />
              </div>
              <p className="text-zinc-400 text-sm font-semibold">No check-ins yet today</p>
            </div>
          ) : (
            recentCheckins.map((c, i) => (
              <div key={c.id || i} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-black/60 transition-colors shadow-inner group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/10 to-violet-500/5 flex items-center justify-center group-hover:from-cyan-500/20 group-hover:to-violet-500/10 transition-all flex-shrink-0 ring-1 ring-cyan-500/20 shadow-inner">
                    <span className="text-cyan-400 text-xs font-black shadow-sm">
                      {c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs sm:text-sm font-bold tracking-wide leading-tight group-hover:text-cyan-50 transition-colors truncate max-w-[120px] sm:max-w-none">{c.name}</p>
                    <p className="text-zinc-500 text-[11px] font-medium mt-1 tracking-tight flex items-center gap-1">{c.time}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase flex-shrink-0 ml-2 ${c.status === 'Present'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                  }`}>
                  {c.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
