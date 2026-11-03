import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useThemeSafe } from '../hooks/useThemeSafe';
import { getThemeGradients } from '../utils/themeGradients';
import { getAllRecords, SavedRecord, deleteRecord, logActivity, approveRecord } from '../utils/recordStorageBackend';
import type { BIBFRAMERecord } from '../types/bibframe';
import { ActivityLog } from './ActivityLog';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { 
  LayoutDashboard,
  Trash2,
  History,
  TrendingUp,
  FileText,
  Users,
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Calendar,
  ArrowRight,
  Activity,
  Network,
  BookOpen,
  Sparkles,
  Star,
  Package,
  Database,
  Save,
  Palette,
  Zap,
  Globe,
  Shield,
  Layers,
  Upload,
  Search,
  Edit,
  Library,
  Download,
  Moon,
  LayoutGrid,
  Orbit,
  GitBranch,
  Brain,
  Server,
  ChevronDown,
  ChevronUp,
  Compass
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import moonLogoWhite from '../../assets/white.png';
import moonLogoBlack from '../../assets/black.png';
import '../../styles/glassmorphism.css';

// 3D Spline Scene from Login Screen
const SPLINE_SCENE_URL = 'https://my.spline.design/3ddesigntextcopycopy-ICjwUjRH9s8O1NCNqRAWjo5g-5OJ/';

// Glass Panel Level 1 (VisionOS Primary Floating Window)
const GLASS_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.58)',
  borderRadius: '28px',
  boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255, 255, 255, 0.78)',
};

// Liquid Glass Pill Style
const LIQUID_GLASS_PURPLE_REPLACEMENT: React.CSSProperties = {
  borderRadius: '9999px',
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.88) 0%, rgba(240, 245, 255, 0.65) 100%)',
  backdropFilter: 'blur(14px) saturate(180%)',
  WebkitBackdropFilter: 'blur(14px) saturate(180%)',
  boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(15, 23, 42, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.85)',
};

interface DashboardProps {
  onNavigate?: (view: string) => void;
  onLoadRecord?: (record: BIBFRAMERecord) => void;
}

interface Stat {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: any;
  gradient: string;
}

interface RecentRecord {
  id: string;
  title: string;
  type: string;
  timestamp: Date;
  status: 'complete' | 'draft' | 'needs-review' | 'pending-review';
  record?: BIBFRAMERecord;
}

export function Dashboard({ onNavigate, onLoadRecord }: DashboardProps) {
  const { t } = useTranslation();
  const { isAuthenticated, isSuperAdmin, user } = useAuth();
  const [showActivityLog, setShowActivityLog] = useState(false);
  const { themeStyle } = useTheme();
  const { moonEngineTheme } = useThemeSafe();
  const gradients = getThemeGradients(moonEngineTheme);
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [favoriteIds] = useState<string[]>(['author-finder', 'wolf-moon']);
  const [isQuickActionsFolded, setIsQuickActionsFolded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);

  // Load saved records from database
  useEffect(() => {
    loadRecords();
  }, []);

  
  const isIsaac = user?.username?.toLowerCase() === 'isaac' || isSuperAdmin || user?.username?.toLowerCase() === 'admin';

  const handleApproveRecord = async (e: React.MouseEvent, recordId: string, recordTitle: string) => {
    e.stopPropagation();
    try {
      await approveRecord(recordId, user?.username || 'isaac');
      toast.success(`Record "${recordTitle}" approved and added to official catalog!`);
      // Update local state
      setSavedRecords(prev => prev.map(r => r.id === recordId ? {
        ...r,
        status: 'complete',
        record: { ...r.record, metadata: { ...r.record?.metadata, status: 'complete' } as any }
      } : r));
    } catch (err) {
      console.error('Failed to approve record:', err);
      toast.error('Failed to approve record', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleDeleteRecord = async (e: React.MouseEvent, recordId: string, recordTitle: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete record "${recordTitle}"?`)) {
      return;
    }
    try {
      await deleteRecord(recordId);
      logActivity({
        user: user?.username || 'isaac',
        action: 'delete',
        recordId: recordId,
        recordTitle: recordTitle,
        details: `Record permanently deleted by admin ${user?.username || 'isaac'}`,
      });
      toast.success(`Record "${recordTitle}" deleted successfully`);
      await loadRecords();
    } catch (err) {
      console.error('Failed to delete record:', err);
      toast.error('Failed to delete record', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const loadRecords = async () => {
    try {
      const records = await getAllRecords();
      setSavedRecords(records);
      setRecordCount(records.length);
    } catch (error) {
      console.error('Error loading records from database:', error);
      setSavedRecords([]);
      setRecordCount(0);
    }
  };

  const stats: Stat[] = [
    { 
      label: t('totalRecords'), 
      value: recordCount.toString(), 
      change: 12, 
      trend: 'up',
      icon: Library,
      gradient: 'from-blue-500 via-blue-600 to-indigo-600'
    },
    { 
      label: t('today'), 
      value: savedRecords.filter(r => {
        const today = new Date();
        const recordDate = new Date(r.createdAt || '');
        return recordDate.toDateString() === today.toDateString();
      }).length.toString(), 
      change: 8, 
      trend: 'up',
      icon: Zap,
      gradient: 'from-cyan-500 via-blue-600 to-teal-600'
    },
    { 
      label: t('thisWeek'), 
      value: savedRecords.filter(r => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recordDate = new Date(r.createdAt || '');
        return recordDate >= weekAgo;
      }).length.toString(), 
      change: -5, 
      trend: 'down',
      icon: TrendingUp,
      gradient: 'from-emerald-500 via-teal-600 to-cyan-600'
    },
    { 
      label: t('pendingReview'), 
      value: savedRecords.filter(r => r.status === 'pending-review' || r.record?.metadata?.status === 'pending-review').length.toString(), 
      change: savedRecords.filter(r => r.status === 'pending-review' || r.record?.metadata?.status === 'pending-review').length, 
      trend: savedRecords.filter(r => r.status === 'pending-review' || r.record?.metadata?.status === 'pending-review').length > 0 ? 'up' : 'neutral',
      icon: AlertCircle,
      gradient: 'from-orange-500 via-amber-600 to-yellow-600'
    },
  ];

  const filteredSavedRecords = savedRecords.filter(record => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (record.title || '').toLowerCase();
    const id = (record.id || '').toLowerCase();
    const type = (record.resourceType || '').toLowerCase();
    const cataloger = (record.cataloger || '').toLowerCase();
    return title.includes(q) || id.includes(q) || type.includes(q) || cataloger.includes(q);
  });

  const displayedRecords = showAllRecords || searchQuery.trim()
    ? filteredSavedRecords
    : filteredSavedRecords.slice(0, 5);

  const recentRecords: RecentRecord[] = displayedRecords.map((record, index) => ({
    id: record.id || `record-${index}-${Date.now()}`,
    title: record.title || 'Untitled',
    type: record.record?.metadata?.catalogingInterface || record.resourceType || 'Moon Engine',
    timestamp: new Date(record.modifiedAt || record.createdAt || Date.now()),
    status: (record.status || record.record?.metadata?.status || 'complete') as any,
    record: record.record
  }));

  const mainActions = [
    { 
      id: 'author-finder', 
      label: 'AI AUTHOR FINDER 🇮🇶', 
      description: 'Gemini AI + Multi-Page Google Deep Search • Global Authority Federation & Bio Dossiers',
      icon: Sparkles, 
      action: 'author-finder', 
      gradient: 'from-blue-600 via-cyan-600 to-teal-700',
      iconBg: 'from-blue-400 to-cyan-600'
    },
    { 
      id: 'wolf-moon', 
      label: 'MOON', 
      description: '3D Spline Linked Data Studio • Full WEMI Ontology • Real W3C JSON-LD/Turtle • Triple Store Ready',
      icon: Moon, 
      action: 'wolf-moon', 
      gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
      iconBg: 'from-emerald-400 to-teal-600'
    },
  ];

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const handleLoadRecord = (record: BIBFRAMERecord) => {
    if (onLoadRecord) {
      onLoadRecord(record);
    }
  };

  const isFavorite = (id: string) => favoriteIds.includes(id);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-black text-white selection:bg-blue-500/30">
      
      {/* ===== 1. INTERACTIVE 3D SPLINE SCENE FROM LOGIN SCREEN ===== */}
      <div
        className="fixed inset-0 z-0 overflow-hidden pointer-events-auto"
        style={{ top: '-10%', height: '120%' }}
      >
        <iframe
          src={SPLINE_SCENE_URL}
          frameBorder="0"
          width="100%"
          height="100%"
          className="w-full h-full"
          title="Spline 3D Scene"
          allow="fullscreen; autoplay"
          style={{
            pointerEvents: 'auto',
            border: 'none',
            background: 'transparent'
          }}
        />
      </div>

      {/* ===== 2. FROSTED GLASS OVERLAY & MAIN DASHBOARD CONTENT ===== */}
      <div className="relative z-10 p-6 max-w-7xl mx-auto space-y-6 pointer-events-auto">
        
        {/* Glass Header */}
        <div className="p-8" style={GLASS_STYLE}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-white/40 rounded-3xl blur-xl opacity-60 animate-pulse" />
                <img src={moonLogoWhite} alt="Moon Logo" className="relative h-24 w-auto object-contain drop-shadow-[0_4px_16px_rgba(255,255,255,0.6)]" />
              </div>
              <div>
                <h1 className="text-5xl font-black tracking-tight" style={{ color: '#2d3748' }}>
                  {t('dashboard')}
                </h1>
                <p className="text-lg mt-2 font-medium" style={{ color: '#4a5568' }}>
                  Moon • BIBFRAME 3.0.1 Cataloging Platform
                </p>
              </div>
            </div>
            
            </div>
        </div>

        {/* Stats Grid - Glass Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="p-6 hover:scale-105 transition-all duration-500 group cursor-pointer"
                style={{
                  ...GLASS_STYLE,
                  animationName: 'fadeInUp',
                  animationDuration: '0.6s',
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'forwards',
                  animationDelay: `${index * 100}ms`
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="p-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                    style={{
                      borderRadius: '24px',
                      background: 'rgba(255, 255, 255, 0.28)',
                      backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
                      WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                      boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.6), inset 0 0 12px rgba(255, 255, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.75)',
                      color: '#1a202c',
                    }}
                  >
                    {stat.label === t('today') ? (
                      <div className="flex flex-col items-center justify-center w-8 h-8 text-[#1a202c]">
                        <div className="text-[12px] font-black leading-none mb-0.5 tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</div>
                        <div className="font-black leading-none text-[28px] font-[Antic_Didone]">{new Date().getDate()}</div>
                      </div>
                    ) : (
                      <Icon className="h-8 w-8 text-[#1a202c]" />
                    )}
                  </div>
                  {stat.change !== undefined && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ ...GLASS_STYLE, padding: '4px 8px', color: '#2d3748' }}>
                      {stat.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                      {stat.trend === 'down' && <TrendingUp className="h-3.5 w-3.5 rotate-180 text-rose-600" />}
                      {Math.abs(stat.change)}%
                    </div>
                  )}
                </div>
                <div className="text-sm font-semibold mb-2" style={{ color: '#4a5568' }}>{stat.label}</div>
                <div className="text-4xl font-black tracking-tight" style={{ color: '#1a202c' }}>
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== FAVORITE TOOLS ===== */}
        <div
          className="p-8"
          style={{
            ...GLASS_STYLE,
            border: '1px solid rgba(255, 215, 0, 0.4)',
            boxShadow: '0 8px 32px rgba(255, 215, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
          }}
        >
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className="p-4 flex items-center justify-center"
                style={{
                  borderRadius: '24px',
                  background: 'rgba(255, 255, 255, 0.28)',
                  backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
                  WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.6), inset 0 0 12px rgba(255, 255, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.75)',
                  color: '#1a202c',
                }}
              >
                <Star className="h-8 w-8 text-[#1a202c]" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight" style={{ color: '#2d3748' }}>Favorite Tools</h2>
                <p className="text-base mt-1 font-semibold" style={{ color: '#4a5568' }}>
                  2 tools ready for quick access
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {mainActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => onNavigate?.(action.action)}
                  className="group relative overflow-hidden transition-all duration-700 hover:scale-[1.02] active:scale-[0.98] focus:outline-none cursor-pointer flex flex-col justify-between"
                  style={{
                    animationName: 'fadeInUp',
                    animationDuration: '0.6s',
                    animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    animationFillMode: 'forwards',
                    animationDelay: `${index * 120}ms`,
                    opacity: 0,
                    minHeight: '280px',
                    borderRadius: '40px',
                    background: 'rgba(255, 255, 255, 0.28)',
                    backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
                    WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.6), inset 0 0 12px rgba(255, 255, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.12)',
                    border: '1.5px solid rgba(255, 255, 255, 0.85)',
                  }}
                >
                  {/* Top section: badge & central logo */}
                  <div className="relative z-10 w-full flex-1 flex flex-col">
                    {/* Top row */}
                    <div className="flex items-center justify-between p-6">
                      <span className="text-xs font-black text-[#1a202c]/70 tracking-widest px-3 py-1 rounded-full bg-white/40 border border-white/60">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="p-2 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-xs">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500 drop-shadow-sm" />
                      </div>
                    </div>

                    {/* Center: Moon Logo inside liquid glass container */}
                    <div className="flex-1 flex items-center justify-center py-4">
                      <div
                        className="p-6 rounded-[28px] flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-500"
                        style={{
                          background: 'rgba(255, 255, 255, 0.35)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.3), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.7), 0 8px 24px rgba(0, 0, 0, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.9)',
                        }}
                      >
                        <img src={moonLogoWhite} alt="Moon Logo" className="h-16 w-auto object-contain filter invert drop-shadow-md" />
                      </div>
                    </div>

                    {/* Bottom frosted glass panel */}
                    <div
                      className="mx-4 mb-4 p-5 rounded-[24px] flex items-center justify-between transition-all"
                      style={{
                        background: 'rgba(255, 255, 255, 0.45)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
                      }}
                    >
                      <h3 className="text-lg font-black text-[#1a202c] drop-shadow-xs">
                        {action.label}
                      </h3>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 hover:bg-white text-xs font-bold text-[#1a202c] shadow-sm border border-white/90 transition-all">
                        <span>Launch</span>
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Records - Glass Table */}
        <div className="p-8" style={GLASS_STYLE}>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div
                className="p-3.5 flex items-center justify-center"
                style={{
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.28)',
                  backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
                  WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.6), inset 0 0 12px rgba(255, 255, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.75)',
                  color: '#1a202c',
                }}
              >
                <Clock className="h-6 w-6 text-[#1a202c]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: '#2d3748' }}>
                  {showAllRecords || searchQuery ? 'All Records' : t('recentRecords')}
                  <span className="ml-2 text-sm font-semibold opacity-70">
                    ({filteredSavedRecords.length}{savedRecords.length !== filteredSavedRecords.length ? ` / ${savedRecords.length}` : ''})
                  </span>
                </h2>
                <p className="text-sm font-medium" style={{ color: '#4a5568' }}>
                  {showAllRecords || searchQuery ? 'Full catalog database' : 'Latest cataloged activity'}
                </p>
              </div>
            </div>

            {/* Controls: Search Bar + View All Button + Activity Log */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search input */}
              <div className="relative min-w-[260px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search records by title, ID..."
                  className="w-full pl-9 pr-7 py-2 text-xs font-semibold text-[#1a202c] placeholder-slate-600 transition-all outline-none"
                  style={{
                    borderRadius: '120px',
                    background: 'rgba(255, 255, 255, 0.28)',
                    backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
                    WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.6), inset 0 0 12px rgba(255, 255, 255, 0.25), 0 4px 14px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.75)',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-black text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View All Toggle Button */}
              <button
                type="button"
                onClick={() => setShowAllRecords(!showAllRecords)}
                className="hover:scale-105 active:scale-95 transition-all flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#1a202c] cursor-pointer shadow-md"
                style={{
                  borderRadius: '120px',
                  background: showAllRecords ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.28)',
                  backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
                  WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.6), inset 0 0 12px rgba(255, 255, 255, 0.25), 0 4px 14px rgba(0, 0, 0, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.75)',
                }}
              >
                <span>{showAllRecords ? 'Show Recent (5)' : `View All (${savedRecords.length})`}</span>
                <ArrowRight className={`h-3.5 w-3.5 transition-transform ${showAllRecords ? 'rotate-90' : ''}`} />
              </button>

              {/* Activity Log Button - Super Admin (isaac) only */}
              {isIsaac && (
                <button
                  type="button"
                  onClick={() => setShowActivityLog(true)}
                  className="hover:scale-105 active:scale-95 transition-all flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#1a202c] cursor-pointer shadow-md"
                  style={{
                    borderRadius: '120px',
                    background: 'rgba(255, 255, 255, 0.28)',
                    backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
                    WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.6), inset 0 0 12px rgba(255, 255, 255, 0.25), 0 4px 14px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.75)',
                  }}
                  title="Audit Log & Records Audit (Super Admin: isaac)"
                >
                  <History className="h-3.5 w-3.5 text-blue-600" />
                  <span>Audit Log</span>
                  <span className="text-[9px] font-mono uppercase bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full">isaac</span>
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {recentRecords.length > 0 ? recentRecords.map((record, index) => (
              <div
                key={record.id}
                onClick={() => record.record && handleLoadRecord(record.record)}
                className="p-6 rounded-2xl hover:scale-[1.01] transition-all duration-300 cursor-pointer group"
                style={{
                  ...GLASS_STYLE,
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.5s ease-out forwards'
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold transition-colors" style={{ color: '#1a202c' }}>
                        {record.title}
                      </h3>
                      <Badge className="border-black/10 bg-white/40 font-semibold" style={{ color: '#2d3748' }}>
                        {record.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium" style={{ color: '#4a5568' }}>
                      <span className="font-mono">{record.id}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimestamp(record.timestamp)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {record.status === 'pending-review' ? (
                      <span
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold"
                        style={{
                          borderRadius: '120px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#b45309',
                        }}
                      >
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        <span>Pending Review</span>
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-bold"
                        style={{
                          borderRadius: '120px',
                          background: 'rgba(255, 255, 255, 0.28)',
                          backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
                          WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
                          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.6), inset 0 0 12px rgba(255, 255, 255, 0.25), 0 4px 14px rgba(0, 0, 0, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.75)',
                          color: '#1a202c',
                        }}
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Complete</span>
                      </span>
                    )}

                    {/* Approve button for Super Admin (isaac) */}
                    {isIsaac && record.status === 'pending-review' && (
                      <button
                        type="button"
                        onClick={(e) => handleApproveRecord(e, record.id, record.title)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold flex items-center gap-1 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Approve as Super Admin"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve</span>
                      </button>
                    )}
                    
                    <button
                        type="button"
                        onClick={(e) => handleDeleteRecord(e, record.id, record.title)}
                        className="p-2 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Remove Record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-all" style={{ color: '#2d3748' }} />
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-16">
                <div className="inline-block p-6 rounded-3xl bg-white/40 border border-white/60 mb-4 shadow-sm">
                  <FileText className="h-16 w-16" style={{ color: '#4a5568', opacity: 0.5 }} />
                </div>
                <p className="mb-4 font-semibold text-lg" style={{ color: '#2d3748' }}>{t('noRecordsFound')}</p>
                <button
                  onClick={() => onNavigate?.('wolf-moon')}
                  className="px-8 py-4 text-lg font-bold hover:scale-105 transition-transform cursor-pointer"
                  style={{ ...GLASS_STYLE, color: '#1a202c' }}
                >
                  <FileText className="h-5 w-5 mr-2 inline" />
                  {t('createNewRecord')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Log Modal */}
      {showActivityLog && (
        <ActivityLog
          onClose={() => setShowActivityLog(false)}
          onSelectRecord={(recId) => {
            setShowActivityLog(false);
            if (onLoadRecord) {
              const r = savedRecords.find(x => x.id === recId);
              if (r) onLoadRecord(r.record);
            }
          }}
        />
      )}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
