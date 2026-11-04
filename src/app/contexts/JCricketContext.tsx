import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  UserRole, 
  Provenance, 
  JCricketUserProfile,
  UserNotification,
  ReviewQueueItem,
  CollaborationStats,
  ConcurrentEditWarning
} from '../types/jcricket';
import { useAuth } from './AuthContext';
import { publicAnonKey } from '../../../utils/supabase/info';

interface JCricketContextType {
  userProfile: JCricketUserProfile | null;
  userRole: UserRole;
  currentProvenance: Provenance | null;
  availableProvenances: Provenance[];
  notifications: UserNotification[];
  reviewQueue: ReviewQueueItem[];
  collaborationStats: CollaborationStats | null;
  
  // Actions
  setCurrentProvenance: (provenance: Provenance) => void;
  loadUserProfile: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  loadReviewQueue: () => Promise<void>;
  loadCollaborationStats: () => Promise<void>;
  checkConcurrentEdits: (clusterId: string) => Promise<ConcurrentEditWarning | null>;
  updateLanguagePreferences: (languages: string[]) => Promise<void>;
}

const JCricketContext = createContext<JCricketContextType | undefined>(undefined);

export function JCricketProvider({ children }: { children: ReactNode }) {
  const { username, accessToken, isAuthenticated } = useAuth();
  const [userProfile, setUserProfile] = useState<JCricketUserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('basic_editor');
  const [currentProvenance, setCurrentProvenance] = useState<Provenance | null>(null);
  const [availableProvenances, setAvailableProvenances] = useState<Provenance[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [collaborationStats, setCollaborationStats] = useState<CollaborationStats | null>(null);

  const loadUserProfile = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/jcricket/profile`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUserProfile(data.profile);
        setUserRole(data.profile.role);
        
        // Load available provenances
        if (data.provenances) {
          setAvailableProvenances(data.provenances);
          if (data.provenances.length > 0) {
            setCurrentProvenance((prev) => prev || data.provenances[0]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  }, [accessToken]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/jcricket/notifications`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [accessToken]);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(
        `/api/jcricket/notifications/${notificationId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [accessToken]);

  const loadReviewQueue = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/jcricket/review-queue`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReviewQueue(data.queue || []);
      }
    } catch (error) {
      console.error('Failed to load review queue:', error);
    }
  }, [accessToken]);

  const loadCollaborationStats = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/jcricket/stats`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCollaborationStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load collaboration stats:', error);
    }
  }, [accessToken]);

  const checkConcurrentEdits = useCallback(async (clusterId: string): Promise<ConcurrentEditWarning | null> => {
    try {
      const response = await fetch(
        `/api/jcricket/cluster/${clusterId}/concurrent-edits`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.warning || null;
      }
      return null;
    } catch (error) {
      console.error('Failed to check concurrent edits:', error);
      return null;
    }
  }, [accessToken]);

  const updateLanguagePreferences = useCallback(async (languages: string[]) => {
    try {
      const response = await fetch(
        `/api/jcricket/profile/languages`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ languages }),
        }
      );

      if (response.ok) {
        setUserProfile(prev => prev ? {
          ...prev,
          proficientLanguages: languages,
        } : null);
      }
    } catch (error) {
      console.error('Failed to update language preferences:', error);
    }
  }, [accessToken]);

  // Load user profile when authenticated
  useEffect(() => {
    if (isAuthenticated && username) {
      loadUserProfile();
      loadNotifications();
      loadReviewQueue();
      loadCollaborationStats();
      
      // Set up periodic polling for notifications (every 30 seconds)
      const notificationInterval = setInterval(loadNotifications, 30000);
      return () => clearInterval(notificationInterval);
    }
  }, [isAuthenticated, username, loadUserProfile, loadNotifications, loadReviewQueue, loadCollaborationStats]);

  return (
    <JCricketContext.Provider
      value={{
        userProfile,
        userRole,
        currentProvenance,
        availableProvenances,
        notifications,
        reviewQueue,
        collaborationStats,
        setCurrentProvenance,
        loadUserProfile,
        loadNotifications,
        markNotificationAsRead,
        loadReviewQueue,
        loadCollaborationStats,
        checkConcurrentEdits,
        updateLanguagePreferences,
      }}
    >
      {children}
    </JCricketContext.Provider>
  );
}

export function useJCricket() {
  const context = useContext(JCricketContext);
  if (context === undefined) {
    throw new Error('useJCricket must be used within a JCricketProvider');
  }
  return context;
}
