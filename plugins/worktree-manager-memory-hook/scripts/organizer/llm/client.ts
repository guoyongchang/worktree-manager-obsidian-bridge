import type { LlmProviderConfig } from "../types";

export interface LlmClient {
  chat(systemPrompt: string, userMessage: string): Promise<string>;
}

/** Parse SSE stream or JSON response */
async function parseResponse(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  // If it's SSE (text/event-stream with data: lines), extract the last data line
  if (text.includes("data: ")) {
    const lines = text.split("\n");
    let lastData = "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        lastData = payload;
      }
    }
    if (lastData) {
      const parsed = JSON.parse(lastData);
      return parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || "";
    }
    return "";
  }

  // Regular JSON
  const parsed = JSON.parse(text);
  return parsed.choices?.[0]?.message?.content || "";
}

export function createLlmClient(config: LlmProviderConfig): LlmClient {
  const apiKey = process.env[config.api_key_env] ?? "";
  if (!apiKey) {
    throw new Error(`API key not set: environment variable ${config.api_key_env} is empty or missing`);
  }

  const baseURL = config.base_url ?? (config.provider === "openai" ? "https://api.openai.com" : "https://api.anthropic.com");

  return {
    async chat(systemPrompt: string, userMessage: string): Promise<string> {
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userMessage },
      ];

      if (config.provider === "openai") {
        const res = await fetch(`${baseURL}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: 0.3,
            max_tokens: 4000,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          throw new Error(`OpenAI API error: ${res.status} — ${errText.substring(0, 200)}`);
        }

        return parseResponse(res);
      }

      if (config.provider === "anthropic") {
        const res = await fetch(`${baseURL}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            messages: messages.filter(m => m.role !== "system"),
            system: systemPrompt,
            max_tokens: 4000,
            temperature: 0.3,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          throw new Error(`Anthropic API error: ${res.status} — ${errText.substring(0, 200)}`);
        }

        const parsed = await res.json();
        return parsed.content?.[0]?.text || "";
      }

      throw new Error(`Unknown provider: ${config.provider}`);
    },
  };
}
