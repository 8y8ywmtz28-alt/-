import OpenAI from "openai";

let client: OpenAI | null = null;
let clientApiKey: string | undefined;

export function getOpenAIClient(apiKey?: string | null) {
  if (!apiKey) {
    return null;
  }

  if (!client || clientApiKey !== apiKey) {
    client = new OpenAI({ apiKey });
    clientApiKey = apiKey;
  }

  return client;
}
