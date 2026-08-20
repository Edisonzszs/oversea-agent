import { consultingAgent } from "./adapters/consultingAgent";
import { odiAgent } from "./adapters/odiAgent";
import { taxiqAgent } from "./adapters/taxiqAgent";
import type { AgentAdapter } from "./types";
import type { AgentId } from "../../shared/orchestration/types";

export function createAgentRegistry(): Map<AgentId, AgentAdapter> {
  return new Map<AgentId, AgentAdapter>([
    ["consulting", consultingAgent],
    ["taxiq", taxiqAgent],
    ["odi", odiAgent],
  ]);
}

export function getAgentAdapter(
  registry: Map<AgentId, AgentAdapter>,
  id: AgentId,
): AgentAdapter {
  const adapter = registry.get(id);
  if (!adapter) throw new Error(`未找到专业智能体: ${id}`);
  return adapter;
}
