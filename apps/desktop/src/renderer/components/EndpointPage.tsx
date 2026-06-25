import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../stores/project-store.js";
import { useEndpointStore } from "../stores/endpoint-store.js";
import type { EndpointSummary, EndpointDetail } from "@reqsmith/contracts";
import type { GeneratedRequest, RequestResult } from "@reqsmith/contracts";

const METHOD_COLORS: Record<string, string> = {
  GET: "#2d8a4e",
  POST: "#1a6fb5",
  PUT: "#b58a1a",
  PATCH: "#8a6d2d",
  DELETE: "#b52d2d",
  HEAD: "#666",
  OPTIONS: "#666",
};

export function EndpointPage() {
  const { currentProject } = useProjectStore();
  const {
    endpoints, selectedEndpoints, selectedEndpoint, generatedRequest, sendResult,
    loading, sending, searchQuery, selectedGroup, selectedMethod,
    sortByModifiedTime, batchTesting, batchResults, batchSummary,
    login,
    fetchEndpoints, selectEndpoint, sendRequest,
    setSearchQuery, setSelectedGroup, setSelectedMethod,
    doLogin, logout,
    toggleEndpointSelection, selectAllEndpoints, clearSelectedEndpoints,
    batchTestSelected, setSortByModifiedTime,
    analyzing, analyzeAndRename,
    toastMessage, clearToast,
    editedOverrides, setEditedParam, setEditedHeader, setEditedBody, resetOverrides,
  } = useEndpointStore();
  const [showLogin, setShowLogin] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showBatchResults, setShowBatchResults] = useState(false);

  useEffect(() => {
    if (currentProject) {
      fetchEndpoints(currentProject.id);
    }
  }, [currentProject?.id, sortByModifiedTime]);

  // Auto-show batch results when test completes
  useEffect(() => {
    if (batchSummary && !batchTesting) {
      setShowBatchResults(true);
    }
  }, [batchSummary, batchTesting]);
  // Group endpoints by controller group
  const groups = useMemo(() => {
    const map = new Map<string, EndpointSummary[]>();
    for (const ep of endpoints) {
      const group = ep.group || "未分组";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(ep);
    }
    return map;
  }, [endpoints]);

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    let list = endpoints;
    if (selectedGroup) list = list.filter((ep) => (ep.group || "未分组") === selectedGroup);
    if (selectedMethod) list = list.filter((ep) => ep.method === selectedMethod);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (ep) => ep.path.toLowerCase().includes(q) || ep.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [endpoints, selectedGroup, selectedMethod, searchQuery]);

  const methods = useMemo(
    () => [...new Set(endpoints.map((ep) => ep.method))].sort(),
    [endpoints],
  );

  if (!currentProject) {
    return (
      <div style={{ padding: "40px 48px", color: "var(--secondary)" }}>
        请先选择一个项目
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ── Left: endpoint list ── */}
      <div
        style={{
          width: "340px",
          minWidth: "260px",
          borderRight: "1px solid var(--divider)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Search + method filter */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--divider)" }}>
          <input
            type="text"
            placeholder="搜索接口路径或名称…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              border: "1px solid var(--divider)",
              borderRadius: "6px",
              fontSize: "13px",
              background: "var(--bg)",
              color: "var(--ink)",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
            <button
              className="pill"
              style={selectedMethod === null ? { background: "var(--ink)", color: "var(--bg)" } : {}}
              onClick={() => setSelectedMethod(null)}
            >
              全部
            </button>
            {methods.map((m) => (
              <button
                key={m}
                className="pill method"
                style={{
                  color: selectedMethod === m ? "#fff" : METHOD_COLORS[m] ?? "var(--ink)",
                  background: selectedMethod === m ? METHOD_COLORS[m] ?? "var(--ink)" : "transparent",
                  fontWeight: 600,
                  fontSize: "11px",
                  letterSpacing: "0.02em",
                }}
                onClick={() => setSelectedMethod(selectedMethod === m ? null : m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {/* Login status */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: "8px" }}>
          {login.loggedIn ? (
            <>
              <span className="dot running" />
              <span style={{ fontSize: "12px", color: "var(--ink)" }}>{login.username}</span>
              <span style={{ flex: 1 }} />
              <button className="pill" style={{ fontSize: "11px" }} onClick={logout}>退出</button>
            </>
          ) : (
            <>
              <span className="dot" style={{ background: "var(--method-delete, #b52d2d)" }} />
              <span style={{ fontSize: "12px", color: "var(--secondary)" }}>未登录</span>
              <span style={{ flex: 1 }} />
              <button className="pill" style={{ fontSize: "11px", background: "var(--accent)", color: "#fff" }} onClick={() => setShowLogin(true)}>登录</button>
            </>
          )}
        </div>

        {/* Batch test toolbar */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <button
            className="pill"
            style={{ fontSize: "11px" }}
            onClick={selectAllEndpoints}
          >
            全选
          </button>
          <button
            className="pill"
            style={{ fontSize: "11px" }}
            onClick={clearSelectedEndpoints}
          >
            清空
          </button>
          <button
            className="pill"
            style={{ fontSize: "11px", background: selectedEndpoints.size > 0 ? "var(--success)" : "var(--divider)", color: selectedEndpoints.size > 0 ? "#fff" : "var(--secondary)" }}
            onClick={() => currentProject && batchTestSelected(currentProject.id)}
            disabled={batchTesting || selectedEndpoints.size === 0}
          >
            {batchTesting ? "测试中…" : `测试选中 (${selectedEndpoints.size})`}
          </button>
          <button
            className="pill"
            style={{ fontSize: "11px", background: sortByModifiedTime ? "var(--warning)" : "var(--divider)", color: sortByModifiedTime ? "#fff" : "var(--secondary)" }}
            onClick={() => setSortByModifiedTime(!sortByModifiedTime)}
          >
            按代码时间排序
          </button>
          <span style={{ flex: 1 }} />
          <button
            className="pill"
            style={{ fontSize: "11px", background: analyzing ? "var(--paper-3)" : "var(--accent)", color: analyzing ? "var(--secondary)" : "#fff", display: "inline-flex", alignItems: "center", gap: "4px" }}
            onClick={() => currentProject && analyzeAndRename(currentProject.id)}
            disabled={analyzing}
          >
            {analyzing ? "⏳ AI 分析中…" : "🧠 AI 命名分类"}
          </button>
        </div>

        {/* Group tree + endpoint rows */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: "20px 16px", color: "var(--secondary)" }}>加载中…</div>
          )}
          {!loading && filteredEndpoints.length === 0 && (
            <div style={{ padding: "20px 16px", color: "var(--secondary)" }}>
              {endpoints.length === 0 ? "暂无接口，请先扫描" : "无匹配接口"}
            </div>
          )}
          {!loading &&
            Array.from(groups.entries()).map(([group, groupEps]) => {
              const groupFiltered = groupEps.filter((ep) => {
                if (selectedMethod && ep.method !== selectedMethod) return false;
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  if (!ep.path.toLowerCase().includes(q) && !ep.name.toLowerCase().includes(q)) return false;
                }
                return true;
              });
              if (groupFiltered.length === 0) return null;
              const isGroupSelected = selectedGroup === group;
              return (
                <div key={group}>
                  <div
                    style={{
                      padding: "6px 16px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--secondary)",
                      letterSpacing: "-0.01em",
                      cursor: "pointer",
                      background: isGroupSelected ? "var(--accent-soft)" : "transparent",
                      borderTop: "1px solid var(--divider)",
                    }}
                    onClick={() => setSelectedGroup(isGroupSelected ? null : group)}
                  >
                    {group}
                    <span className="receipt" style={{ marginLeft: "6px" }}>
                      {groupFiltered.length}
                    </span>
                  </div>
                  {groupFiltered.map((ep) => (
                    <div
                      key={ep.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "5px 16px 5px 24px",
                        cursor: "pointer",
                        background: selectedEndpoint?.id === ep.id ? "var(--accent-soft)" : selectedEndpoints.has(ep.id) ? "var(--success-soft)" : "transparent",
                        borderLeft: selectedEndpoint?.id === ep.id ? "2px solid var(--accent)" : selectedEndpoints.has(ep.id) ? "2px solid var(--success)" : "2px solid transparent",
                      }}
                      onClick={() => selectEndpoint(ep)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEndpoints.has(ep.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleEndpointSelection(ep.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginRight: "4px" }}
                      />
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: METHOD_COLORS[ep.method] ?? "var(--ink)",
                          letterSpacing: "0.04em",
                          minWidth: "38px",
                        }}
                      >
                        {ep.method}
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {ep.name || ep.path}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
        </div>

        <div
          style={{
            padding: "6px 16px",
            borderTop: "1px solid var(--divider)",
            fontSize: "12px",
            color: "var(--secondary)",
          }}
        >
          {filteredEndpoints.length} / {endpoints.length} 个接口
        </div>
      </div>

      {/* ── Right: request editor + response ── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {selectedEndpoint ? (
          <RequestPanel
            endpoint={selectedEndpoint}
            generatedRequest={generatedRequest}
            sendResult={sendResult}
            sending={sending}
            onSend={() => sendRequest(selectedEndpoint.id)}
            baseUrl={currentProject?.baseUrl || "http://localhost:8080"}
            editedOverrides={editedOverrides}
            setEditedParam={setEditedParam}
            setEditedHeader={setEditedHeader}
            setEditedBody={setEditedBody}
            resetOverrides={resetOverrides}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--secondary)",
              fontSize: "14px",
            }}
          >
            选择一个接口来查看详情
          </div>
        )}
      </div>
      {/* Login dialog */}
      {showLogin && (
        <div className="overlay" onClick={() => setShowLogin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "360px" }}>
            <div className="fmark" style={{ marginBottom: "16px" }}>登录到 {currentProject?.baseUrl || "http://localhost:8080"}</div>
            {loginError && <div style={{ color: "var(--method-delete, #b52d2d)", fontSize: "13px", marginBottom: "8px" }}>{loginError}</div>}
            <div style={{ marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="用户名"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--divider)", borderRadius: "6px", fontSize: "13px", background: "var(--bg)", color: "var(--ink)", outline: "none" }}
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <input
                type="password"
                placeholder="密码"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--divider)", borderRadius: "6px", fontSize: "13px", background: "var(--bg)", color: "var(--ink)", outline: "none" }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="pill" onClick={() => setShowLogin(false)}>取消</button>
              <button
                className="pill"
                style={{ background: "var(--accent)", color: "#fff", fontWeight: 600, padding: "6px 20px" }}
                disabled={loginLoading}
                onClick={async () => {
                  setLoginLoading(true);
                  setLoginError("");
                  const ok = await doLogin(currentProject?.baseUrl || "http://localhost:8080", loginUser, loginPass, true);
                  setLoginLoading(false);
                  if (ok) {
                    setShowLogin(false);
                    setLoginUser("");
                    setLoginPass("");
                  } else {
                    setLoginError("登录失败，请检查用户名和密码");
                  }
                }}
              >
                {loginLoading ? "登录中…" : "登录"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Batch test results */}
      {showBatchResults && batchSummary && (
        <div className="overlay" onClick={() => setShowBatchResults(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "480px", maxHeight: "80vh", overflow: "auto" }}>
            <div className="fmark" style={{ marginBottom: "16px" }}>批量测试结果</div>
            <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
              <div style={{ flex: 1, textAlign: "center", padding: "12px", background: "var(--success-soft)", borderRadius: "6px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--success)" }}>{batchSummary.passed}</div>
                <div style={{ fontSize: "12px", color: "var(--secondary)" }}>通过</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "12px", background: "var(--rust-soft)", borderRadius: "6px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--rust)" }}>{batchSummary.failed}</div>
                <div style={{ fontSize: "12px", color: "var(--secondary)" }}>失败</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "12px", background: "var(--paper-2)", borderRadius: "6px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)" }}>{batchSummary.total}</div>
                <div style={{ fontSize: "12px", color: "var(--secondary)" }}>总计</div>
              </div>
            </div>
            <div style={{ maxHeight: "400px", overflow: "auto" }}>
              {batchResults.map((result) => (
                <div
                  key={result.endpointId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px",
                    borderBottom: "1px solid var(--divider)",
                    background: result.success ? "var(--success-soft)" : "var(--rust-soft)",
                  }}
                >
                  <span style={{ color: result.success ? "var(--success)" : "var(--rust)", fontWeight: 600 }}>
                    {result.success ? "✓" : "✗"}
                  </span>
                  <span style={{ flex: 1, fontSize: "13px" }}>{result.endpointId.slice(0, 20)}...</span>
                  <span style={{ fontSize: "12px", color: "var(--secondary)" }}>
                    {result.statusCode || "—"}
                  </span>
                  {result.responseTimeMs !== undefined && (
                    <span style={{ fontSize: "11px", color: "var(--secondary)" }}>
                      {result.responseTimeMs}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button className="pill" onClick={() => setShowBatchResults(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
      {/* Toast notification */}
      {toastMessage && <Toast message={toastMessage} onClose={clearToast} />}
    </div>
  );
}

/* ── Request Panel ── */

interface RequestPanelProps {
  endpoint: EndpointDetail;
  generatedRequest: GeneratedRequest | null;
  sendResult: RequestResult | null;
  sending: boolean;
  onSend: () => void;
  baseUrl: string;
  editedOverrides: { params: Record<string, string>; headers: Record<string, string>; body: string };
  setEditedParam: (key: string, value: string) => void;
  setEditedHeader: (key: string, value: string) => void;
  setEditedBody: (value: string) => void;
  resetOverrides: () => void;
}

function RequestPanel({ endpoint, generatedRequest, sendResult, sending, onSend, baseUrl, editedOverrides, setEditedParam, setEditedHeader, setEditedBody, resetOverrides }: RequestPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Endpoint header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--divider)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: METHOD_COLORS[endpoint.method] ?? "var(--ink)",
              letterSpacing: "0.04em",
            }}
          >
            {endpoint.method}
          </span>
          <span style={{ fontSize: "14px", color: "var(--ink)", fontWeight: 500 }}>
            {endpoint.path}
          </span>
          {endpoint.name && endpoint.name !== endpoint.path && (
            <span className="receipt">{endpoint.name}</span>
          )}
        </div>
        <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="receipt" style={{ flexShrink: 0 }}>Base URL</span>
          <span
            style={{
              flex: 1,
              padding: "4px 8px",
              border: "1px solid var(--divider)",
              borderRadius: "4px",
              fontSize: "13px",
              fontFamily: "monospace",
              color: "var(--ink)",
              background: "var(--surface)",
            }}
          >
            {baseUrl}
          </span>
          <button
            className="pill"
            disabled={sending || !generatedRequest}
            style={{
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              padding: "5px 16px",
              cursor: sending ? "wait" : "pointer",
              opacity: sending || !generatedRequest ? 0.6 : 1,
            }}
            onClick={onSend}
          >
            {sending ? "发送中…" : "发送"}
          </button>
        </div>
        {endpoint.tags.length > 0 && (
          <div style={{ marginTop: "6px", display: "flex", gap: "4px" }}>
            {endpoint.tags.map((t) => (
              <span key={t} className="pill" style={{ fontSize: "11px" }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Request parameters — editable */}
      {generatedRequest && (
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--divider)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <div className="fmark" style={{ margin: 0 }}>请求参数</div>
            <button className="pill" style={{ fontSize: "11px", background: "var(--paper-3)", color: "var(--secondary)" }} onClick={resetOverrides}>重置</button>
          </div>

          {/* Params */}
          {Object.keys(editedOverrides.params).length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <div className="receipt" style={{ marginBottom: "2px" }}>参数</div>
              <EditableParams params={editedOverrides.params} onChange={setEditedParam} />
            </div>
          )}

          {/* Headers */}
          {Object.keys(editedOverrides.headers).length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <div className="receipt" style={{ marginBottom: "2px" }}>请求头</div>
              <EditableParams params={editedOverrides.headers} onChange={setEditedHeader} />
            </div>
          )}

          {/* Body */}
          {editedOverrides.body && (
            <div style={{ marginBottom: "10px" }}>
              <div className="receipt" style={{ marginBottom: "2px" }}>请求体</div>
              <textarea
                value={editedOverrides.body}
                onChange={(e) => setEditedBody(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "80px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  background: "var(--surface)",
                  border: "1px solid var(--divider)",
                  borderRadius: "4px",
                  padding: "8px",
                  color: "var(--ink)",
                  lineHeight: 1.5,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Generation info */}
          {generatedRequest.generationInfo.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--secondary)" }}>
                生成策略 ({generatedRequest.generationInfo.length})
              </summary>
              <div style={{ marginTop: "4px" }}>
                {generatedRequest.generationInfo.map((gi, i) => (
                  <div key={`${gi.field}-${i}`} style={{ fontSize: "12px", padding: "2px 0", color: "var(--secondary)" }}>
                    <span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{gi.field}</span>
                    {" → "}
                    <span>{gi.reason}</span>
                    {" ("}
                    <span style={{ color: gi.confidence > 0.7 ? "var(--method-get, #2d8a4e)" : "var(--method-put, #b58a1a)" }}>
                      {Math.round(gi.confidence * 100)}%
                    </span>
                    {")"}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Parameters table (when no generated request yet) */}
      {!generatedRequest && (
        <div style={{ padding: "16px 24px" }}>
          <div className="fmark" style={{ marginBottom: "8px" }}>参数</div>
          {endpoint.parameters.length === 0 ? (
            <div className="receipt">无参数</div>
          ) : (
            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--divider)" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, fontSize: "12px" }}>参数名</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, fontSize: "12px" }}>位置</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, fontSize: "12px" }}>类型</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, fontSize: "12px" }}>必填</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.parameters.map((p, i) => (
                  <tr key={`${p.name}-${i}`} style={{ borderBottom: "1px solid var(--divider)" }}>
                    <td style={{ padding: "4px 8px", fontFamily: "monospace", color: "var(--accent)" }}>{p.name}</td>
                    <td style={{ padding: "4px 8px" }}>{p.location}</td>
                    <td style={{ padding: "4px 8px" }}>{p.type}</td>
                    <td style={{ padding: "4px 8px" }}>{p.required ? "是" : "否"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Response */}
      {sendResult && (
        <div style={{ padding: "16px 24px", flex: 1, overflowY: "auto" }}>
          <div className="fmark" style={{ marginBottom: "8px" }}>响应</div>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: sendResult.statusCode === 0
                  ? METHOD_COLORS.DELETE
                  : sendResult.statusCode < 300
                    ? METHOD_COLORS.GET
                    : sendResult.statusCode < 400
                      ? METHOD_COLORS.PUT
                      : METHOD_COLORS.DELETE,
              }}
            >
              {sendResult.statusCode} {sendResult.statusText}
            </span>
            <span className="receipt">{sendResult.responseTimeMs}ms</span>
            <span className="receipt">{sendResult.responseSize} bytes</span>
          </div>

          {/* Response headers */}
          {Object.keys(sendResult.headers).length > 0 && (
            <details style={{ marginBottom: "8px" }}>
              <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--secondary)" }}>
                响应头 ({Object.keys(sendResult.headers).length})
              </summary>
              <ParamTable params={sendResult.headers} />
            </details>
          )}

          {/* Response body */}
          <pre
            style={{
              fontSize: "12px",
              fontFamily: "monospace",
              background: "var(--surface)",
              padding: "10px",
              borderRadius: "4px",
              overflow: "auto",
              margin: 0,
              color: "var(--ink)",
              lineHeight: 1.5,
              maxHeight: "400px",
            }}
          >
            {formatBody(sendResult.body, sendResult.contentType)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

function ParamTable({ params }: { params: Record<string, string> }) {
  return (
    <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
      <tbody>
        {Object.entries(params).map(([key, val]) => (
          <tr key={key} style={{ borderBottom: "1px solid var(--divider)" }}>
            <td style={{ padding: "3px 8px 3px 0", color: "var(--accent)", fontFamily: "monospace", fontWeight: 500 }}>
              {key}
            </td>
            <td style={{ padding: "3px 0", fontFamily: "monospace" }}>{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatBody(body: string, contentType: string): string {
  if (contentType.includes("json")) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isError = message.startsWith("❌");
  return (
    <div style={{
      position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
      background: isError ? "var(--danger, #e53e3e)" : "var(--success, #38a169)",
      color: "#fff", padding: "10px 20px", borderRadius: "8px",
      fontSize: "13px", fontWeight: 500, zIndex: 9999,
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)", maxWidth: "90vw",
      display: "flex", alignItems: "center", gap: "8px",
      animation: "toastIn 0.3s ease-out",
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", padding: "0 4px" }}>×</button>
      <style>{`
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  );
}

function EditableParams({ params, onChange }: { params: Record<string, string>; onChange: (key: string, value: string) => void }) {
  return (
    <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid var(--divider)" }}>
          <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, fontSize: "12px" }}>参数名</th>
          <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, fontSize: "12px" }}>值</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(params).map(([key, val]) => (
          <tr key={key} style={{ borderBottom: "1px solid var(--divider)" }}>
            <td style={{ padding: "4px 8px", fontFamily: "monospace", color: "var(--accent)", whiteSpace: "nowrap" }}>{key}</td>
            <td style={{ padding: "4px 8px", width: "100%" }}>
              <input
                type="text"
                value={val}
                onChange={(e) => onChange(key, e.target.value)}
                style={{
                  width: "100%",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  background: "var(--surface)",
                  border: "1px solid var(--divider)",
                  borderRadius: "3px",
                  padding: "3px 6px",
                  color: "var(--ink)",
                  boxSizing: "border-box",
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--divider)"; }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
