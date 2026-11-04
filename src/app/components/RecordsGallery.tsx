import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllRecords, deleteRecord, SavedRecord } from '../utils/recordStorageBackend';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { BookOpen, Calendar, User, FileType, Trash2, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface RecordsGalleryProps {
  onLoadRecord?: (record: SavedRecord) => void;
  onEditRecord?: (record: SavedRecord) => void;
  onViewRecord?: (record: SavedRecord) => void;
}

export function RecordsGallery({ onLoadRecord, onEditRecord, onViewRecord }: RecordsGalleryProps) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const allRecords = await getAllRecords();
      // Sort by modified date, newest first
      allRecords.sort((a, b) => 
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      );
      setRecords(allRecords);
    } catch (error) {
      console.error('Error loading records:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      await deleteRecord(id);
      setRecords(records.filter(r => r.id !== id));
      toast.success('Record deleted successfully');
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Failed to delete record', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleImageError = (recordId: string) => {
    setImageErrors(prev => new Set(prev).add(recordId));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('loading')}...</p>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('noRecordsFound')}</h3>
          <p className="text-muted-foreground">Start cataloging to see your records here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            {t('allRecords')} / جميع السجلات
          </h2>
          <p className="text-muted-foreground">
            {records.length} {t('recordsFound')}
          </p>
        </div>
        <Button onClick={loadRecords} variant="outline">
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {records.map((record) => (
          <Card key={record.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            {/* Cover Image */}
            <div className="relative h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              {record.coverImage && !imageErrors.has(record.id) ? (
                <img
                  src={record.coverImage}
                  alt={record.title}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(record.id)}
                />
              ) : (
                <BookOpen className="h-16 w-16 text-white opacity-50" />
              )}
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {record.record?.metadata?.catalogingInterface || record.resourceType || 'Moon Engine'}
              </div>
            </div>

            {/* Record Info */}
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-2 line-clamp-2 min-h-[3.5rem]">
                {record.title}
              </h3>

              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                {record.cataloger && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="truncate">{record.cataloger}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(record.modifiedAt)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <FileType className="h-4 w-4" />
                  <span className="text-xs">{record.record?.metadata?.catalogingInterface || record.resourceType || 'Moon Engine'}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {onLoadRecord && (
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    onClick={() => onLoadRecord(record)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    {t('edit')}
                  </Button>
                )}
                
                {onViewRecord && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewRecord(record)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(record.id, record.title)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
