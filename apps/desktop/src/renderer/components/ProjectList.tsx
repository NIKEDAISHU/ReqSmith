import { useProjectStore } from "../stores/project-store.js";
import { s } from "../styles.js";

const SOURCE_LABELS: Record<string, string> = {
  SOURCE_DIRECTORY: "源码",
  OPENAPI_FILE: "OpenAPI",
  OPENAPI_URL: "OpenAPI",
  MANUAL: "手动",
  MIXED: "混合",
};

export function ProjectList() {
  const { projects, currentProject, scanning, fetchProjects, selectProject, scanProject, removeProject } = useProjectStore();

  if (projects.length === 0 && !useProjectStore.getState().loading) {
    fetchProjects();
  }

  if (projects.length === 0) {
    return (
      <div style={s.empty}>
        <div style={s.emptyTitle as React.CSSProperties}>还没有项目</div>
        <div className="receipt">创建一个项目来开始扫描和测试你的 API</div>
      </div>
    );
  }

  return (
    <section style={{ marginTop: "36px" }}>
      <div className="spread" style={{ marginBottom: "8px" }}>
        <span className="fmark">项目</span>
        <span className="receipt">
          <span style={{ color: "var(--ink)", fontSize: "15px" }}>{projects.length}</span> 个项目
        </span>
      </div>

      {projects.map((p) => {
        const isScanning = scanning && currentProject?.id === p.id;

        return (
          <div
            key={p.id}
            style={{
              ...s.projectRow,
              ...(currentProject?.id === p.id ? { background: "var(--accent-soft)" } : {}),
            }}
            onClick={() => selectProject(p.id)}
          >
            <div>
              <div style={s.projectTitle}>
                {p.name}
                {isScanning && <span className="dot running" style={{ marginLeft: 8, verticalAlign: "middle" }} />}
              </div>
              <div style={s.projectMeta}>
                <span className="pill">{SOURCE_LABELS[p.sourceType] ?? p.sourceType}</span>
                <span className="receipt">{p.endpointCount} 个接口</span>
                {p.lastScanAt && (
                  <span className="receipt">最近扫描 {new Date(p.lastScanAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>

            <div className="row" style={{ gap: "6px" }}>
              <button
                className="pill"
                disabled={isScanning}
                onClick={(e) => { e.stopPropagation(); scanProject(p.id); }}
              >
                {isScanning ? "扫描中…" : "扫描"}
              </button>
              <button
                className="pill"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProject(p.id);
                }}
              >
                删除
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
