"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { getApiBase, CONFIG } from "@/lib/config";
import type {
  MissionControlState,
  ChatMessage,
  ToolCall,
  AgentStatus,
  LCMState,
  Session,
} from "@/lib/types";
import type { WSEvent } from "@/lib/ws-events";

type Action =
  | { type: "SET_CONNECTED"; connected: boolean; reconnecting: boolean }
  | { type: "SET_STATUS"; status: AgentStatus }
  | { type: "SET_SESSIONS"; sessions: Session[] }
  | { type: "SET_ACTIVE_SESSION"; sessionId: string }
  | { type: "ADD_MESSAGE"; message: ChatMessage }
  | { type: "SET_MESSAGES"; messages: ChatMessage[] }
  | { type: "STREAM_DELTA"; content: string; messageId: string }
  | { type: "STREAM_DONE"; messageId: string }
  | { type: "TOOL_START"; call: ToolCall }
  | { type: "TOOL_END"; callId: string; success: boolean; result?: string; error?: string; latencyMs: number }
  | { type: "SET_LCM"; lcm: LCMState }
  | { type: "SET_SENTINEL"; sentinel: MissionControlState["sentinel"] }
  | { type: "SET_SKILLS"; skills: MissionControlState["skills"] }
  | { type: "SET_PROFILES"; profiles: MissionControlState["profiles"] }
  | { type: "SET_TELEMETRY"; telemetry: MissionControlState["telemetry"] }
  | { type: "SET_WIKI"; wiki: MissionControlState["wiki"] }
  | { type: "SET_CONFIG"; config: MissionControlState["config"] };

const initialState: MissionControlState = {
  connected: false,
  reconnecting: false,
  status: null,
  sessions: [],
  activeSessionId: null,
  messages: [],
  streamingContent: "",
  streamingMessageId: null,
  toolCalls: [],
  lcm: null,
  sentinel: null,
  skills: [],
  profiles: [],
  telemetry: null,
  wiki: null,
  config: null,
};

function reducer(state: MissionControlState, action: Action): MissionControlState {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, connected: action.connected, reconnecting: action.reconnecting };

    case "SET_STATUS":
      return { ...state, status: action.status };

    case "SET_SESSIONS":
      return { ...state, sessions: action.sessions };

    case "SET_ACTIVE_SESSION":
      return {
        ...state,
        activeSessionId: action.sessionId,
        messages: [],
        streamingContent: "",
        streamingMessageId: null,
      };

    case "ADD_MESSAGE": {
      const msgs = [...state.messages, action.message].slice(-CONFIG.MAX_MESSAGES);
      return { ...state, messages: msgs };
    }

    case "SET_MESSAGES":
      return { ...state, messages: action.messages };

    case "STREAM_DELTA":
      return {
        ...state,
        streamingContent: state.streamingMessageId === action.messageId
          ? state.streamingContent + action.content
          : action.content,
        streamingMessageId: action.messageId,
      };

    case "STREAM_DONE": {
      // Finalize streaming message into messages array
      if (state.streamingMessageId === action.messageId && state.streamingContent) {
        const finalMsg: ChatMessage = {
          message_id: action.messageId,
          session_id: state.activeSessionId || "",
          role: "assistant",
          content: state.streamingContent,
          timestamp: Date.now() / 1000,
        };
        return {
          ...state,
          messages: [...state.messages, finalMsg].slice(-CONFIG.MAX_MESSAGES),
          streamingContent: "",
          streamingMessageId: null,
        };
      }
      return { ...state, streamingContent: "", streamingMessageId: null };
    }

    case "TOOL_START": {
      const calls = [action.call, ...state.toolCalls].slice(0, CONFIG.MAX_TOOL_CALLS);
      return { ...state, toolCalls: calls };
    }

    case "TOOL_END": {
      const calls = state.toolCalls.map((tc) =>
        tc.call_id === action.callId
          ? {
              ...tc,
              success: action.success,
              result: action.result,
              error: action.error,
              latency_ms: action.latencyMs,
              finished_at: Date.now() / 1000,
            }
          : tc
      );
      return { ...state, toolCalls: calls };
    }

    case "SET_LCM":
      return { ...state, lcm: action.lcm };

    case "SET_SENTINEL":
      return { ...state, sentinel: action.sentinel };

    case "SET_SKILLS":
      return { ...state, skills: action.skills };

    case "SET_PROFILES":
      return { ...state, profiles: action.profiles };

    case "SET_TELEMETRY":
      return { ...state, telemetry: action.telemetry };

    case "SET_WIKI":
      return { ...state, wiki: action.wiki };

    case "SET_CONFIG":
      return { ...state, config: action.config };

    default:
      return state;
  }
}

export function usePrometheus() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const fetchedRef = useRef(false);

  const handleEvent = useCallback((event: WSEvent) => {
    const p = event.payload;
    switch (event.type) {
      case "connected":
        break;

      case "agent_state":
        dispatch({
          type: "SET_STATUS",
          status: {
            state: p.state as AgentStatus["state"],
            model: (p.model as string) || state.status?.model || "unknown",
            provider: (p.provider as string) || state.status?.provider || "unknown",
            profile: (p.profile as string) || state.status?.profile || "full",
            uptime_seconds: (p.uptime_seconds as number) || 0,
          },
        });
        break;

      case "chat_message":
        dispatch({
          type: "ADD_MESSAGE",
          message: {
            message_id: p.message_id as string,
            session_id: p.session_id as string,
            role: p.role as ChatMessage["role"],
            content: p.content as string,
            timestamp: event.timestamp,
          },
        });
        break;

      case "chat_delta":
        dispatch({
          type: "STREAM_DELTA",
          content: p.content as string,
          messageId: p.message_id as string,
        });
        break;

      case "chat_done":
        dispatch({ type: "STREAM_DONE", messageId: p.message_id as string });
        break;

      case "tool_call_start":
        dispatch({
          type: "TOOL_START",
          call: {
            call_id: p.call_id as string,
            tool_name: p.tool_name as string,
            inputs: (p.inputs as Record<string, unknown>) || {},
            started_at: event.timestamp,
          },
        });
        break;

      case "tool_call_end":
        dispatch({
          type: "TOOL_END",
          callId: p.call_id as string,
          success: p.success as boolean,
          result: p.result as string | undefined,
          error: p.error as string | undefined,
          latencyMs: p.latency_ms as number,
        });
        break;

      case "lcm_update":
        dispatch({
          type: "SET_LCM",
          lcm: {
            session_id: p.session_id as string,
            total_tokens: p.total_tokens as number,
            limit: p.limit as number,
            compression_ratio: p.compression_ratio as number,
            fresh_count: p.fresh_count as number,
            summary_count: p.summary_count as number,
          },
        });
        break;

      case "sentinel_signal":
      case "dream_start":
      case "dream_phase":
      case "dream_complete":
        // Refresh sentinel state via REST on any sentinel event
        fetchSentinel();
        break;

      case "session_list":
        dispatch({
          type: "SET_SESSIONS",
          sessions: (p.sessions as Session[]) || [],
        });
        break;

      case "error":
        console.error("[Prometheus WS]", p.message);
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { status: wsStatus, send } = useWebSocket(handleEvent);

  // Map WS status to state
  useEffect(() => {
    dispatch({
      type: "SET_CONNECTED",
      connected: wsStatus === "connected",
      reconnecting: wsStatus === "reconnecting",
    });
  }, [wsStatus]);

  // REST fetchers
  const apiRef = useRef(getApiBase());

  const fetchJSON = useCallback(async function fetchJSON<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${apiRef.current}${path}`);
      if (!res.ok) return null;
      return await res.json() as T;
    } catch {
      return null;
    }
  }, []);

  const fetchSentinel = useCallback(async () => {
    const data = await fetchJSON<MissionControlState["sentinel"]>("/api/sentinel");
    if (data) dispatch({ type: "SET_SENTINEL", sentinel: data });
  }, [fetchJSON]);

  // Initial REST load
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function loadAll() {
      const [statusData, sessions, skills, profiles, telemetry, wiki, sentinel, config] =
        await Promise.all([
          fetchJSON<AgentStatus>("/api/status"),
          fetchJSON<Session[]>("/api/sessions"),
          fetchJSON<MissionControlState["skills"]>("/api/skills"),
          fetchJSON<MissionControlState["profiles"]>("/api/profiles"),
          fetchJSON<MissionControlState["telemetry"]>("/api/telemetry"),
          fetchJSON<MissionControlState["wiki"]>("/api/wiki/stats"),
          fetchJSON<MissionControlState["sentinel"]>("/api/sentinel"),
          fetchJSON<MissionControlState["config"]>("/api/config"),
        ]);

      if (statusData) dispatch({ type: "SET_STATUS", status: statusData });
      if (sessions) dispatch({ type: "SET_SESSIONS", sessions });
      if (skills) dispatch({ type: "SET_SKILLS", skills });
      if (profiles) dispatch({ type: "SET_PROFILES", profiles });
      if (telemetry) dispatch({ type: "SET_TELEMETRY", telemetry });
      if (wiki) dispatch({ type: "SET_WIKI", wiki });
      if (sentinel) dispatch({ type: "SET_SENTINEL", sentinel });
      if (config) dispatch({ type: "SET_CONFIG", config });

      // Auto-select first session
      if (sessions && sessions.length > 0 && !state.activeSessionId) {
        dispatch({ type: "SET_ACTIVE_SESSION", sessionId: sessions[0].session_id });
      }
    }

    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actions
  const sendMessage = useCallback(
    (content: string) => {
      if (!state.activeSessionId) return;
      // Optimistically add user message
      const msg: ChatMessage = {
        message_id: `local-${Date.now()}`,
        session_id: state.activeSessionId,
        role: "user",
        content,
        timestamp: Date.now() / 1000,
      };
      dispatch({ type: "ADD_MESSAGE", message: msg });
      send({ type: "send_message", payload: { session_id: state.activeSessionId, content } });
    },
    [state.activeSessionId, send]
  );

  const switchSession = useCallback(
    (sessionId: string) => {
      dispatch({ type: "SET_ACTIVE_SESSION", sessionId });
      send({ type: "switch_session", payload: { session_id: sessionId } });
      // Fetch messages for this session
      fetchJSON<ChatMessage[]>(`/api/sessions/${sessionId}/messages`).then((msgs) => {
        if (msgs) dispatch({ type: "SET_MESSAGES", messages: msgs });
      });
    },
    [send, fetchJSON]
  );

  const createSession = useCallback(async () => {
    try {
      const res = await fetch(`${apiRef.current}/api/sessions`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const newSession: Session = {
          session_id: data.session_id,
          created_at: Date.now() / 1000,
          message_count: 0,
        };
        dispatch({ type: "SET_SESSIONS", sessions: [newSession, ...state.sessions] });
        switchSession(data.session_id);
      }
    } catch {
      // ignore
    }
  }, [state.sessions, switchSession]);

  return {
    state,
    wsStatus,
    sendMessage,
    switchSession,
    createSession,
  };
}
