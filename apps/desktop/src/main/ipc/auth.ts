import { ipcMain, type IpcMainInvokeEvent } from "electron";
import http from "node:http";
import { setSessionCookie } from "./endpoints.js";

export function registerAuthIpc(): void {
  ipcMain.handle(
    "auth:login",
    async (_event: IpcMainInvokeEvent, raw: unknown) => {
      const input = raw as Record<string, unknown>;
      const baseUrl = (input.baseUrl as string) || "http://localhost:8080";
      const username = input.username as string;
      const password = input.password as string;

      if (!username || !password) {
        return { success: false, error: "用户名和密码不能为空" };
      }

      try {
        // Build login URL: baseUrl already includes context-path, append /login
        const loginUrl = baseUrl.replace(/\/$/, "") + "/login";
        const url = new URL(loginUrl);

        const body = new URLSearchParams();
        body.append("username", username);
        body.append("password", password);
        if (input.rememberMe) {
          body.append("remember-me", "on");
        }

        const result = await new Promise<{
          success: boolean;
          cookies: Record<string, string>;
          cookieHeader: string;
          error?: string;
          status?: number;
        }>((resolve) => {
          const req = http.request(
            url,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
              },
            },
            (res) => {
              const cookies: Record<string, string> = {};
              const setCookieHeaders = res.headers["set-cookie"];
              if (setCookieHeaders) {
                for (const header of setCookieHeaders) {
                  const cookiePart = header.split(";")[0].trim();
                  const eqIdx = cookiePart.indexOf("=");
                  if (eqIdx > 0) {
                    const key = cookiePart.substring(0, eqIdx).trim();
                    const val = cookiePart.substring(eqIdx + 1).trim();
                    if (val) cookies[key] = val;
                  }
                }
              }

              let data = "";
              res.on("data", (chunk: Buffer) => {
                data += chunk.toString();
              });
              res.on("end", () => {
                // Success: 302 redirect or 200 with session cookie
                const success =
                  res.statusCode === 302 ||
                  res.statusCode === 200 ||
                  "JSESSIONID" in cookies ||
                  "remember-me" in cookies;

                if (!success) {
                  let errorMsg = `登录失败 (HTTP ${res.statusCode})`;
                  try {
                    const json = JSON.parse(data);
                    if (json.msg) errorMsg = json.msg;
                  } catch { /* ignore */ }
                  resolve({ success: false, cookies: {}, cookieHeader: "", error: errorMsg, status: res.statusCode });
                  return;
                }

                const cookieHeader = Object.entries(cookies)
                  .filter(([k]) => k === "JSESSIONID" || k === "remember-me")
                  .map(([k, v]) => `${k}=${v}`)
                  .join("; ");

                resolve({ success: true, cookies, cookieHeader, status: res.statusCode });
              });
            },
          );

          req.on("error", (err) => {
            resolve({ success: false, cookies: {}, cookieHeader: "", error: `网络错误: ${err.message}` });
          });

          req.write(body.toString());
          req.end();
        });

        if (result.success && result.cookieHeader) {
          setSessionCookie(baseUrl, result.cookieHeader);
        }

        return result;
      } catch (err) {
        return {
          success: false,
          error: `请求失败: ${String(err)}`,
        };
      }
    },
  );
}
