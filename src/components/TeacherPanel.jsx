import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Phone, MapPin, BadgeCheck, Monitor, Clock, CalendarDays, Users, TrendingUp, RefreshCw } from 'lucide-react';

// Teacher info — this stays constant (could be fetched from a teachers table later)
const TEACHER = {
  initials:   'BS',
  name:       'Blue Shewakram',
  title:      'Instructor',
  department: 'College of Information Technology',
  contact: [
    { icon: Mail,       label: 'Email',       value: 'blue.shewakram@university.edu' },
    { icon: Phone,      label: 'Contact',     value: '+63 912 345 6789'              },
    { icon: MapPin,     label: 'Office',      value: 'Room 304, IT Building'         },
    { icon: BadgeCheck, label: 'Employee ID', value: 'EMP-2026-00101'               },
  ],
  session: {
    subject:  'IT 311 — Web Systems',
    section:  'Section 3B · Room 204',
    time:     '8:00 – 9:30 AM',
  },
};

export default function TeacherPanel() {
  const [attendance, setAttendance] = useState({ present: 0, late: 0, total: 0 });
  const [totalSessions, setTotalSessions] = useState(0);
  const [avgRate, setAvgRate] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  const fetchAttendanceData = useCallback(async () => {
    setIsRefreshing(true);

    // Fetch today's attendance logs
    const { data: todayLogs, error: todayErr } = await supabase
      .from('attendance')
      .select('*')
      .gte('created_at', startOfDay)
      .order('created_at', { ascending: false });

    if (!todayErr && todayLogs) {
      let present = 0;
      let late = 0;
      todayLogs.forEach(log => {
        const d = new Date(log.created_at);
        const h = d.getHours();
        const m = d.getMinutes();
        if (h < 8 || (h === 8 && m <= 15)) {
          present++;
        } else {
          late++;
        }
      });
      setAttendance({ present, late, total: todayLogs.length });
    }

    // Fetch all-time stats
    const { count: totalCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true });

    if (totalCount !== null) {
      // Estimate sessions based on distinct dates
      const { data: allLogs } = await supabase
        .from('attendance')
        .select('created_at')
        .order('created_at', { ascending: false });

      if (allLogs) {
        const uniqueDays = new Set(allLogs.map(l => new Date(l.created_at).toDateString()));
        setTotalSessions(uniqueDays.size);
        // Average check-ins per session
        const avg = uniqueDays.size > 0 ? Math.round((totalCount / uniqueDays.size) * 2.5) : 0;
        setAvgRate(Math.min(avg, 100));
      }
    }

    setIsRefreshing(false);
  }, [startOfDay]);

  useEffect(() => {
    fetchAttendanceData();

    // Real-time subscription
    const channel = supabase
      .channel('teacher_panel_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, () => {
        fetchAttendanceData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAttendanceData]);

  const { present, late, total } = attendance;
  const absent = Math.max(0, 40 - total); // Assuming class size of 40
  const classSize = 40;
  const progressPct = Math.round((total / classSize) * 100);

  const stats = [
    { label: 'Sessions',  value: totalSessions || '—' },
    { label: 'Avg. Rate', value: avgRate > 0 ? `${avgRate}%` : '—' },
    { label: 'Today',     value: total },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Profile Card ── */}
      <div className="backdrop-blur-xl bg-[#06110b]/60 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] rounded-full pointer-events-none"></div>
        {/* Avatar row */}
        <div className="flex items-center gap-4 sm:gap-5 mb-5 sm:mb-6 relative z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-black text-xl sm:text-2xl font-black shadow-[0_0_20px_rgba(34,211,238,0.3)] ring-2 ring-cyan-400/50 flex-shrink-0">
            {TEACHER.initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-base sm:text-lg leading-tight truncate">{TEACHER.name}</h2>
            <p className="text-cyan-400 text-xs sm:text-sm font-medium">{TEACHER.title}</p>
            <p className="text-zinc-500 text-[10px] sm:text-xs mt-0.5 leading-snug">{TEACHER.department}</p>
          </div>
        </div>

        {/* Quick stats (real data) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-6 relative z-10">
          {stats.map((s) => (
            <div key={s.label} className="bg-black/40 border border-white/5 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-2 sm:px-3 text-center shadow-inner group hover:bg-black/60 transition-colors">
              <p className="text-cyan-400 font-black text-lg sm:text-xl leading-tight group-hover:scale-105 transition-transform">{s.value}</p>
              <p className="text-zinc-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Contact details */}
        <div className="flex flex-col gap-2 sm:gap-2.5">
          {TEACHER.contact.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={13} className="text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-zinc-500 text-[10px] uppercase tracking-wide leading-none">{label}</p>
                <p className="text-zinc-200 text-xs sm:text-sm font-medium mt-0.5 break-all">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Current Session ── */}
      <div className="backdrop-blur-xl bg-[#06110b]/60 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-[50px] rounded-full group-hover:bg-violet-500/10 transition-all pointer-events-none"></div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 sm:mb-4 relative z-10">Current Session</p>

        {/* Subject row */}
        <div className="flex items-center gap-3 sm:gap-4 bg-black/40 border border-white/5 shadow-inner rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 mb-4 sm:mb-5 relative z-10">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20 flex items-center justify-center flex-shrink-0 shadow-inner">
            <Monitor size={14} className="text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-xs sm:text-sm leading-tight">{TEACHER.session.subject}</p>
            <p className="text-zinc-400 text-[10px] sm:text-xs mt-0.5">{TEACHER.session.section}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 gap-2 mb-2 sm:mb-3">
          <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-400 text-[10px] sm:text-xs">
            <Clock size={12} className="text-cyan-500/70 flex-shrink-0" />
            <span className="truncate">{TEACHER.session.time}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-400 text-[10px] sm:text-xs">
            <CalendarDays size={12} className="text-cyan-500/70 flex-shrink-0" />
            <span className="truncate">{dateStr}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-400 text-[10px] sm:text-xs">
          <Users size={12} className="text-cyan-500/70" />
          {classSize} students enrolled
        </div>
      </div>

      {/* ── Today's Attendance (REAL DATA) ── */}
      <div className="backdrop-blur-xl bg-[#06110b]/60 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full group-hover:bg-cyan-500/10 transition-all pointer-events-none"></div>
        <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Today's Attendance</p>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchAttendanceData} 
              className="text-zinc-600 hover:text-cyan-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <span className="text-cyan-400 font-bold text-xs sm:text-sm">{total} / {classSize}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-3 sm:mb-4">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center">
          <div>
            <p className="text-cyan-400 font-bold text-lg sm:text-xl leading-tight">{present}</p>
            <p className="text-zinc-500 text-[10px] sm:text-[11px] mt-0.5">Present</p>
          </div>
          <div>
            <p className="text-amber-400 font-bold text-lg sm:text-xl leading-tight">{late}</p>
            <p className="text-zinc-500 text-[10px] sm:text-[11px] mt-0.5">Late</p>
          </div>
          <div>
            <p className="text-rose-400 font-bold text-lg sm:text-xl leading-tight">{absent}</p>
            <p className="text-zinc-500 text-[10px] sm:text-[11px] mt-0.5">Absent</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg sm:text-xl leading-tight">{classSize}</p>
            <p className="text-zinc-500 text-[10px] sm:text-[11px] mt-0.5">Total</p>
          </div>
        </div>
      </div>

      {/* ── Live Clock ── */}
      <LiveClock />
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const periodLabel = time.getHours() < 12 ? 'Morning Session' : time.getHours() < 17 ? 'Afternoon Session' : 'Evening';

  return (
    <div className="backdrop-blur-xl bg-[#06110b]/60 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl text-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-cyan-500/5 blur-[40px] rounded-full pointer-events-none"></div>
      <p className="text-cyan-400 font-black text-2xl sm:text-3xl tracking-widest font-mono drop-shadow-md relative z-10">{timeStr}</p>
      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1 sm:mt-1.5 relative z-10">{periodLabel}</p>
    </div>
  );
}
