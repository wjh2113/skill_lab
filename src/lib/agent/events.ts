import type { SDKMessage } from "@cursor/sdk";
import type { RunEvent, RunEventType } from "@/lib/agent/types";

let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `evt-${Date.now()}-${eventCounter}`;
}

export function sdkMessageToRunEvent(message: SDKMessage): RunEvent | RunEvent[] | null {
  const timestamp = new Date().toISOString();

  switch (message.type) {
    case "assistant": {
      const events: RunEvent[] = [];
      for (const block of message.message.content) {
        if (block.type === "text" && block.text.trim()) {
          events.push({
            id: nextEventId(),
            type: "assistant_text",
            timestamp,
            data: { text: block.text },
          });
        }
        if (block.type === "tool_use") {
          events.push({
            id: nextEventId(),
            type: "tool_call_start",
            timestamp,
            data: {
              callId: block.id,
              name: block.name,
              args: block.input,
            },
          });
        }
      }
      return events.length === 1 ? events[0] : events.length > 0 ? events : null;
    }
    case "tool_call": {
      const type: RunEventType =
        message.status === "running"
          ? "tool_call_start"
          : message.status === "completed"
            ? "tool_call_end"
            : "error";

      const event: RunEvent = {
        id: nextEventId(),
        type,
        timestamp,
        data: {
          callId: message.call_id,
          name: message.name,
          status: message.status,
          args: message.args,
          result: message.result,
          truncated: message.truncated,
        },
      };

      if (message.status === "completed" && message.result !== undefined) {
        return [
          event,
          {
            id: nextEventId(),
            type: "tool_result",
            timestamp,
            data: {
              callId: message.call_id,
              name: message.name,
              result: message.result,
            },
          },
        ];
      }
      return event;
    }
    case "thinking":
      return {
        id: nextEventId(),
        type: "thinking",
        timestamp,
        data: {
          text: message.text,
          durationMs: message.thinking_duration_ms,
        },
      };
    case "status":
      return {
        id: nextEventId(),
        type: "status",
        timestamp,
        data: {
          status: message.status,
          message: message.message,
        },
      };
    default:
      return null;
  }
}

export function extractAssistantText(messages: SDKMessage[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    if (message.type !== "assistant") continue;
    for (const block of message.message.content) {
      if (block.type === "text" && block.text.trim()) {
        parts.push(block.text);
      }
    }
  }
  return parts.join("\n\n").trim();
}
