export declare class HostError extends Error {
  readonly code: string;
  readonly status: number | undefined;
}

export interface HostSettings {
  get(key: string): Promise<unknown>;
  has(key: string): Promise<boolean>;
  list(): Promise<Record<string, unknown>>;
  /** Passing null removes the key. */
  set(key: string, value: unknown): Promise<{ key: string; stored: boolean }>;
}

export interface Host {
  readonly appId: string;
  readonly settings: HostSettings;
  readonly llm: { complete(params: Record<string, unknown>): Promise<unknown> };
  readonly session: { startTurn(params: Record<string, unknown>): Promise<unknown> };
  readonly approvals: { request(params: Record<string, unknown>): Promise<unknown> };
  readonly events: {
    next(params?: { after?: string; timeoutMs?: number }): Promise<{
      events: Array<{ id: string; type: 'turn.completed'; occurredAt: string; cwd: string }>;
      cursor: string | null;
      reset: boolean;
    }>;
  };
  notify(params: { title: string; body?: string }): Promise<unknown>;
  /** Escape hatch for methods added after this SDK version. */
  call(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface ConnectHostOptions {
  timeoutMs?: number;
}

/** Resolves to null when this process was not started by Cortex. */
export declare function connectHost(options?: ConnectHostOptions): Promise<Host | null>;
