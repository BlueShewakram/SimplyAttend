import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Clock, Loader2, Database, TrendingUp, UserCheck, UserX, Search, Download, CalendarDays, ArrowUpDown, BarChart3, Filter } from 'lucide-react';

export default function Dashboard() {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [dateFilter, setDateFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, uniqueStudents: 0, todayCount: 0 });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('attendance')
      .select('*')
      .order('created_at', { ascending: sortOrder === 'asc' });

    // Date filtering
    const now = new Date();
    if (dateFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte('created_at', startOfDay);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
      query = query.gte('created_at', monthAgo);
    }

    const { data, error: fetchErr } = await query.limit(200);

    if (fetchErr) {
      console.error(fetchErr);
      setError(`Could not load data. ${fetchErr.message}`);
    } else {
      setAttendanceLogs(data || []);
      calculateStats(data || []);
    }
    setLoading(false);
  }, [sortOrder, dateFilter]);

  function calculateStats(logs) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    let present = 0;
    let late = 0;
    const studentSet = new Set();
    let todayCount = 0;

    logs.forEach(log => {
      studentSet.add(log.student_id);
      const d = new Date(log.created_at);
      const h = d.getHours();
      const m = d.getMinutes();
      if (h < 8 || (h === 8 && m <= 15)) present++;
      else late++;
      if (log.created_at >= startOfDay) todayCount++;
    });

    setStats({
      total: logs.length,
      present,
      late,
      uniqueStudents: studentSet.size,
      todayCount,
    });
  }

  useEffect(() => {
    fetchLogs();

    // Real-time subscription
    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  const formatTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusFromTime = (isoString) => {
    if (!isoString) return 'Unknown';
    const d = new Date(isoString);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h < 8 || (h === 8 && m <= 15)) return 'Present';
    return 'Late';
  };

  // Filter by search term
  const filteredLogs = attendanceLogs.filter(log =>
    (log.student_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Export to CSV
  const handleExport = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Student ID', 'Date', 'Time', 'Status'];
    const rows = filteredLogs.map(log => [
      log.student_id || 'Unknown',
      formatDate(log.created_at),
      formatTime(log.created_at),
      getStatusFromTime(log.created_at),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { icon: BarChart3, label: 'Total Records', value: stats.total, color: 'cyan', bg: 'cyan' },
    { icon: UserCheck, label: 'On Time', value: stats.present, color: 'cyan', bg: 'cyan' },
    { icon: Clock, label: 'Late', value: stats.late, color: 'amber', bg: 'amber' },
    { icon: Users, label: 'Unique Students', value: stats.uniqueStudents, color: 'violet', bg: 'violet' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="backdrop-blur-xl bg-[#06110b]/60 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl hover:border-white/10 hover:bg-[#06110b]/80 transition-all duration-300 group hover:-translate-y-1 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-${bg}-500/10 blur-[40px] rounded-full group-hover:bg-${bg}-500/20 transition-all pointer-events-none`}></div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-${bg}-500/10 flex items-center justify-center group-hover:bg-${bg}-500/20 group-hover:scale-105 transition-all duration-300 ring-1 ring-${bg}-500/20 shadow-inner shadow-${bg}-500/10`}>
                <Icon size={16} className={`text-${color}-400 drop-shadow-md`} />
              </div>
              {label === 'Total Records' && stats.todayCount > 0 && (
                <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full font-bold uppercase tracking-wider backdrop-blur-md shadow-sm">
                  +{stats.todayCount}
                </span>
              )}
            </div>
            <p className={`text-${color}-400 font-black text-2xl sm:text-4xl leading-tight tracking-tight`}>{value}</p>
            <p className="text-zinc-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mt-1 sm:mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Main Table ── */}
      <div className="backdrop-blur-xl bg-[#06110b]/60 border border-white/5 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
        {/* Table Header */}
        <div className="p-4 sm:p-6 flex flex-col gap-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-cyan-500/10 rounded-lg sm:rounded-xl ring-1 ring-cyan-500/20 shadow-inner">
                <Users className="text-cyan-400" size={16} />
              </div>
              Attendance Records
            </h2>
            <p className="text-zinc-500 text-[10px] sm:text-xs font-semibold tracking-wide">
              {filteredLogs.length} REC{filteredLogs.length !== 1 ? 'S' : ''}
            </p>
          </div>
          {/* Controls row — wraps naturally on mobile */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search — full width on xs */}
            <div className="relative group flex-1 min-w-[140px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-cyan-400 transition-colors" />
              <input
                type="text"
                placeholder="Search student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 bg-black/40 border border-white/5 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 w-full transition-all shadow-inner"
              />
            </div>

            {/* Date filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 bg-black/40 border border-white/5 rounded-xl text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all cursor-pointer appearance-none shadow-inner"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            {/* Sort toggle */}
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="p-2 bg-black/40 border border-white/5 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-cyan-400 transition-colors shadow-inner"
              title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
            >
              <ArrowUpDown size={14} />
            </button>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-wide rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(34,211,238,0.05)] hover:shadow-[0_0_15px_rgba(34,211,238,0.15)]"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchLogs}
              className="px-3 py-2 bg-black/40 border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white rounded-xl transition-all text-xs font-bold tracking-wide shadow-inner"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p className="text-sm">Loading attendance records...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Database className="text-rose-500 mb-4 opacity-80" size={48} />
              <p className="text-rose-400 font-medium mb-2 text-sm">{error}</p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Confirm your attendance table has columns id, created_at, and student_id. If RLS is enabled, add explicit SELECT and INSERT policies.
              </p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                <Clock className="text-zinc-600" size={24} />
              </div>
              <p className="text-zinc-400 font-medium text-base">
                {searchTerm ? 'No matching records' : 'No scans yet'}
              </p>
              <p className="text-zinc-600 text-xs mt-2">
                {searchTerm ? 'Try a different search term' : 'Waiting for students to check in...'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="sticky top-0 bg-[#040b07]/80 backdrop-blur-xl z-10 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4">#</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4">Student</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Date</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4">Time</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLogs.map((log, idx) => {
                    const status = getStatusFromTime(log.created_at);
                    return (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-zinc-600 text-xs font-mono font-medium">
                          {sortOrder === 'desc' ? idx + 1 : filteredLogs.length - idx}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-3.5">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500/10 to-violet-500/5 flex items-center justify-center group-hover:from-cyan-500/20 group-hover:to-violet-500/10 transition-all flex-shrink-0 ring-1 ring-cyan-500/20 shadow-inner">
                              <span className="text-cyan-400 text-[10px] sm:text-xs font-black shadow-sm">
                                {(log.student_id || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-zinc-200 font-semibold text-xs sm:text-sm tracking-wide max-w-[100px] sm:max-w-none truncate">{log.student_id || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-zinc-400 text-xs font-medium hidden sm:table-cell">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-zinc-300 text-xs sm:text-sm font-mono tracking-tight">
                          {formatTime(log.created_at)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                          <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold tracking-wide uppercase ${
                            status === 'Present'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
