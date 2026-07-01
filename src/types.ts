export interface Camera {
  id: string;
  name: string;
  location: string;
  type: 'retail' | 'warehouse' | 'parking' | 'conveyor';
  kind: 'ip' | 'onvif' | 'usb';
  status: 'online' | 'offline';
  fps: number;
  resolution: string;
  latency: number;
  site: 'Hà Nội' | 'TP.HCM' | 'Bình Dương';
  username: string;
  password: string;
}

export interface Detection {
  id: string;
  label: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  color: string;
  trackId: string;
}

export type PipelineStep = 'camera' | 'task' | 'mode' | 'config' | 'zone' | 'alert' | 'preview';

export interface CountingZone {
  id: string;
  name: string;
  type: 'zone' | 'line';
  points: { x: number; y: number }[];
  lineStart?: { x: number; y: number };
  lineEnd?: { x: number; y: number };
  count: number;
  inCount?: number;
  outCount?: number;
  maxLimit?: number;
}

export interface Pipeline {
  id: string;
  name: string;
  cameraId: string;
  detectorName: string;
  monitoringMode?: 'standard' | 'smart' | 'defect_detection';
  detectionTarget?: string;
  detectionRule?: string;
  searchScope?: 'whole_scene' | 'roi';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: Record<string, any>;
  searchQuery?: string;
  description?: string;
  countingZones: CountingZone[];
  alertChannels: {
    zalo: boolean;
    email: boolean;
    telegram: boolean;
    webhook: boolean;
  };
  scheduleStart?: string;
  scheduleEnd?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  timestamp: string;
  cameraName: string;
  pipelineName: string;
  type: 'intrusion' | 'overlimit' | 'unusual_behavior' | 'safety_hazard';
  message: string;
  status: 'new' | 'read' | 'processing' | 'closed';
  snapshotUrl?: string;
  score: number;
  note?: string;
  assignee?: string;
  handledAt?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  cameraId: string;
  pipelineId?: string;
  isActive: boolean;
  targetObject: string;
  condition: string;
  action: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  createdAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  cameraId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface StorageConfig {
  globalRetentionDays: number;
  totalQuotaGB: number;
  usedGB: number;
  cameraSettings: {
    cameraId: string;
    retentionDays: number;
  }[];
}
