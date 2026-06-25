import fs from "node:fs";
import path from "node:path";
import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import type { LLMGenerator, EndpointContext } from "@reqsmith/data-generator";
import type { EndpointParameter } from "@reqsmith/contracts";

interface LLMConfig {
  apiUrl: string;
  model: string;
  apiKey?: string;
}

/** Default LLM config from opencode config file */
let defaultLLMConfig: LLMConfig | null = null;

/** Load LLM config from opencode config file */
export function loadLLMConfig(): LLMConfig | null {
  if (defaultLLMConfig) return defaultLLMConfig;

  try {
    const configPaths = [
      path.join(app.getPath("home"), "Downloads", "opencode转发配置.json"),
      path.join(app.getPath("documents"), "opencode转发配置.json"),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(content);

        if (config.provider?.["haocean-proxy"]) {
          const provider = config.provider["haocean-proxy"];
          const models = provider.models;

          const modelId = "DeepSeek-V4-Flash";
          const model = models[modelId];

          if (model && provider.options?.baseURL) {
            defaultLLMConfig = {
              apiUrl: provider.options.baseURL,
              model: model.id,
              apiKey: provider.options.apiKey || undefined,
            };
            console.log("[LLM] Loaded config:", defaultLLMConfig);
            return defaultLLMConfig;
          }
        }
      }
    }
  } catch (err) {
    console.error("[LLM] Failed to load config:", err);
  }
  return null;
}

export function getDefaultLLMConfig(): LLMConfig | null {
  if (!defaultLLMConfig) {
    return loadLLMConfig();
  }
  return defaultLLMConfig;
}

export function setCustomLLMConfig(config: LLMConfig): void {
  defaultLLMConfig = config;
}

/** Call an OpenAI-compatible chat completion endpoint. */
async function callLLM(config: LLMConfig, prompt: string): Promise<string | null> {
  const { promise, resolve } = Promise.withResolvers<string | null>();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const body = JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: `You are a test data generator for API testing. Generate realistic, diverse test values that match the semantic meaning of each parameter. Always respond with ONLY a JSON object mapping parameter names to values. No explanation, no markdown, just the JSON object.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const url = new URL(config.apiUrl);
    const isHttps = url.protocol === "https:";
    const httpModule = isHttps ? await import("node:https") : await import("node:http");

    const req = httpModule.default.request(
      url,
      {
        method: "POST",
        headers,
      },
      (res: { on: (event: string, handler: (chunk?: Buffer) => void) => void; statusCode?: number }) => {
        let data = "";
        res.on("data", (chunk?: Buffer) => {
          if (chunk) data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.message?.content;
            if (content) {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              resolve(jsonMatch ? jsonMatch[0] : null);
            }
            resolve(null);
          } catch {
            resolve(null);
          }
        });
      },
    );

    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  } catch {
    resolve(null);
  }

  return promise;
}

export function createLLMGenerator(config: LLMConfig): LLMGenerator {
  return {
    async generateValues(
      context: EndpointContext,
      params: EndpointParameter[],
    ): Promise<Record<string, string> | null> {
      if (params.length === 0) return null;

      const paramList = params.map((p) => `- ${p.name} (${p.type}, ${p.location}${p.required ? ", required" : ""})`).join("\n");
      const prompt = `You are generating test data for a Chinese health law enforcement case review system (卫生行政执法案卷评审系统).

API Endpoint: ${context.method} ${context.path}
Name: ${context.name}
Group: ${context.group}
${context.tags.length > 0 ? `Tags: ${context.tags.join(", ")}` : ""}

Parameters:
${paramList}

Rules:
- For path params like caseId/案卷ID, use a REALISTIC id (e.g. a UUID or numeric id that could exist in the system). Prefer simple numeric values like 1, 2, 3 for test.
- For query params like page/pageSize, use sensible defaults (page=1, pageSize=10).
- For date params, use ISO format dates within the last year.
- For status/type fields, use valid enum values common in Chinese government systems.
- Return ONLY a JSON object mapping parameter names to values: {"paramName": "value"}`;

      const response = await callLLM(config, prompt);
      if (!response) return null;

      try {
        const values = JSON.parse(response) as Record<string, string>;
        const filtered: Record<string, string> = {};
        for (const p of params) {
          if (values[p.name] !== undefined) {
            filtered[p.name] = String(values[p.name]);
          }
        }
        return Object.keys(filtered).length > 0 ? filtered : null;
      } catch {
        return null;
      }
    },
  };
}

export function registerLLMIpc(): void {
  ipcMain.handle(
    "llm:generateValues",
    async (_event: IpcMainInvokeEvent, raw: unknown) => {
      const input = raw as Record<string, unknown>;
      const config = input.config as LLMConfig;
      const context = input.context as EndpointContext;
      const params = input.parameters as EndpointParameter[];

      if (!config?.apiUrl || !config?.model) {
        const defaultConfig = getDefaultLLMConfig();
        if (!defaultConfig) {
          return { success: false, error: "请配置 LLM API 地址和模型名称" };
        }
        const generator = createLLMGenerator(defaultConfig);
        const values = await generator.generateValues(context, params);
        if (!values) {
          return { success: false, error: "模型未返��有效数据" };
        }
        return { success: true, values };
      }

      try {
        const generator = createLLMGenerator(config);
        const values = await generator.generateValues(context, params);

        if (!values) {
          return { success: false, error: "模型未返回有效数据" };
        }

        return { success: true, values };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    "llm:testConnection",
    async (_event: IpcMainInvokeEvent, raw: unknown) => {
      const config = raw as LLMConfig;
      if (!config?.apiUrl || !config?.model) {
        return { success: false, error: "请配置 API 地址和模型" };
      }

      try {
        const response = await callLLM(config, 'Respond with exactly: {"status":"ok"}');
        if (response) {
          return { success: true };
        }
        return { success: false, error: "模型无响应" };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle("llm:getConfig", async () => {
    return getDefaultLLMConfig();
  });

  ipcMain.handle(
    "llm:setConfig",
    async (_event: IpcMainInvokeEvent, raw: unknown) => {
      const config = raw as LLMConfig;
      if (config?.apiUrl && config?.model) {
        setCustomLLMConfig(config);
        return { success: true };
      }
      return { success: false, error: "Invalid config" };
    },
  );
}