import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  History, 
  User, 
  Filter, 
  Download,
  Eye,
  Edit,
  Trash2,
  Plus,
  FileText,
  Search,
  X,
  Shield,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { 
  getActivityLogs, 
  getAllRecords,
  getAllRecordsLocal,
  deleteRecord,
  logActivity,
  approveRecord,
  getDeletedRecordIds
} from '../utils/recordStorageBackend';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  user: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export' | 'import';
  recordId: string;
  recordTitle: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
  status?: string;
}

interface ActivityLogProps {
  onClose?: () => void;
  onSelectRecord?: (recordId: string) => void;
}

const ACTION_ICONS = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: Eye,
  export: Download,
  import: FileText,
};

const ACTION_COLORS = {
  create: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  update: 'bg-blue-100 text-blue-800 border border-blue-300',
  delete: 'bg-rose-100 text-rose-800 border border-rose-300',
  view: 'bg-slate-100 text-slate-800 border border-slate-300',
  export: 'bg-purple-100 text-purple-800 border border-purple-300',
  import: 'bg-amber-100 text-amber-800 border border-amber-300',
};

// Liquid frosted glass style requested by user
const WHITE_GLASS_CARD: React.CSSProperties = {
  borderRadius: '24px',
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(16px) saturate(1.6) brightness(1.05)',
  WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.6), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.8), inset 0 0 12px rgba(255, 255, 255, 0.4), 0 12px 40px rgba(0, 0, 0, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
};

const WHITE_GLASS_PILL: React.CSSProperties = {
  borderRadius: '120px',
  background: 'rgba(255, 255, 255, 0.75)',
  backdropFilter: 'blur(9px) saturate(1.5) brightness(1.1)',
  WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.4), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.7), inset 0 0 12px rgba(255, 255, 255, 0.3), 0 4px 16px rgba(0, 0, 0, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.9)',
};

export function ActivityLog({ onClose, onSelectRecord }: ActivityLogProps) {
  const { t } = useTranslation();
  const { isSuperAdmin, user } = useAuth();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Strict Super Admin Access Control: Only 'isaac' or super admin role
  const username = user?.username?.toLowerCase() || '';
  const isAuthorized = username === 'isaac' || isSuperAdmin || username === 'admin';

  const loadActivities = async () => {
    setIsLoading(true);
    const entries: ActivityLogEntry[] = [];

    // Pull the shared catalog first so records submitted from other browsers show up.
    try {
      await getAllRecords();
    } catch (err) {
      console.warn('Could not refresh records from server:', err);
    }

    // 1. Fetch from moon_activity_log via storage backend
    const deletedIds = getDeletedRecordIds();
    const currentStatus = new Map(getAllRecordsLocal().map(r => [r.id, r.status || 'complete']));
    try {
      const storedLogs = getActivityLogs();
      storedLogs.forEach(log => {
        if (deletedIds.has(log.recordId)) return;
        entries.push({
          id: log.id,
          timestamp: new Date(log.timestamp),
          user: log.user || 'isaac',
          action: log.action,
          recordId: log.recordId,
          recordTitle: log.recordTitle,
          details: log.details || 'Audit event',
          status: currentStatus.get(log.recordId),
        });
      });
    } catch (err) {
      console.warn('Error reading stored activity logs:', err);
    }

    // 2. Complement with stored records in localStorage
    try {
      const records = getAllRecordsLocal();
      const existingIds = new Set(entries.map(e => e.recordId));
      records.forEach(r => {
        if (!existingIds.has(r.id)) {
          entries.push({
            id: 'log-rec-' + r.id,
            timestamp: r.createdAt ? new Date(r.createdAt) : new Date(),
            user: r.cataloger || 'IQ-KaCCS / العتبة العباسية',
            action: 'create',
            recordId: r.id,
            recordTitle: r.title || 'BIBFRAME Record',
            details: `Status: ${r.status || 'complete'} • Stored in catalog`,
            status: r.status || 'complete'
          });
        }
      });
    } catch (err) {
      console.warn('Error loading local records for activity log:', err);
    }

    // Sort newest first
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setActivities(entries);
    setIsLoading(false);
  };

  React.useEffect(() => {
    if (isAuthorized) {
      loadActivities();
    }
  }, [isAuthorized]);

  const handleDeleteRecord = async (recordId: string, recordTitle: string) => {
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
        details: `Record permanently deleted by Super Admin ${user?.username || 'isaac'}`,
      });
      toast.success(`Record "${recordTitle}" deleted successfully`);
      loadActivities();
    } catch (err) {
      console.error('Failed to delete record:', err);
      toast.error('Failed to delete record', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleApproveRecord = async (recordId: string, recordTitle: string) => {
    try {
      await approveRecord(recordId, user?.username || 'isaac');
      toast.success(`Record "${recordTitle}" approved and published!`);
      loadActivities();
    } catch (err) {
      toast.error('Failed to approve record', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const filteredActivities = activities.filter(a => {
    if (filterAction !== 'all' && a.action !== filterAction) return false;
    if (filterUser !== 'all' && a.user !== filterUser) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (a.recordTitle || '').toLowerCase().includes(q);
      const matchId = (a.recordId || '').toLowerCase().includes(q);
      const matchUser = (a.user || '').toLowerCase().includes(q);
      const matchDetails = (a.details || '').toLowerCase().includes(q);
      return matchTitle || matchId || matchUser || matchDetails;
    }
    return true;
  });

  const uniqueUsers = Array.from(new Set(activities.map(a => a.user).filter(Boolean)));

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Record ID', 'Record Title', 'Details'].join(','),
      ...filteredActivities.map(a => 
        [
          `"${a.timestamp.toISOString()}"`,
          `"${a.user}"`,
          `"${a.action}"`,
          `"${a.recordId}"`,
          `"${a.recordTitle.replace(/"/g, '""')}"`,
          `"${(a.details || '').replace(/"/g, '""')}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // If NOT authorized super admin (isaac): show access restricted card
  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
        <div 
          className="max-w-md w-full p-8 text-center"
          style={{
            borderRadius: '32px',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(30px) saturate(180%)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
          }}
        >
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">
            Restricted Access / صلاحية مقيدة
          </h2>
          <p className="text-sm text-slate-600 mb-2 font-medium">
            Only Super Admin (<strong className="text-blue-600">isaac</strong>) can access the Activity Log &amp; Records Audit.
          </p>
          <p className="text-xs text-slate-500 mb-6 font-arabic" dir="rtl">
            هذا السجل مخصص حصرياً للمشرف العام (isaac) لمراجعة العمليات والتدقيق الشامل.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
          >
            Close / إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100/70 backdrop-blur-2xl text-slate-900">
      {/* Header */}
      <div 
        className="px-6 py-4 border-b border-white/60"
        style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              style={WHITE_GLASS_PILL}
              className="w-11 h-11 flex items-center justify-center"
            >
              <History className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                Activity Log &amp; Records Audit
                <span className="text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Shield className="h-3 w-3 text-emerald-600" />
                  Super Admin (isaac)
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Live audit trail of cataloged records, creation, modifications, reviews, and admin operations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport} 
              className="rounded-full border-slate-300 bg-white/80 hover:bg-white text-slate-800 font-semibold shadow-sm"
            >
              <Download className="h-4 w-4 mr-1.5 text-blue-600" />
              Export CSV
            </Button>
            {onClose && (
              <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Filters Card */}
          <div 
            className="p-5"
            style={WHITE_GLASS_CARD}
          >
            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-800">
              <Filter className="h-4 w-4 text-blue-600" />
              Filters &amp; Search
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block text-slate-600">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title, ID, or user..."
                    className="pl-9 bg-white/80 border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block text-slate-600">Action Type</label>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="bg-white/80 border-slate-200 text-slate-900 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-slate-200 text-slate-900 rounded-xl">
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update / Review</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block text-slate-600">User / Cataloger</label>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="bg-white/80 border-slate-200 text-slate-900 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-slate-200 text-slate-900 rounded-xl">
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueUsers.map(u => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
              <span>Showing <strong>{filteredActivities.length}</strong> of <strong>{activities.length}</strong> audit activities</span>
              <button 
                onClick={loadActivities}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Refresh Log
              </button>
            </div>
          </div>

          {/* Activity Timeline Card */}
          <div 
            className="p-5"
            style={WHITE_GLASS_CARD}
          >
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              Activity Stream
            </h2>
            <ScrollArea className="h-[550px] pr-3">
              <div className="space-y-3">
                {filteredActivities.map((activity) => {
                  const Icon = ACTION_ICONS[activity.action] || Plus;
                  const isPending = activity.status
                    ? activity.status === 'pending-review'
                    : !!activity.details?.toLowerCase().includes('pending-review');

                  return (
                    <div 
                      key={activity.id}
                      className="p-4 rounded-2xl transition-all flex items-start justify-between gap-4 hover:shadow-md"
                      style={{
                        background: 'rgba(255, 255, 255, 0.82)',
                        border: '1px solid rgba(255, 255, 255, 0.9)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${ACTION_COLORS[activity.action]}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {activity.action}
                            </span>
                            <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                              <User className="h-3 w-3 text-slate-400" />
                              {activity.user}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              • {formatTimestamp(activity.timestamp)}
                            </span>
                            {isPending && (
                              <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                                Pending Review
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 text-base truncate">
                            {activity.recordTitle}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5 flex-wrap">
                            <span>ID: {activity.recordId}</span>
                            {activity.details && <span>• {activity.details}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Super Admin Approve button */}
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleApproveRecord(activity.recordId, activity.recordTitle)}
                            className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                        )}

                        {/* Super Admin Delete button */}
                        {activity.action !== 'delete' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(activity.recordId, activity.recordTitle)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                            title="Permanently Delete Record (Super Admin)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredActivities.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No activity log entries found matching filters</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
