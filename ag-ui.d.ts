export interface AgUiInput {
  threadId: string;
  runId: string;
  messages: Array<Record<string, unknown>>;
  tools?: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }>;
}
export interface AgUiResult {
  text: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  selection: { provider: string; model: string; reasoning: string };
  events: Array<Record<string, unknown>>;
}
export declare function connectAgUi(): null | {
  appId: string;
  provider(): Promise<AgUiResult['selection']>;
  run(input: AgUiInput, options?: { signal?: AbortSignal; onEvent?: (event: Record<string, unknown>) => void }): Promise<AgUiResult>;
};
