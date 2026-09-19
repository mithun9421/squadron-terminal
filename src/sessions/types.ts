export type SessionKind = "shell" | "agent";

export type AgentState = "idle" | "thinking" | "runningTool" | "needsInput";

export interface SessionSummary {
  id: number;
  label: string;
  kind: SessionKind;
  agentState: AgentState | null;
  finished: boolean;
}
