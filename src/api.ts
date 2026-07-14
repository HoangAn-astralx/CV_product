/**
 * api.ts — Client gọi backend API (localhost:8000)
 * Map field tiếng Việt của backend → TypeScript types của FE
 */

import { Camera, Pipeline, AlertEvent } from './types';

const BASE = 'http://localhost:8000';

// ── Raw backend types ──────────────────────────────────────────────────────

interface ApiCamera {
  id: string;
  ten: string;
  rtsp_url: string;
  vi_tri: string | null;
  trang_thai: string;
  fps: number;
}

interface ApiPipeline {
  id: string;
  ten: string;
  camera_id: string;
  use_case_id: string;
  trang_thai: string;
  params: Record<string, unknown> | null;
}

interface ApiEvent {
  id: string;
  pipeline_id: string | null;
  camera_id: string | null;
  loai_su_kien: string;
  muc_do: string;
  chi_tiet: Record<string, unknown> | null;
  frame_path: string | null;
  tao_luc: string | null;
}

// ── Mappers ────────────────────────────────────────────────────────────────

export function mapCamera(c: ApiCamera): Camera {
  return {
    id: c.id,
    name: c.ten,
    location: c.vi_tri || '',
    type: 'retail',
    kind: 'ip',
    status: c.trang_thai === 'active' ? 'online' : 'offline',
    fps: c.fps,
    resolution: '1920x1080',
    latency: 100,
    site: 'Hà Nội',
    username: 'admin',
    password: '',
  };
}

export function mapPipeline(p: ApiPipeline): Pipeline {
  return {
    id: p.id,
    name: p.ten,
    cameraId: p.camera_id,
    detectorName: p.use_case_id || 'YOLO',
    countingZones: [],
    alertChannels: { zalo: false, email: false, telegram: false, webhook: false },
    isActive: p.trang_thai === 'running',
    createdAt: new Date().toISOString(),
  };
}

const EVENT_TYPE_MAP: Record<string, AlertEvent['type']> = {
  sec_intrusion: 'intrusion',
  intrusion: 'intrusion',
  count_alert: 'overlimit',
  overlimit: 'overlimit',
  safety_violation: 'safety_hazard',
  unusual_behavior: 'unusual_behavior',
};

export function mapEvent(e: ApiEvent): AlertEvent {
  const detail = e.chi_tiet as Record<string, unknown> | null;
  const message =
    (detail?.message as string) ||
    (detail?.mo_ta as string) ||
    e.loai_su_kien;
  return {
    id: e.id,
    timestamp: e.tao_luc || new Date().toISOString(),
    cameraName: e.camera_id || 'Camera',
    pipelineName: e.pipeline_id || 'Pipeline',
    type: EVENT_TYPE_MAP[e.loai_su_kien] || 'unusual_behavior',
    message,
    status: 'new',
    score: (detail?.score as number) || 90,
    snapshotUrl: undefined,
  };
}

// ── API functions ──────────────────────────────────────────────────────────

export async function fetchCameras(): Promise<Camera[]> {
  const res = await fetch(`${BASE}/cameras`);
  if (!res.ok) throw new Error('fetch cameras failed');
  const data: ApiCamera[] = await res.json();
  return data.map(mapCamera);
}

export async function fetchPipelines(): Promise<Pipeline[]> {
  const res = await fetch(`${BASE}/pipelines`);
  if (!res.ok) throw new Error('fetch pipelines failed');
  const data: ApiPipeline[] = await res.json();
  return data.map(mapPipeline);
}

export async function fetchEvents(limit = 50): Promise<AlertEvent[]> {
  const res = await fetch(`${BASE}/events?limit=${limit}`);
  if (!res.ok) throw new Error('fetch events failed');
  const data: ApiEvent[] = await res.json();
  return data.map(mapEvent);
}

// ── Detection types ────────────────────────────────────────────────────────────

export interface TrackBox {
  track_id: number;
  class_name: string;      // "person" | "car" | "motorcycle" | ...
  confidence: number;      // 0–1
  bbox_pct: [number, number, number, number]; // [x1%, y1%, x2%, y2%] — dùng cho CSS
  zone: string | null;
  in_zone: boolean;
}

export interface LatestDetection {
  tracks: TrackBox[];
  zone_counts: Record<string, number | { in: number; out: number; total: number }>;
  timestamp_ms: number;
}

/** Lấy kết quả detection mới nhất từ supervision. null nếu chưa có hoặc pipeline chưa chạy. */
export async function getLatestDetection(pipelineId: string): Promise<LatestDetection | null> {
  try {
    const res = await fetch(`${BASE}/pipelines/${pipelineId}/latest-detection`);
    if (!res.ok) return null;
    return await res.json() as LatestDetection;
  } catch {
    return null;
  }
}

/** Trả về presigned URL của frame mới nhất, null nếu chưa có. */
export async function getLatestFrame(pipelineId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/pipelines/${pipelineId}/latest-frame`);
    if (!res.ok) return null;
    const data = await res.json();
    const url = data.url as string;
    if (!url) return null;
    // Thêm cache-buster dùng frame_path để browser không cache ảnh cũ
    const bust = encodeURIComponent(data.frame_path || Date.now());
    return `${url}?t=${bust}`;
  } catch {
    return null;
  }
}

// use_case_id backend hợp lệ
const BACKEND_USE_CASES = new Set(['sec_intrusion', 'sec_crowd', 'tra_count']);

export async function createPipeline(body: {
  ten: string;
  camera_id: string;
  use_case_id: string;
  task_map_type: string;
  params?: Record<string, unknown>;
  fps?: number;
}): Promise<string> {
  const res = await fetch(`${BASE}/pipelines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ten: body.ten,
      camera_id: body.camera_id,
      use_case_id: BACKEND_USE_CASES.has(body.use_case_id) ? body.use_case_id : 'sec_intrusion',
      task_map_type: body.task_map_type || 'security',
      params: body.params || {},
      tracker: 'bytetrack',
      fps: body.fps ?? 5,
    }),
  });
  if (!res.ok) throw new Error(`createPipeline failed: ${res.status}`);
  const data = await res.json();
  return data.id as string;
}

export async function createZone(pipelineId: string, zone: {
  loai: 'polygon' | 'line';
  toa_do: { points: number[][] };
  nhan?: string;
}): Promise<void> {
  await fetch(`${BASE}/pipelines/${pipelineId}/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(zone),
  });
}

export async function startPipeline(pipelineId: string): Promise<void> {
  await fetch(`${BASE}/pipelines/${pipelineId}/start`, { method: 'PUT' });
}

export async function stopPipeline(pipelineId: string): Promise<void> {
  await fetch(`${BASE}/pipelines/${pipelineId}/stop`, { method: 'PUT' });
}

export async function getSnapshotUrl(eventId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/events/${eventId}/snapshot-url`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.url as string) || null;
  } catch {
    return null;
  }
}
