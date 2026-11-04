// JCricket Entity Management Type Definitions


/**
 * User Role Types
 */
export type UserRole = 'basic_editor' | 'advanced_editor' | 'reviewer' | 'admin';

/**
 * Cluster Status Types for Merge/Split Workflows
 */
export type ClusterStatus = 
  | 'SV'  // Saved - normal state
  | 'MD'  // Merge Destination
  | 'MS'  // Merge Source
  | 'RN'  // Review Needed
  | 'IN'  // Invalidated
  | 'SG'  // Split Giver
  | 'SR'; // Split Receiver

/**
 * Provenance - represents a contributing institution
 */
export interface Provenance {
  id: string;
  name: string;
  code: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Prism Facet - represents data from a single provenance
 */
export interface PrismFacet {
  provenanceId: string;
  provenanceName: string;
  properties: Record<string, any>;
  contributedAt: string;
  contributedBy: string;
  isLeader: boolean; // Determines which data is displayed by default
}

/**
 * Entity Cluster - multi-dimensional entity with provenance tracking
 */
export interface EntityCluster {
  '@id': string;
  '@type': string;
  clusterId: string;
  status: ClusterStatus;
  facets: PrismFacet[]; // Multiple facets from different provenances
  leaderFacet?: PrismFacet; // The facet currently displayed
  mergedProperties: Record<string, any>; // Consolidated view
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
  relatedClusters?: string[]; // IDs of related clusters
}

/**
 * Merge Operation
 */
export interface MergeOperation {
  id: string;
  destinationClusterId: string;
  sourceClusterIds: string[];
  selectedProperties: Record<string, any>; // Properties picked for destination
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  createdBy: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
}

/**
 * Split Operation
 */
export interface SplitOperation {
  id: string;
  giverClusterId: string;
  receiverClusterId: string;
  movedProperties: Record<string, any>; // Properties to move from giver to receiver
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  createdBy: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
}

/**
 * Entity Event Log Entry
 */
export type EventType = 
  | 'create'
  | 'edit'
  | 'merge'
  | 'split'
  | 'invalidate'
  | 'review_approve'
  | 'review_reject'
  | 'property_add'
  | 'property_update'
  | 'property_delete';

export interface EntityEventLog {
  id: string;
  eventType: EventType;
  clusterId: string;
  userId: string;
  username: string;
  provenanceId: string;
  provenanceName: string;
  changes: {
    field: string;
    oldValue?: any;
    newValue?: any;
    action: 'add' | 'update' | 'delete';
  }[];
  metadata?: Record<string, any>;
  timestamp: string;
  description: string;
}

/**
 * User Notification
 */
export type NotificationType = 
  | 'merge_review_requested'
  | 'split_review_requested'
  | 'review_approved'
  | 'review_rejected'
  | 'concurrent_edit_warning'
  | 'cluster_updated';

export interface UserNotification {
  id: string;
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  relatedClusterId?: string;
  relatedOperationId?: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

/**
 * User Profile with JCricket Settings
 */
export interface JCricketUserProfile {
  userId: string;
  username: string;
  email?: string;
  role: UserRole;
  provenanceId: string; // Primary institution
  provenances: string[]; // All institutions user has access to
  proficientLanguages: string[]; // For language filter feature
  preferences: {
    showAllLanguages: boolean;
    autoSaveEnabled: boolean;
    notificationsEnabled: boolean;
  };
  createdAt: string;
  lastLogin: string;
}

/**
 * Draft Entry for Batch Processing
 */
export interface DraftEntry {
  id: string;
  clusterId?: string;
  fieldName: string;
  freeTextValue: string;
  linkedEntityUri?: string;
  linkedEntityLabel?: string;
  status: 'draft' | 'linked' | 'validated';
  createdBy: string;
  createdAt: string;
  linkedAt?: string;
}

/**
 * Review Queue Item
 */
export interface ReviewQueueItem {
  id: string;
  operationType: 'merge' | 'split';
  operationId: string;
  clusterIds: string[];
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Concurrent Edit Warning
 */
export interface ConcurrentEditWarning {
  clusterId: string;
  currentEditors: {
    userId: string;
    username: string;
    editingSince: string;
  }[];
  lastModified: string;
  lastModifiedBy: string;
}

/**
 * Collaboration Statistics
 */
export interface CollaborationStats {
  totalClusters: number;
  clustersByProvenance: Record<string, number>;
  recentEdits: number;
  pendingReviews: number;
  mergesThisMonth: number;
  splitsThisMonth: number;
  activeEditors: number;
  topContributors: {
    userId: string;
    username: string;
    contributionCount: number;
  }[];
}
