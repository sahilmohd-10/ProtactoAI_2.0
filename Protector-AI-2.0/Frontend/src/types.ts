export interface AuthUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone_number?: string;
  role: 'Administrator' | 'Operator';
  avatar?: string;
  status: 'Active' | 'Inactive';
  last_active?: string;
  created_at?: string;
}

export interface CameraWorkerStatus {
  camera_id: string;
  status: 'Stopped' | 'Starting' | 'Running' | 'Stopping' | 'Disconnected' | 'Error';
  error_message?: string;
  uptime_seconds: number;
  start_time?: string;
  frames_analyzed: number;
  violations_detected: number;
  metrics?: {
    workers: number;
    violations: number;
    compliant: number;
    compliance_rate: number;
    detections: DetectionBox[];
    timestamp: number;
  };
  has_live_feed: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Safety Manager' | 'Site Supervisor' | 'Auditor' | 'Lead Safety Engineer' | 'Administrator' | 'Operator';
  avatar?: string;
  status: 'Active' | 'Inactive';
  last_active?: string;
  created_at?: string;
}


export interface Camera {
  id: string;
  name: string;
  location: string;
  stream_source: string;
  status: 'online' | 'offline' | 'maintenance';
  resolution: string;
  fps: number;
  current_workers: number;
  current_violations: number;
  current_compliance: number;
  last_seen?: string;
}

export interface RecognizedPerson {
  person_id?: number;
  name: string;
  box: [number, number, number, number];
  distance?: number;
  new_visit?: boolean;
}

export interface FaceProfile {
  id: number;
  name: string;
  created_at: string | null;
  last_seen_at: string | null;
  visit_count: number;
}

export interface FaceVisitLog {
  id: number;
  person_id: number;
  name: string;
  recognized_at: string | null;
  camera_source: string;
}

export interface Zone {
  id: string;
  name: string;
  description: string;
  required_ppe: string[];
  risk_level: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Normal' | 'Warning' | 'Breach';
  active_workers: number;
  breach_count: number;
  created_at?: string;
}

export interface DetectionBox {
  label: string;
  confidence: number;
  box: [number, number, number, number];
  is_violation: boolean;
  is_compliant: boolean;
}

export interface Incident {
  id: string;
  title: string;
  category: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Review' | 'Acknowledged' | 'Resolved';
  location: string;
  camera_id: string;
  worker_id: string;
  timestamp: string;
  snapshot_url: string;
  bounding_boxes: DetectionBox[];
  assigned_to: string;
  resolution_notes: string;
  resolved_at?: string;
}

export interface SystemStatus {
  system: string;
  status: string;
  uptime_seconds: number;
  cpu_percent: number;
  memory_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  model_status: string;
  model_path: string;
  model_device: string;
  model_classes: number;
  cameras_online: string;
  open_incidents_count: number;
}

export interface PPEStats {
  period: string;
  compliance_rate: number;
  active_workers_monitored: number;
  active_violations: number;
  open_incidents_breakdown: {
    missing_hardhat: number;
    missing_vest: number;
    missing_mask: number;
    missing_gloves: number;
    zone_breach: number;
  };
  target_ppe: string[];
}

export interface DailyMetric {
  id: number;
  date: string;
  compliance_rate: number;
  total_workers: number;
  total_violations: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
}

export interface AnalyticsData {
  historical_metrics: DailyMetric[];
  category_distribution: Record<string, number>;
  hourly_distribution: Array<{ hour: string; count: number }>;
  average_compliance: number;
}

export interface TerminalResult {
  type: 'text' | 'table' | 'metric_card' | 'status_card' | 'navigation' | 'report' | 'theme_switch' | 'clear' | 'error' | 'ai_response';
  title?: string;
  output?: string;
  columns?: string[];
  rows?: any[][];
  data?: any;
  target?: string;
  theme?: 'dark' | 'light' | 'system';
  suggested_commands?: string[];
}

export interface CopilotToolExecution {
  tool: string;
  args: Record<string, any>;
  duration_ms: number;
  success: boolean;
  requires_confirmation?: boolean;
}

export interface CopilotCard {
  type: string;
  title?: string;
  value?: string;
  subtext?: string;
  items?: any[];
  content?: string;
  filename?: string;
  target?: string;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  content: string;
  tools_executed?: CopilotToolExecution[];
  cards?: CopilotCard[];
  provider?: string;
  pending_action?: { tool: string; args: any };
  requires_confirmation?: boolean;
}
