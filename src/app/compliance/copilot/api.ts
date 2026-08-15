async function post(path: string, body: Record<string, string>): Promise<string> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg += " " + (await res.json())?.error; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data?.content ?? "";
}

export const copilotApi = {
  extract: (systemPrompt: string, userText: string) => post("/api/copilot/extract", { systemPrompt, userText }),
  regulation: (contextPrompt: string, question: string) => post("/api/copilot/regulation", { contextPrompt, question }),
  chat: (systemPrompt: string, userText: string) => post("/api/copilot/chat", { systemPrompt, userText }),
  general: (messages: { role: string; content: string }[]) => post("/api/copilot/general", { messages }),
};
