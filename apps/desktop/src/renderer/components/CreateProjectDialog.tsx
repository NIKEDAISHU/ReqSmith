import { useState } from "react";
import type { CreateProjectInput, SourceType } from "@reqsmith/contracts";
import { s } from "../styles.js";

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateProjectInput) => Promise<void>;
}

const SOURCE_LABELS: Record<SourceType, string> = {
  SOURCE_DIRECTORY: "本地源码",
  OPENAPI_FILE: "OpenAPI 文件",
  OPENAPI_URL: "OpenAPI URL",
  MANUAL: "手动创建",
  MIXED: "混合来源",
};

export function CreateProjectDialog({ open, onClose, onSubmit }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("SOURCE_DIRECTORY");
  const [sourcePath, setSourcePath] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handlePickDirectory = async () => {
    const dir = await window.reqsmithDesktop.openDirectoryDialog();
    if (dir) setSourcePath(dir);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        sourceType,
        sourcePath: sourceType === "SOURCE_DIRECTORY" || sourceType === "OPENAPI_FILE" ? sourcePath || undefined : undefined,
        sourceUrl: sourceType === "OPENAPI_URL" ? sourceUrl || undefined : undefined,
      });
      setName("");
      setDescription("");
      setSourceType("SOURCE_DIRECTORY");
      setSourcePath("");
      setSourceUrl("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const showPathPicker = sourceType === "SOURCE_DIRECTORY";
  const showFileInput = sourceType === "OPENAPI_FILE";
  const showUrlInput = sourceType === "OPENAPI_URL";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="display" style={{ fontSize: "22px", margin: 0 }}>新建项目</h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={s.formRow}>
            <label style={s.label}>项目名称 *</label>
            <input
              style={s.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：用户服务"
              autoFocus
            />
          </div>

          <div style={s.formRow}>
            <label style={s.label}>描述</label>
            <input
              style={s.formInput}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选的项目说明"
            />
          </div>

          <div style={s.formRow}>
            <label style={s.label}>接口来源</label>
            <div className="row" style={{ gap: "6px", flexWrap: "wrap" }}>
              {(Object.entries(SOURCE_LABELS) as [SourceType, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`pill ${sourceType === value ? "active" : ""}`}
                  onClick={() => setSourceType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {showPathPicker && (
            <div style={s.formRow}>
              <label style={s.label}>项目目录</label>
              <div className="row" style={{ gap: "8px" }}>
                <input
                  className="input"
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  placeholder="选择或输入目录路径"
                  style={{ flex: 1, padding: "10px 0" }}
                />
                <button type="button" className="btn ghost" onClick={handlePickDirectory}>
                  浏览
                </button>
              </div>
            </div>
          )}

          {showFileInput && (
            <div style={s.formRow}>
              <label style={s.label}>OpenAPI 文件路径</label>
              <input
                style={s.formInput}
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="选择 OpenAPI JSON/YAML 文件"
              />
            </div>
          )}

          {showUrlInput && (
            <div style={s.formRow}>
              <label style={s.label}>OpenAPI URL</label>
              <input
                style={s.formInput}
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/openapi.json"
              />
            </div>
          )}

          <div style={s.actionBar}>
            <button type="button" className="btn ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn primary" disabled={!name.trim() || submitting}>
              {submitting ? "创建中…" : "创建项目"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
