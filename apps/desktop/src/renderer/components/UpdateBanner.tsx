import { useState, useEffect } from "react";

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

type UpdateState = "idle" | "available" | "downloading" | "downloaded" | "error";

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const desktop = window.reqsmithDesktop;
    if (!desktop?.onUpdateAvailable) return;

    const unsubAvailable = desktop.onUpdateAvailable((updateInfo) => {
      setInfo(updateInfo);
      setState("available");
    });

    const unsubProgress = desktop.onUpdateProgress((p) => {
      setProgress(p);
      setState("downloading");
    });

    const unsubDownloaded = desktop.onUpdateDownloaded(() => {
      setState("downloaded");
    });

    return () => {
      unsubAvailable();
      unsubProgress();
      unsubDownloaded();
    };
  }, []);

  const handleDownload = async () => {
    const result = await window.reqsmithDesktop?.updateDownload();
    if (result && !result.success) {
      setState("error");
      setErrorMsg(result.error ?? "下载失败");
    }
  };

  const handleInstall = async () => {
    await window.reqsmithDesktop?.updateInstall();
  };

  const handleDismiss = () => {
    setState("idle");
  };

  if (state === "idle") return null;

  // Available — show banner
  if (state === "available" && info) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 20px",
        background: "var(--accent-soft)",
        borderBottom: "1px solid var(--accent)",
        fontSize: "13px",
        color: "var(--ink)",
      }}>
        <span style={{ fontWeight: 600, color: "var(--accent)" }}>⬆ 新版本 {info.version}</span>
        <span style={{ color: "var(--muted)", flex: 1 }}>可用，当前版本可继续使用</span>
        <button className="btn primary" style={{ padding: "4px 14px", fontSize: "12px" }} onClick={handleDownload}>
          立即下载
        </button>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "16px", lineHeight: 1 }} onClick={handleDismiss}>
          ✕
        </button>
      </div>
    );
  }

  // Downloading
  if (state === "downloading" && progress) {
    return (
      <div style={{
        padding: "8px 20px",
        background: "var(--accent-soft)",
        borderBottom: "1px solid var(--accent)",
        fontSize: "13px",
        color: "var(--ink)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontWeight: 600, color: "var(--accent)" }}>正在下载更新...</span>
          <span style={{ color: "var(--muted)" }}>{Math.round(progress.percent)}%</span>
        </div>
        <div style={{ height: "3px", background: "var(--paper-3)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress.percent}%`, background: "var(--accent)", borderRadius: "2px", transition: "width 0.3s" }} />
        </div>
      </div>
    );
  }

  // Downloaded — ready to install
  if (state === "downloaded") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 20px",
        background: "var(--success-soft)",
        borderBottom: "1px solid var(--success)",
        fontSize: "13px",
        color: "var(--ink)",
      }}>
        <span style={{ fontWeight: 600, color: "var(--success)" }}>✓ 更新已下载</span>
        <span style={{ color: "var(--muted)", flex: 1 }}>重启后生效</span>
        <button className="btn primary" style={{ padding: "4px 14px", fontSize: "12px" }} onClick={handleInstall}>
          立即重启
        </button>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "16px", lineHeight: 1 }} onClick={handleDismiss}>
          ✕
        </button>
      </div>
    );
  }

  // Error
  if (state === "error") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 20px",
        background: "var(--rust-soft)",
        borderBottom: "1px solid var(--rust)",
        fontSize: "13px",
        color: "var(--ink)",
      }}>
        <span style={{ fontWeight: 600, color: "var(--rust)" }}>更新失败</span>
        <span style={{ color: "var(--muted)", flex: 1 }}>{errorMsg}</span>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "16px", lineHeight: 1 }} onClick={handleDismiss}>
          ✕
        </button>
      </div>
    );
  }

  return null;
}
