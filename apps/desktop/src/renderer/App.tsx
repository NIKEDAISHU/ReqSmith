import { useState, useEffect } from "react";
import { useProjectStore } from "./stores/project-store.js";
import { CreateProjectDialog } from "./components/CreateProjectDialog.js";
import { ProjectList } from "./components/ProjectList.js";
import { EndpointPage } from "./components/EndpointPage.js";
import { s } from "./styles.js";

type NavPage = "workbench" | "endpoints" | "suites" | "runs" | "data" | "reports" | "settings";

const NAV_ITEMS: { page: NavPage; label: string }[] = [
  { page: "workbench", label: "工作台" },
  { page: "endpoints", label: "接口" },
  { page: "suites", label: "测试集合" },
  { page: "runs", label: "运行" },
  { page: "data", label: "数据" },
  { page: "reports", label: "报告" },
  { page: "settings", label: "设置" },
];

export function App() {
  const [page, setPage] = useState<NavPage>("workbench");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { fetchProjects, createProject, currentProject } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (input: Parameters<typeof createProject>[0]) => {
    const project = await createProject(input);
    useProjectStore.getState().selectProject(project.id);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Top navigation ── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <a href="/" style={s.logo} onClick={(e) => { e.preventDefault(); setPage("workbench"); }}>
            ReqSmith
          </a>

          <div style={s.navLinks}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.page}
                style={{
                  ...s.navLink,
                  ...(page === item.page ? s.navLinkActive : {}),
                }}
                onClick={() => setPage(item.page)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <button
            className="btn primary"
            onClick={() => setShowCreateDialog(true)}
          >
            + 新建项目
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main style={page === "endpoints" ? { ...s.main, overflow: "hidden", padding: 0 } : s.main}>
        {page === "workbench" && (
          <>
            <p className="fmark" style={{ marginBottom: "20px" }}>你的项目</p>
            <h1 className="display" style={s.pageTitle}>工作台</h1>
            <p style={s.pageSubtitle}>
              从源码或 OpenAPI 文档发现接口，自动生成请求数据，批量验证你的后端服务。
            </p>
            <ProjectList />
          </>
        )}

        {page === "endpoints" && currentProject && (
          <EndpointPage />
        )}

        {page !== "workbench" && page !== "endpoints" && (
          <div style={s.empty}>
            <div style={s.emptyTitle as React.CSSProperties}>{NAV_ITEMS.find((n) => n.page === page)?.label}</div>
            <div className="receipt">即将实现</div>
          </div>
        )}

        {page === "endpoints" && !currentProject && (
          <div style={s.empty}>
            <div style={s.emptyTitle as React.CSSProperties}>请先选择或创建项目</div>
            <button className="btn primary" onClick={() => setShowCreateDialog(true)}>
              + 新建项目
            </button>
          </div>
        )}
      </main>

      <CreateProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}
