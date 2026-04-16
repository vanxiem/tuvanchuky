
import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  db, 
  doc, 
  deleteDoc, 
  where,
  Timestamp,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { AnalysisHistoryRecord, UserProfile } from '../types';
import { translations, Language } from '../translations';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import Visualizations from './Visualizations';
import { 
  Download, Trash2, Eye, Filter, Search, Calendar, User, Building, 
  CheckCircle, AlertCircle, Clock, ChevronLeft, ChevronRight, X,
  BarChart3, PieChart as PieChartIcon, Table as TableIcon, FileText
} from 'lucide-react';

interface AdminDashboardProps {
  lang: Language;
  userProfile: UserProfile | null;
  onBack: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, userProfile, onBack }) => {
  const t = translations[lang];
  const [records, setRecords] = useState<AnalysisHistoryRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AnalysisHistoryRecord | null>(null);
  const [viewMode, setViewMode] = useState<'records' | 'users'>('records');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  useEffect(() => {
    const qRecords = query(collection(db, 'analysis_history'), orderBy('createdAt', 'desc'));
    const unsubscribeRecords = onSnapshot(qRecords, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AnalysisHistoryRecord[];
      setRecords(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      setError(err.message);
      handleFirestoreError(err, OperationType.GET, 'analysis_history');
    });

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      setUsers(data);
      setError(null);
    }, (err) => {
      setError(err.message);
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    return () => {
      unsubscribeRecords();
      unsubscribeUsers();
    };
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const matchesSearch = 
        record.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesDept = deptFilter === 'all' || record.department === deptFilter;
      const matchesUser = userFilter === 'all' || record.userEmail === userFilter;
      
      const recordDate = record.createdAt?.toDate ? record.createdAt.toDate() : new Timestamp(record.createdAt.seconds, record.createdAt.nanoseconds).toDate();
      const matchesDateFrom = !dateFrom || recordDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || recordDate <= new Date(dateTo + 'T23:59:59');
      
      return matchesSearch && matchesStatus && matchesDept && matchesUser && matchesDateFrom && matchesDateTo;
    });
  }, [records, searchTerm, statusFilter, deptFilter, userFilter, dateFrom, dateTo]);

  const filteredUsers = useMemo(() => {
    if (viewMode !== 'users') return [];
    return users.filter(user => 
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm, viewMode]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    records.forEach(r => { if (r.department) depts.add(r.department); });
    users.forEach(u => { if (u.department) depts.add(u.department); });
    return Array.from(depts);
  }, [records, users]);

  // Pagination logic
  const currentData = viewMode === 'records' ? filteredRecords : filteredUsers;
  const totalPages = Math.ceil(currentData.length / recordsPerPage);
  const paginatedData = currentData.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const handleViewUserHistory = (email: string) => {
    setUserFilter(email);
    setViewMode('records');
    setCurrentPage(1);
    setSearchTerm('');
  };
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayCount = records.filter(r => (r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt.seconds * 1000)) >= today).length;
    const weekCount = records.filter(r => (r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt.seconds * 1000)) >= weekAgo).length;
    const errorCount = records.filter(r => r.status === 'error').length;
    const uniqueUsers = new Set(records.map(r => r.userId)).size;
    
    const deptCounts: Record<string, number> = {};
    records.forEach(r => {
      if (r.department) deptCounts[r.department] = (deptCounts[r.department] || 0) + 1;
    });
    const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      total: records.length,
      users: uniqueUsers,
      today: todayCount,
      week: weekCount,
      errors: errorCount,
      topDept
    };
  }, [records]);

  // Chart Data
  const chartData = useMemo(() => {
    const dailyData: Record<string, number> = {};
    const statusData: Record<string, number> = { completed: 0, error: 0, processing: 0 };
    const deptData: Record<string, number> = {};

    records.forEach(r => {
      const dateStr = format(r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt.seconds * 1000), 'MM/dd');
      dailyData[dateStr] = (dailyData[dateStr] || 0) + 1;
      
      statusData[r.status] = (statusData[r.status] || 0) + 1;
      
      if (r.department) {
        deptData[r.department] = (deptData[r.department] || 0) + 1;
      }
    });

    return {
      daily: Object.entries(dailyData).map(([name, value]) => ({ name, value })).reverse().slice(-7),
      status: Object.entries(statusData).map(([name, value]) => ({ name, value })),
      dept: Object.entries(deptData).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)
    };
  }, [records]);

  const handleDelete = async (id: string) => {
    if (window.confirm(t.confirmDelete)) {
      try {
        await deleteDoc(doc(db, 'analysis_history', id));
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const exportCSV = () => {
    const headers = [
      'Time', 'User', 'Email', 'Department', 'Product', 'Machine Code', 'Status', 
      'Current Cycle', 'Suggested Cycle', 'Reduction (s)', 'Improvement (%)', 'Confirmed'
    ];
    const rows = filteredRecords.map(r => [
      format(r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm:ss'),
      r.userName,
      r.userEmail,
      r.department || '',
      r.productName || 'N/A',
      r.machineCode || '',
      r.status,
      r.inputCycle || 0,
      r.suggestedCycle || 0,
      r.reducedSeconds || 0,
      r.reducedPercent || 0,
      r.confirmed ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `analysis_history_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-bold text-white">{t.notAuthorized}</h2>
        <button onClick={onBack} className="bg-ai-accent text-white px-6 py-2 rounded-xl font-bold">
          {t.backToApp}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-500" />
            {t.adminDashboard}
          </h2>
          <p className="text-ai-text-muted text-sm mt-1">{t.usageHistory}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600/30 transition-all"
          >
            <Download className="w-4 h-4" />
            {t.exportCsv}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: t.totalAnalyses, value: stats.total, icon: FileText, color: 'blue' },
          { label: t.activeUsers, value: stats.users, icon: User, color: 'purple' },
          { label: t.todayAnalyses, value: stats.today, icon: Clock, color: 'emerald' },
          { label: t.weekAnalyses, value: stats.week, icon: Calendar, color: 'amber' },
          { label: t.errorAnalyses, value: stats.errors, icon: AlertCircle, color: 'red' },
          { label: t.topDepartment, value: stats.topDept, icon: Building, color: 'indigo' }
        ].map((stat, i) => (
          <div key={i} className="bg-ai-surface p-5 rounded-2xl border border-ai-border shadow-lg">
            <div className={`w-10 h-10 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ai-text-muted">{stat.label}</p>
            <p className="text-xl font-black text-white mt-1 truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-ai-surface p-6 rounded-3xl border border-ai-border shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            {t.statsByDay}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-ai-surface p-6 rounded-3xl border border-ai-border shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-emerald-500" />
            {t.statusRatio}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.status}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.status.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-ai-surface rounded-3xl border border-ai-border shadow-xl overflow-hidden">
        <div className="p-6 border-b border-ai-border space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex bg-ai-bg p-1 rounded-xl border border-ai-border self-start">
              <button 
                onClick={() => { setViewMode('records'); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  viewMode === 'records' ? 'bg-blue-600 text-white shadow-lg' : 'text-ai-text-muted hover:text-white'
                }`}
              >
                <TableIcon className="w-4 h-4" />
                {t.recordsTab}
              </button>
              <button 
                onClick={() => { setViewMode('users'); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  viewMode === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-ai-text-muted hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                {t.usersTab}
              </button>
            </div>
            
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ai-text-muted" />
              <input 
                type="text" 
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-ai-bg border border-ai-border rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {viewMode === 'records' && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-ai-text-muted uppercase tracking-widest ml-1">{t.filterByStatus}</label>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-ai-bg border border-ai-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">{t.all}</option>
                  <option value="completed">{t.completed}</option>
                  <option value="error">{t.errorStatus}</option>
                  <option value="processing">{t.processingStatus}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-ai-text-muted uppercase tracking-widest ml-1">{t.filterByDept}</label>
                <select 
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full bg-ai-bg border border-ai-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">{t.all}</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-ai-text-muted uppercase tracking-widest ml-1">{t.filterByUser}</label>
                <select 
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="w-full bg-ai-bg border border-ai-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">{t.all}</option>
                  {users.map(u => <option key={u.uid} value={u.email}>{u.displayName || u.email}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-ai-text-muted uppercase tracking-widest ml-1">{t.filterByDate} (From)</label>
                <input 
                  type="date" 
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-ai-bg border border-ai-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-ai-text-muted uppercase tracking-widest ml-1">{t.filterByDate} (To)</label>
                <input 
                  type="date" 
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-ai-bg border border-ai-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              {userFilter !== 'all' && (
                <div className="flex items-end">
                  <button 
                    onClick={() => setUserFilter('all')}
                    className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear User
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'records' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-ai-bg/50 border-b border-ai-border">
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.historyTime}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.user}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.department}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">Sản phẩm / Máy</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.status}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">Chu kỳ (Hiện tại/Đề xuất)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">Giảm (s / %)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ai-border">
                {paginatedData.length > 0 ? (paginatedData as AnalysisHistoryRecord[]).map((record) => (
                  <tr key={record.id} className="hover:bg-ai-accent/5 transition-all group">
                    <td className="px-6 py-4 text-xs text-ai-text-muted">
                      {format(record.createdAt?.toDate ? record.createdAt.toDate() : new Date(record.createdAt.seconds * 1000), 'MM/dd HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{record.userName}</span>
                        <span className="text-[10px] text-ai-text-muted">{record.userEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-ai-text-muted">{record.department || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-blue-300">{record.productName || 'N/A'}</span>
                        <span className="text-[10px] text-ai-text-muted">{record.machineCode || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest text-center ${
                          record.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                          record.status === 'error' ? 'bg-red-500/10 text-red-500' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          {record.status === 'completed' ? t.completed : record.status === 'error' ? t.errorStatus : t.processingStatus}
                        </span>
                        {record.confirmed && (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[8px] font-bold uppercase tracking-widest rounded-full text-center">
                            Confirmed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{record.inputCycle || 0}s</span>
                        <span className="text-ai-text-muted">→</span>
                        <span className="text-sm font-bold text-blue-400">{record.suggestedCycle || 0}s</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-emerald-400">-{record.reducedSeconds?.toFixed(1)}s</span>
                        <span className="text-[10px] text-emerald-500/70">{record.reducedPercent}% improvement</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => setSelectedRecord(record)}
                          className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-all"
                          title={t.viewDetail}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => record.id && handleDelete(record.id)}
                          className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all"
                          title={t.deleteRecord}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-ai-text-muted italic">
                      {t.noRecords}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-ai-bg/50 border-b border-ai-border">
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.user}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.department}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">Sản phẩm gần nhất</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">Giảm gần nhất</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.totalAnalysesUser}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.lastActive}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-ai-text-muted uppercase tracking-widest">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ai-border">
                {paginatedData.length > 0 ? (paginatedData as UserProfile[]).map((user) => {
                  const userRecords = records.filter(r => r.userId === user.uid);
                  const lastRecord = userRecords[0];
                  
                  return (
                    <tr key={user.uid} className="hover:bg-ai-accent/5 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-ai-border" referrerPolicy="no-referrer" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">{user.displayName}</span>
                            <span className="text-[10px] text-ai-text-muted">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-ai-text-muted">{user.department || '-'}</td>
                      <td className="px-6 py-4 text-xs font-bold text-blue-300">{lastRecord?.productName || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-400">
                        {lastRecord?.reducedSeconds ? `-${lastRecord.reducedSeconds.toFixed(1)}s` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-white">{userRecords.length}</td>
                      <td className="px-6 py-4 text-xs text-ai-text-muted">
                        {lastRecord ? format(lastRecord.createdAt?.toDate ? lastRecord.createdAt.toDate() : new Date(lastRecord.createdAt.seconds * 1000), 'MM/dd HH:mm') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleViewUserHistory(user.email)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-all text-[10px] font-bold uppercase tracking-widest"
                        >
                          <FileText className="w-3 h-3" />
                          {t.viewHistory}
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-ai-text-muted italic">
                      {t.noRecords}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-ai-border flex items-center justify-between">
            <p className="text-xs text-ai-text-muted">
              Showing {(currentPage - 1) * recordsPerPage + 1} to {Math.min(currentPage * recordsPerPage, currentData.length)} of {currentData.length}
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 rounded-lg border border-ai-border text-ai-text-muted disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-white px-3">
                {currentPage} / {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-lg border border-ai-border text-ai-text-muted disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-ai-surface w-full max-w-4xl max-height-[90vh] overflow-y-auto rounded-3xl border border-ai-border shadow-2xl">
            <div className="sticky top-0 bg-ai-surface p-6 border-b border-ai-border flex items-center justify-between z-10">
              <h3 className="text-xl font-black text-white tracking-tight">{t.analysisDetail}</h3>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-ai-accent/10 rounded-full transition-all">
                <X className="w-6 h-6 text-ai-text-muted" />
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <section>
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3">{t.user}</h4>
                    <div className="bg-ai-bg p-4 rounded-2xl border border-ai-border">
                      <p className="text-lg font-bold text-white">{selectedRecord.userName}</p>
                      <p className="text-sm text-ai-text-muted">{selectedRecord.userEmail}</p>
                      <p className="text-xs text-ai-text-muted mt-2">{t.department}: {selectedRecord.department || 'N/A'}</p>
                      <p className="text-xs text-ai-text-muted">{t.historyTime}: {format(selectedRecord.createdAt?.toDate ? selectedRecord.createdAt.toDate() : new Date(selectedRecord.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm:ss')}</p>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3">{t.inputData}</h4>
                    <div className="bg-ai-bg p-4 rounded-2xl border border-ai-border max-h-64 overflow-y-auto">
                      <pre className="text-[10px] text-emerald-400 font-mono whitespace-pre-wrap">
                        {selectedRecord.rawInputData}
                      </pre>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  {selectedRecord.machineImageUrl && (
                    <section>
                      <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3">{t.screenshotLabel}</h4>
                      <img 
                        src={selectedRecord.machineImageUrl} 
                        alt="Machine Screen" 
                        className="w-full rounded-2xl border border-ai-border shadow-lg"
                        referrerPolicy="no-referrer"
                      />
                    </section>
                  )}

                  <section>
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3">{t.optimizationReport}</h4>
                    <div className="bg-ai-bg p-4 rounded-2xl border border-ai-border space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-ai-text-muted uppercase tracking-widest">{t.currentCycle}</p>
                          <p className="text-xl font-bold text-white">{selectedRecord.inputCycle}s</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-ai-text-muted uppercase tracking-widest">{t.targetCycle}</p>
                          <p className="text-xl font-bold text-blue-400">{selectedRecord.suggestedCycle}s</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-ai-text-muted uppercase tracking-widest">Mức giảm (s)</p>
                          <p className="text-xl font-bold text-emerald-400">-{selectedRecord.reducedSeconds?.toFixed(1)}s</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-ai-text-muted uppercase tracking-widest">% Cải thiện</p>
                          <p className="text-xl font-bold text-emerald-400">{selectedRecord.reducedPercent}%</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-ai-border">
                        <p className="text-[10px] text-ai-text-muted uppercase tracking-widest mb-2">Báo cáo chi tiết</p>
                        <div className={`prose prose-sm ${lang === 'vi' || lang === 'vi-en' ? '' : 'prose-invert'} max-w-none text-ai-text`}>
                          <ReactMarkdown>{selectedRecord.fullAnalysis || selectedRecord.aiResultSummary}</ReactMarkdown>
                        </div>
                      </div>
                      
                      {selectedRecord.fullImprovementData && (
                        <div className="pt-8 border-t border-ai-border">
                          <p className="text-[10px] text-ai-text-muted uppercase tracking-widest mb-4">Biểu đồ & Bảng so sánh</p>
                          <div className="bg-ai-bg/50 rounded-2xl p-4 border border-ai-border">
                            <Visualizations 
                              data={JSON.parse(selectedRecord.rawInputData || '[]')} 
                              improvementData={selectedRecord.fullImprovementData} 
                              lang={lang} 
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-4 border-t border-ai-border">
                        <p className="text-[10px] text-ai-text-muted uppercase tracking-widest mb-2">{t.aiRecommendations}</p>
                        <ul className="space-y-2">
                          {(selectedRecord.aiRecommendations || []).map((rec, i) => (
                            <li key={i} className="text-xs text-ai-text flex gap-2">
                              <span className="text-blue-500 font-bold">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
