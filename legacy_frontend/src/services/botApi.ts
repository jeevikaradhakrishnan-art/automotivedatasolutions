const API_BASE = "http://localhost:8000/api";

export type BotStatus = "idle" | "running" | "completed" | "error";

export interface BotSummary {
  id: string;
  name: string;
  description: string;
  status: BotStatus;
  log_count: number;
  output_count: number;
}

export interface BotStatusDetail {
  id: string;
  status: BotStatus;
  exit_code: number | null;
  log_count: number;
  recent_logs: string[];
  output_count: number;
}

export interface BotOutput {
  bot_id: string;
  status: BotStatus;
  records: Record<string, unknown>[];
  count: number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const botApi = {
  listBots: (): Promise<BotSummary[]> =>
    apiFetch("/bots"),

  runBot: (botId: string): Promise<{ ok: boolean; bot_id: string; status: string }> =>
    apiFetch(`/bots/${botId}/run`, { method: "POST" }),

  getStatus: (botId: string): Promise<BotStatusDetail> =>
    apiFetch(`/bots/${botId}/status`),

  getOutput: (botId: string): Promise<BotOutput> =>
    apiFetch(`/bots/${botId}/output`),

  /** Opens an SSE connection. Returns a cleanup function to close it. */
  streamLogs: (
    botId: string,
    onLine: (line: string) => void,
    onDone: (finalStatus: string) => void,
    onError: (err: Event) => void,
  ): (() => void) => {
    const es = new EventSource(`${API_BASE}/bots/${botId}/stream`);
    es.onmessage = (e) => onLine(e.data as string);
    es.addEventListener("done", (e) => {
      es.close();
      onDone((e as MessageEvent).data as string);
    });
    es.onerror = (e) => {
      es.close();
      onError(e);
    };
    return () => es.close();
  },
};
