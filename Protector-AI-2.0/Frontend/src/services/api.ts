import {
  SystemStatus,
  PPEStats,
  Incident,
  Camera,
  User,
  AuthUser,
  CameraWorkerStatus,
  AnalyticsData,
  TerminalResult,
  FaceProfile,
  FaceVisitLog,
  RecognizedPerson
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';
const TOKEN_KEY = 'protector_ai_token';

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {})
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errObj = JSON.parse(errorText);
      errorMessage = errObj.error || errObj.message || errorMessage;
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMessage);
  }

  return res.json();
}


export const api = {
  baseUrl: API_BASE,

  // Stream URL helper
  getVideoFeedUrl(cameraId = 'cam_01', conf = 0.35, targetClasses?: string[]): string {
    const params = new URLSearchParams({
      camera_id: cameraId,
      conf: conf.toString()
    });
    if (targetClasses && targetClasses.length > 0) {
      params.append('classes', targetClasses.join(','));
    }
    return `${API_BASE}/api/stream/video_feed?${params.toString()}`;
  },

  // Health & System
  async getHealth(): Promise<{ status: string; database: string; model_engine: string }> {
    return fetchJson('/api/system/health');
  },

  async getSystemStatus(): Promise<SystemStatus> {
    return fetchJson('/api/system/status');
  },

  async getModelInfo(): Promise<any> {
    return fetchJson('/api/inference/model_info');
  },

  // PPE & Incidents
  async getPPEStats(period = 'realtime'): Promise<PPEStats> {
    return fetchJson(`/api/ppe/stats?period=${period}`);
  },

  async getIncidents(params?: {
    query?: string;
    severity?: string;
    status?: string;
    category?: string;
    limit?: number;
  }): Promise<Incident[]> {
    const queryParams = new URLSearchParams();
    if (params?.query) queryParams.append('query', params.query);
    if (params?.severity && params.severity !== 'All') queryParams.append('severity', params.severity);
    if (params?.status && params.status !== 'All') queryParams.append('status', params.status);
    if (params?.category) queryParams.append('category', params.category);
    queryParams.append('limit', (params?.limit || 1000).toString());

    return fetchJson(`/api/incidents?${queryParams.toString()}`);
  },

  async getIncidentDetail(id: string): Promise<Incident> {
    return fetchJson(`/api/incidents/${id}`);
  },

  async updateIncident(id: string, data: { status?: string; notes?: string; assigned_to?: string }): Promise<Incident> {
    return fetchJson(`/api/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async deleteIncident(id: string, confirmed = false): Promise<any> {
    return fetchJson(`/api/incidents/${id}?confirmed=${confirmed}`, {
      method: 'DELETE'
    });
  },

  async captureSnapshot(cameraId = 'cam_01', conf = 0.35): Promise<{ success: boolean; snapshot_url: string; metrics: any }> {
    return fetchJson('/api/stream/snapshot', {
      method: 'POST',
      body: JSON.stringify({ camera_id: cameraId, conf })
    });
  },

  async detectFrame(blob: Blob, confidence = 0.35): Promise<{ success: boolean; annotated_url: string; metrics: any }> {
    const formData = new FormData();
    formData.append('image', blob, 'frame.jpg');
    formData.append('confidence', confidence.toString());

    const token = authStorage.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/api/inference/detect`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) {
      throw new Error(`Inference error: ${res.statusText}`);
    }
    return res.json();
  },

  // Cameras
  async getCameras(): Promise<Camera[]> {
    return fetchJson('/api/cameras');
  },

  async getCamera(id: string): Promise<Camera> {
    return fetchJson(`/api/cameras/${id}`);
  },



  // Team & People Management
  async getTeam(): Promise<{ users: User[]; permission_matrix: Record<string, string[]> }> {
    return fetchJson('/api/team');
  },

  async createTeamUser(data: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    role: 'Administrator' | 'Operator';
    phone_number?: string;
    password?: string;
  }): Promise<{ success: boolean; user: User }> {
    return fetchJson('/api/team/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTeamUser(userId: number, data: {
    role?: 'Administrator' | 'Operator';
    status?: 'Active' | 'Inactive';
    first_name?: string;
    last_name?: string;
    phone_number?: string;
  }): Promise<{ success: boolean; user: User }> {
    return fetchJson(`/api/team/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async deleteTeamUser(userId: number): Promise<{ success: boolean; message: string }> {
    return fetchJson(`/api/team/users/${userId}`, {
      method: 'DELETE'
    });
  },

  async cleanupTestUsers(): Promise<{ success: boolean; deleted_count: number; message: string }> {
    return fetchJson('/api/team/cleanup-test-users', {
      method: 'POST'
    });
  },

  // System Diagnostics & Maintenance
  async runSystemBenchmark(): Promise<{
    success: boolean;
    iterations: number;
    latency_ms: number;
    fps: number;
    device: string;
  }> {
    return fetchJson('/api/system/benchmark', {
      method: 'POST'
    });
  },

  async clearSystemCache(): Promise<{ success: boolean; message: string }> {
    return fetchJson('/api/system/maintenance/clear-cache', {
      method: 'POST'
    });
  },

  async vacuumDatabase(): Promise<{ success: boolean; message: string }> {
    return fetchJson('/api/system/maintenance/vacuum-db', {
      method: 'POST'
    });
  },

  // Analytics
  async getAnalytics(days = 7): Promise<AnalyticsData> {
    return fetchJson(`/api/analytics?days=${days}`);
  },

  // Terminal & Command Engine
  async executeTerminal(command: string, confirmed = false): Promise<TerminalResult> {
    return fetchJson('/api/terminal/execute', {
      method: 'POST',
      body: JSON.stringify({ command, confirmed })
    });
  },

  async getTerminalConversations(): Promise<Array<{ id: string; title: string; updated_at: string }>> {
    return fetchJson('/api/terminal/conversations');
  },

  async createTerminalConversation(): Promise<{ id: string; title: string; updated_at: string }> {
    return fetchJson('/api/terminal/conversations', { method: 'POST' });
  },

  async getTerminalConversationHistory(conversationId: string): Promise<{
    history: Array<{ id: string; command: string; timestamp: string; result: TerminalResult }>;
  }> {
    return fetchJson(`/api/terminal/conversations/${conversationId}/messages`);
  },

  async sendTerminalConversationMessage(conversationId: string, command: string): Promise<{
    id: string;
    command: string;
    timestamp: string;
    result: TerminalResult;
  }> {
    return fetchJson(`/api/terminal/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ command })
    });
  },

  async clearTerminalConversation(conversationId: string): Promise<{ success: boolean }> {
    return fetchJson(`/api/terminal/conversations/${conversationId}/messages`, { method: 'DELETE' });
  },

  // OpenRouter AI Neural Safety Engine
  async getOpenRouterStatus(): Promise<{
    provider: string;
    connected: boolean;
    masked_key: string;
    active_model: string;
    available_models: { id: string; name: string; tier: string }[];
  }> {
    return fetchJson('/api/openrouter/status');
  },

  async updateOpenRouterConfig(config: { api_key?: string; model?: string }): Promise<any> {
    return fetchJson('/api/openrouter/config', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  },

  async chatOpenRouter(params: {
    prompt: string;
    context?: any;
    model?: string;
    api_key?: string;
  }): Promise<{
    success: boolean;
    response?: string;
    model?: string;
    tokens?: number;
    elapsed_ms?: number;
    error?: string;
  }> {
    return fetchJson('/api/openrouter/chat', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async analyzeSceneOpenRouter(params: {
    camera_id: string;
    telemetry: any;
    model?: string;
    api_key?: string;
  }): Promise<{
    success: boolean;
    response?: string;
    model?: string;
    tokens?: number;
    elapsed_ms?: number;
    error?: string;
  }> {
    return fetchJson('/api/openrouter/analyze_scene', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async getPeople(): Promise<FaceProfile[]> {
    return fetchJson('/api/people');
  },

  async enrollPerson(params: {
    name: string;
    consent_recorded: boolean;
    images: string[];
  }): Promise<FaceProfile> {
    return fetchJson('/api/people', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async recognizePeople(image: string): Promise<{
    faces_detected: number;
    matches: RecognizedPerson[];
  }> {
    return fetchJson('/api/people/recognize', {
      method: 'POST',
      body: JSON.stringify({ image })
    });
  },

  async getPeopleVisitLogs(): Promise<FaceVisitLog[]> {
    return fetchJson('/api/people/logs');
  },

  async deletePerson(profileId: number): Promise<{ success: boolean; message: string }> {
    return fetchJson(`/api/people/${profileId}`, { method: 'DELETE' });
  },

  // ==========================================
  // AUTHENTICATION & RBAC
  // ==========================================
  async login(credentials: {
    username_or_email: string;
    password: string;
    role?: string;
  }): Promise<{ success: boolean; token: string; user: AuthUser }> {
    const res = await fetchJson<{ success: boolean; token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res.token) {
      authStorage.setToken(res.token);
    }
    return res;
  },

  async register(data: {
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    phone_number?: string;
    password: string;
    confirm_password: string;
  }): Promise<{ success: boolean; token: string; user: AuthUser; message?: string }> {
    const res = await fetchJson<{ success: boolean; token: string; user: AuthUser; message?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.token) {
      authStorage.setToken(res.token);
    }
    return res;
  },

  async getMe(): Promise<{ success: boolean; user: AuthUser }> {
    return fetchJson<{ success: boolean; user: AuthUser }>('/api/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      authStorage.clearToken();
    }
  },

  // ==========================================
  // PERSISTENT CAMERA MONITORING
  // ==========================================
  async startCameraWorker(cameraId = 'cam_01', deviceIndex?: number): Promise<{ success: boolean; message: string; status: CameraWorkerStatus }> {
    return fetchJson<{ success: boolean; message: string; status: CameraWorkerStatus }>(`/api/camera/${cameraId}/start`, {
      method: 'POST',
      body: JSON.stringify({ device_index: deviceIndex })
    });
  },

  async switchCameraDevice(cameraId = 'cam_01', deviceIndex: number): Promise<{ success: boolean; message: string; status: CameraWorkerStatus }> {
    return fetchJson<{ success: boolean; message: string; status: CameraWorkerStatus }>(`/api/camera/${cameraId}/switch_device`, {
      method: 'POST',
      body: JSON.stringify({ device_index: deviceIndex })
    });
  },

  async getHardwareCameraDevices(): Promise<{ devices: Array<{ index: number; name: string; available: boolean }>; active_device_index: number }> {
    return fetchJson<{ devices: Array<{ index: number; name: string; available: boolean }>; active_device_index: number }>('/api/camera/devices');
  },

  async stopCameraWorker(cameraId = 'cam_01'): Promise<{ success: boolean; message: string; status: CameraWorkerStatus }> {
    return fetchJson<{ success: boolean; message: string; status: CameraWorkerStatus }>(`/api/camera/${cameraId}/stop`, {
      method: 'POST'
    });
  },

  async getCameraWorkerStatus(cameraId = 'cam_01'): Promise<CameraWorkerStatus> {
    return fetchJson<CameraWorkerStatus>(`/api/camera/${cameraId}/status`);
  },

  async getAllCameraWorkerStatuses(): Promise<Record<string, CameraWorkerStatus>> {
    return fetchJson<Record<string, CameraWorkerStatus>>('/api/camera/statuses');
  },

  async releaseHardwareCamera(cameraId = 'cam_01'): Promise<{ success: boolean; message: string }> {
    return fetchJson<{ success: boolean; message: string }>('/api/camera/release', {
      method: 'POST',
      body: JSON.stringify({ camera_id: cameraId })
    });
  }
};
