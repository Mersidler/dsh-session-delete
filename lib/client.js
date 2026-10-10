window.__ModuleLoader__.load({
  id: "dsh-delete-sessions",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");
    let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

    /* ============================================================
     * dsh-delete-sessions —— 浏览器半
     *
     * 在设置面板注册一个「归档会话」页面：
     *  - 全部会话：勾选批量删除（先进回收站，可还原）
     *  - 回收站：还原 / 彻底删除 / 清空
     * 标题取侧栏同源的 sessions 服务，零解压。
     * ============================================================ */

    /** 词典命名空间。 */
    const NS = "sessionDelete";
    /** 依赖的服务。 */
    const inject = ["slots", "locale"];
    /** 宿主路由前缀。 */
    const API = "/api/session-delete";
    /** 设置页中的排序位置。 */
    const SECTION_ORDER = 90;

    /**
     * 面板样式。控件本身走 dsh 的 primitives，这里只画布局，
     * 颜色/圆角/字号一律取宿主的 --dsw-* 设计令牌，所以深浅色和主题切换都跟着走。
     */
    const CSS = `
.sd-panel { display: flex; flex-direction: column; gap: 14px; }
.sd-intro { color: var(--dsw-alias-label-secondary); font-size: var(--dsw-font-xs-13); line-height: 1.55; }
.sd-path { margin-top: 4px; font-family: var(--ds-font-family-code); font-size: 12px; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.sd-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sd-toolbar__spacer { flex: 1 1 auto; }
.sd-search { flex: 0 1 260px; min-width: 150px; }
.sd-list { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md); overflow: hidden; }
.sd-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 9px 12px; border-bottom: 1px solid var(--dsw-alias-border-l2); transition: background var(--ds-transition-duration-fast) var(--ds-ease-in-out); }
.sd-row:last-child { border-bottom: 0; }
.sd-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.sd-row--selected { background: var(--dsw-alias-bg-layer-1); }
.sd-row__main { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.sd-row__title { font-size: var(--dsw-font-xs-13); color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sd-row__meta { font-size: 12px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sd-row__size, .sd-row__time { font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sd-row__time { min-width: 116px; text-align: right; }
.sd-row__actions { display: flex; gap: 6px; }
.sd-row--trash { grid-template-columns: minmax(0, 1fr) auto auto; }
.sd-btn--danger { color: var(--dsw-alias-state-error-primary); }
/* 行内勾选只要方框：primitives.Checkbox 总会渲染 label 节点，所以把它视觉隐藏，
   留给读屏器一个可读的会话名，而不是删掉可访问名。 */
.sd-check { position: relative; margin: 0; }
.sd-check > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.sd-empty { padding: 26px 12px; text-align: center; color: var(--dsw-alias-label-tertiary); font-size: var(--dsw-font-xs-13); border: 1px dashed var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); }
.sd-empty--error { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.sd-notice { padding: 7px 10px; border-radius: var(--dsw-radius-sm); font-size: var(--dsw-font-xs-13); background: var(--dsw-alias-bg-layer-1); }
.sd-notice--ok { color: var(--dsw-alias-state-success-primary); }
.sd-notice--error { color: var(--dsw-alias-state-error-primary); }
@media (max-width: 720px) {
  .sd-row { grid-template-columns: 22px minmax(0, 1fr); row-gap: 2px; }
  .sd-row--trash { grid-template-columns: minmax(0, 1fr) auto; }
  .sd-row__size, .sd-row__time { display: none; }
}
`;
    /**
     * 注入样式表。在工厂体里执行，client-modules 的 claimStyles 会把这张表登记到
     * 本插件名下，插件卸载或热替换时一并回收，不会留下孤儿样式。
     */
    if (typeof document !== "undefined" && document.querySelector('style[data-plugin="dsh-delete-sessions"]') === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-delete-sessions";
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    const en = {
      nav: "Session trash",
      title: "Session trash",
      intro: "dsh's built-in archive only hides a session from the sidebar; its logs stay on disk. Deleting here moves the session folder out of ~/.dsh/sessions into the trash below — this is the plugin's own trash, not the OS Recycle Bin.",
      trashAt: "Trash location",
      deleteDone: "Moved to the session trash.",
      tabSessions: "All sessions",
      tabTrash: "Trash",
      search: "Search sessions",
      searchPlaceholder: "Search by title, id or project",
      selectAll: "Select all",
      clearSelection: "Clear selection",
      colTitle: "Session",
      colProject: "Project",
      colSize: "Size",
      colUpdated: "Updated",
      colActions: "Actions",
      deleteSelected: "Delete selected",
      restore: "Restore",
      purge: "Delete permanently",
      emptyTrash: "Empty trash",
      emptySessions: "No sessions found on disk.",
      emptyTrashList: "The trash is empty.",
      loading: "Loading…",
      refresh: "Refresh",
      confirmDeleteTitle: "Move to trash?",
      confirmDeleteDesc: "{n} selected session(s) will be moved to the trash and can be restored later.",
      confirmPurgeTitle: "Delete permanently?",
      confirmPurgeDesc: "{n} item(s) will be deleted permanently and cannot be recovered.",
      confirmEmptyTitle: "Empty the trash?",
      confirmEmptyDesc: "Every item in the trash will be deleted permanently and cannot be recovered.",
      cancel: "Cancel",
      confirm: "Confirm",
      failure: "Some operations failed. Please retry.",
      countLabel: "{n} sessions",
      trashCountLabel: "{n} items",
      deleteOk: "Moved to trash.",
      restoreOk: "Restored.",
      purgeOk: "Deleted permanently.",
      clearOk: "Trash emptied.",
      menuDelete: "Delete session",
      menuDeleteDesc: "Session {id} moves out of ~/.dsh/sessions into this plugin's trash — not the OS Recycle Bin. Restore or purge it from Settings → Session trash."
    };

    const zh = {
      nav: "会话回收站",
      title: "会话回收站",
      intro: "dsh 自带的「归档」只是把会话移出侧栏，磁盘日志仍在原处。这里的删除会把会话目录从 ~/.dsh/sessions 挪进下方回收站 —— 是本插件自己的回收站文件夹，不是系统回收站。",
      trashAt: "回收站位置",
      deleteDone: "已移入会话回收站。",
      tabSessions: "全部会话",
      tabTrash: "回收站",
      search: "搜索会话",
      searchPlaceholder: "按标题、ID 或项目搜索",
      selectAll: "全选",
      clearSelection: "取消选择",
      colTitle: "会话",
      colProject: "项目",
      colSize: "占用",
      colUpdated: "更新时间",
      colActions: "操作",
      deleteSelected: "删除所选",
      restore: "还原",
      purge: "彻底删除",
      emptyTrash: "清空回收站",
      emptySessions: "磁盘上没有找到会话。",
      emptyTrashList: "回收站是空的。",
      loading: "加载中…",
      refresh: "刷新",
      confirmDeleteTitle: "移入回收站？",
      confirmDeleteDesc: "将把所选 {n} 个会话移入回收站，之后仍可还原。",
      confirmPurgeTitle: "彻底删除？",
      confirmPurgeDesc: "将永久删除所选 {n} 个条目，无法恢复。",
      confirmEmptyTitle: "清空回收站？",
      confirmEmptyDesc: "将永久删除回收站中的全部条目，无法恢复。",
      cancel: "取消",
      confirm: "确认",
      failure: "部分操作失败，请重试。",
      countLabel: "{n} 个会话",
      trashCountLabel: "{n} 个条目",
      deleteOk: "已移入回收站。",
      restoreOk: "已还原。",
      purgeOk: "已彻底删除。",
      clearOk: "回收站已清空。",
      menuDelete: "删除会话",
      menuDeleteDesc: "会话 {id} 的目录将从 ~/.dsh/sessions 挪进本插件的回收站，不是系统回收站。可在「设置 → 会话回收站」还原或彻底删除。"
    };

    /** 字节数的紧凑可读形式。 */
    function formatBytes(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      const units = ["KB", "MB", "GB", "TB"];
      let value = bytes / 1024;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
    }

    /** 时间戳的紧凑可读形式。 */
    function formatTime(ms) {
      if (!ms) return "—";
      const d = new Date(ms);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    /** 用文案模板做简单插值。 */
    function fill(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (match, key) =>
        Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
    }

    /** 读取会话标题映射；缺失时回落到会话 ID。 */
    function readTitles(ctx) {
      const titles = {};
      try {
        const sessions = ctx.get("sessions");
        const byId = sessions?.list?.getSnapshot?.().byId ?? {};
        for (const [id, row] of Object.entries(byId)) {
          const title = row?.title ?? row?.displayTitle;
          if (typeof title === "string" && title !== "") titles[id] = title;
        }
      } catch {
        /* 服务缺失时全部回落到 ID */
      }
      return titles;
    }

    /** 发起一次宿主路由请求。 */
    async function call(path, body) {
      const response = await fetch(`${API}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {})
      });
      const text = await response.text();
      let value = null;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error(`bad response: ${response.status}`);
      }
      if (!response.ok || value?.ok !== true) {
        throw new Error(value?.error ?? `request failed: ${response.status}`);
      }
      return value;
    }

    /** 拉取一次全量状态。 */
    async function loadState() {
      const response = await fetch(`${API}/state`);
      const value = await response.json();
      if (!response.ok || value?.ok !== true) {
        throw new Error(value?.error ?? `request failed: ${response.status}`);
      }
      return value;
    }

    /**
     * 回收站绝对路径，激活时取一次给确认框和提示用。
     * 走轻量的 /paths 而不是 /state：后者要遍历全部会话目录算字节数，
     * 只为拼一句提示不值得。取不到就留空，文案照样成立。
     */
    let trashHint = "";
    async function loadTrashHint() {
      try {
        const response = await fetch(`${API}/paths`);
        const value = await response.json();
        if (response.ok && value?.ok === true && typeof value.trashDir === "string") trashHint = value.trashDir;
      } catch {
        /* 提示里没有路径而已 */
      }
    }

    /**
     * 确认弹窗：复用 dsh 自己的 Modal / Button，外观与官方「归档会话」确认框一致。
     * busy 期间禁止关闭，避免删除进行中留下半截状态；error 走 Modal 正文，
     * 不另起游离节点。
     */
    function ConfirmDialog({ title, description, confirmLabel, cancelLabel, busy, error, onConfirm, onCancel }) {
      return react_jsx_runtime.jsx(primitives.Modal, {
        open: true,
        onClose: onCancel,
        closeLabel: cancelLabel,
        title,
        description,
        footer: react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, { children: [
          react_jsx_runtime.jsx(primitives.Button, { variant: "outline", disabled: busy === true, onClick: onCancel, children: cancelLabel }),
          react_jsx_runtime.jsx(primitives.Button, { variant: "outline", disabled: busy === true, onClick: onConfirm, children: confirmLabel })
        ] }),
        children: error ? react_jsx_runtime.jsx("div", { role: "alert", children: error }) : null
      });
    }

    /** 管理面板主体。 */
    function SessionDeletePanel({ ctx, t }) {
      const [tab, setTab] = react.useState("sessions");
      const [state, setState] = react.useState(null);
      const [error, setError] = react.useState(null);
      const [query, setQuery] = react.useState("");
      const [selected, setSelected] = react.useState(() => new Set());
      const [confirm, setConfirm] = react.useState(null);
      const [notice, setNotice] = react.useState(null);

      const titlesRef = react.useRef({});
      const titles = react.useMemo(() => readTitles(ctx), [ctx, state]);

      const reload = react.useCallback(async () => {
        try {
          const next = await loadState();
          titlesRef.current = readTitles(ctx);
          setState(next);
          setError(null);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      }, [ctx]);

      react.useEffect(() => {
        reload();
      }, [reload]);

      /** 切换某一行的选中状态。 */
      const toggle = (id) => {
        setSelected((previous) => {
          const next = new Set(previous);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      };

      /** 展示一行可读名称。 */
      const labelOf = (id) => titles[id] ?? titlesRef.current[id] ?? id;

      const sessions = state?.sessions ?? [];
      const trash = state?.trash ?? [];

      const filteredSessions = react.useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (needle === "") return sessions;
        return sessions.filter((row) => {
          const haystack = `${labelOf(row.id)} ${row.id} ${row.projectKey}`.toLowerCase();
          return haystack.includes(needle);
        });
      }, [sessions, query, titles]);

      const filteredTrash = react.useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (needle === "") return trash;
        return trash.filter((row) => {
          const haystack = `${row.id} ${row.key} ${row.projectKey}`.toLowerCase();
          return haystack.includes(needle);
        });
      }, [trash, query]);

      /** 一批操作的结果通知：有失败就把首个失败码带出来，不要统一压成「部分操作失败」。 */
      const settle = (result, okText) => {
        const failed = result.results?.find((row) => !row.ok);
        setNotice(failed === undefined
          ? { kind: "ok", text: okText }
          : { kind: "error", text: failureText(failed.error, t) });
      };

      /** 执行一批删除，随后刷新。 */
      const runDelete = async (ids) => {
        try {
          const result = await deleteSessions(ids);
          settle(result, t("deleteOk"));
          setSelected(new Set());
          await reload();
        } catch (reason) {
          setNotice({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
        }
      };

      const runRestore = async (keys) => {
        try {
          const result = await call("restore", { keys });
          settle(result, t("restoreOk"));
          await reload();
        } catch (reason) {
          setNotice({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
        }
      };

      const runPurge = async (keys) => {
        try {
          const result = await call("purge", { keys });
          settle(result, t("purgeOk"));
          await reload();
        } catch (reason) {
          setNotice({ kind: "error", text: reason instanceof Error ? reason.message : String(reason) });
        }
      };

      if (state === null && error === null) {
        return react_jsx_runtime.jsx("div", { className: "sd-panel", children: react_jsx_runtime.jsx("div", { className: "sd-empty", children: t("loading") }) });
      }

      if (error !== null) {
        return react_jsx_runtime.jsx("div", { className: "sd-panel", children: react_jsx_runtime.jsx("div", { className: "sd-empty sd-empty--error", children: error }) });
      }

      const allSelected = filteredSessions.length > 0 && filteredSessions.every((row) => selected.has(row.id));

      return react_jsx_runtime.jsxs("div", {
        className: "sd-panel",
        children: [
          react_jsx_runtime.jsxs("div", { children: [
            react_jsx_runtime.jsx("div", { className: "sd-intro", children: t("intro") }),
            state.trashDir ? react_jsx_runtime.jsx("div", { className: "sd-path", children: `${t("trashAt")}: ${state.trashDir}` }) : null
          ] }),
          react_jsx_runtime.jsxs("div", {
            className: "sd-toolbar",
            children: [
              react_jsx_runtime.jsx(primitives.SegmentedTabs, {
                label: t("title"),
                value: tab,
                onChange: (next) => { setTab(next); setSelected(new Set()); },
                items: [
                  { value: "sessions", label: `${t("tabSessions")} · ${fill(t("countLabel"), { n: sessions.length })}` },
                  { value: "trash", label: `${t("tabTrash")} · ${fill(t("trashCountLabel"), { n: trash.length })}` }
                ]
              }),
              react_jsx_runtime.jsx("span", { className: "sd-toolbar__spacer" }),
              react_jsx_runtime.jsx(primitives.Input, {
                className: "sd-search",
                type: "search",
                icon: react_jsx_runtime.jsx(primitives.IconSearchOutlineRegular, { size: 14 }),
                value: query,
                placeholder: t("searchPlaceholder"),
                "aria-label": t("search"),
                onChange: (event) => setQuery(event.target.value)
              }),
              react_jsx_runtime.jsx(primitives.Button, {
                variant: "ghost",
                onClick: reload,
                children: t("refresh")
              })
            ]
          }),
          notice !== null && react_jsx_runtime.jsx("div", { className: `sd-notice sd-notice--${notice.kind}`, children: notice.text }),
          tab === "sessions"
            ? react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, { children: [
                react_jsx_runtime.jsxs("div", {
                  className: "sd-toolbar",
                  children: [
                    react_jsx_runtime.jsx(primitives.Checkbox, {
                      checked: allSelected,
                      label: allSelected ? t("clearSelection") : t("selectAll"),
                      onChange: (next) => setSelected(next ? new Set(filteredSessions.map((row) => row.id)) : new Set())
                    }),
                    react_jsx_runtime.jsx("span", { className: "sd-toolbar__spacer" }),
                    react_jsx_runtime.jsx(primitives.Button, {
                      variant: "outline",
                      className: "sd-btn--danger",
                      disabled: selected.size === 0,
                      onClick: () => setConfirm({
                        kind: "delete",
                        title: t("confirmDeleteTitle"),
                        desc: fill(t("confirmDeleteDesc"), { n: selected.size }),
                        onOk: () => runDelete([...selected])
                      }),
                      children: selected.size > 0 ? `${t("deleteSelected")} (${selected.size})` : t("deleteSelected")
                    })
                  ]
                }),
                filteredSessions.length === 0
                  ? react_jsx_runtime.jsx("div", { className: "sd-empty", children: t("emptySessions") })
                  : react_jsx_runtime.jsx("div", {
                      className: "sd-list",
                      children: filteredSessions.map((row) => react_jsx_runtime.jsxs("div", {
                        className: `sd-row${selected.has(row.id) ? " sd-row--selected" : ""}`,
                        children: [
                          react_jsx_runtime.jsx(primitives.Checkbox, {
                            className: "sd-check",
                            checked: selected.has(row.id),
                            label: labelOf(row.id),
                            onChange: () => toggle(row.id)
                          }),
                          react_jsx_runtime.jsxs("div", {
                            className: "sd-row__main",
                            children: [
                              react_jsx_runtime.jsx("div", { className: "sd-row__title", title: row.id, children: labelOf(row.id) }),
                              react_jsx_runtime.jsx("div", { className: "sd-row__meta", children: row.projectKey })
                            ]
                          }),
                          react_jsx_runtime.jsx("span", { className: "sd-row__size", children: formatBytes(row.bytes) }),
                          react_jsx_runtime.jsx("span", { className: "sd-row__time", children: formatTime(row.mtimeMs) })
                        ]
                      }, row.id))
                    })
              ] })
            : react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, { children: [
                react_jsx_runtime.jsxs("div", {
                  className: "sd-toolbar",
                  children: [
                    react_jsx_runtime.jsx("span", { className: "sd-toolbar__spacer" }),
                    react_jsx_runtime.jsx(primitives.Button, {
                      variant: "outline",
                      className: "sd-btn--danger",
                      disabled: trash.length === 0,
                      onClick: () => setConfirm({
                        kind: "empty",
                        title: t("confirmEmptyTitle"),
                        desc: t("confirmEmptyDesc"),
                        onOk: () => runPurge(trash.map((row) => row.key))
                      }),
                      children: t("emptyTrash")
                    })
                  ]
                }),
                filteredTrash.length === 0
                  ? react_jsx_runtime.jsx("div", { className: "sd-empty", children: t("emptyTrashList") })
                  : react_jsx_runtime.jsx("div", {
                      className: "sd-list",
                      children: filteredTrash.map((row) => react_jsx_runtime.jsxs("div", {
                        className: "sd-row sd-row--trash",
                        children: [
                          react_jsx_runtime.jsxs("div", {
                            className: "sd-row__main",
                            children: [
                              react_jsx_runtime.jsx("div", { className: "sd-row__title", title: row.id, children: row.id }),
                              react_jsx_runtime.jsx("div", { className: "sd-row__meta", children: `${row.projectKey} · ${formatTime(row.deletedAt)}` })
                            ]
                          }),
                          react_jsx_runtime.jsx("span", { className: "sd-row__size", children: formatBytes(row.bytes) }),
                          react_jsx_runtime.jsxs("div", {
                            className: "sd-row__actions",
                            children: [
                              react_jsx_runtime.jsx(primitives.Button, {
                                variant: "ghost",
                                onClick: () => setConfirm({
                                  kind: "restore",
                                  title: t("restore"),
                                  desc: fill(t("confirmDeleteDesc"), { n: 1 }),
                                  onOk: () => runRestore([row.key])
                                }),
                                children: t("restore")
                              }),
                              react_jsx_runtime.jsx(primitives.Button, {
                                variant: "ghost",
                                className: "sd-btn--danger",
                                onClick: () => setConfirm({
                                  kind: "purge",
                                  title: t("confirmPurgeTitle"),
                                  desc: fill(t("confirmPurgeDesc"), { n: 1 }),
                                  onOk: () => runPurge([row.key])
                                }),
                                children: t("purge")
                              })
                            ]
                          })
                        ]
                      }, row.key))
                    })
              ] }),
          confirm !== null && react_jsx_runtime.jsx(ConfirmDialog, {
            title: confirm.title,
            description: confirm.desc,
            confirmLabel: t("confirm"),
            cancelLabel: t("cancel"),
            onCancel: () => setConfirm(null),
            onConfirm: () => {
              const run = confirm.onOk;
              setConfirm(null);
              run();
            }
          })
        ]
      });
    }

    /**
     * 侧栏菜单与全局确认框之间的唯一交接点。
     * 菜单项挂在会话行上，弹窗必须挂在全局 shell.overlay，两者没有组件树关系，
     * 所以用一个外部 store 传请求，由 overlay 那一侧订阅。
     */
    const deleteRequest = (() => {
      let current = null;
      const listeners = new Set();
      return {
        get: () => current,
        set(next) {
          current = next;
          for (const listener of listeners) listener();
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        }
      };
    })();

    /** 订阅当前待确认的删除请求。 */
    function useDeleteRequest() {
      return react.useSyncExternalStore(deleteRequest.subscribe, deleteRequest.get, deleteRequest.get);
    }

    /**
     * 宿主失败码的可见文案。未知码原样带出 —— 之前一律压成「部分操作失败」，
     * 真出问题时没人看得懂是哪一步拒的。
     */
    function failureText(error, t) {
      if (error === undefined) return t("failure")
      return `${t("failure")}（${error}）`
    }

    /** 等一下，给宿主把 agent 停干净。 */
    function sleep(ms) {
      return new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    }

    /**
     * 删除一批会话。
     *
     * 只调宿主路由：挪完目录后宿主会补发 api-session/removed，浏览器把侧栏那一行
     * 从列表投影里摘掉，所以既不需要先归档（那会在删盘失败时留下「会话不见了、
     * 磁盘还在、还删不掉」的半截状态），也不需要刷新页面。
     *
     * 保留有界重试：agent 释放会话日志的文件句柄是异步的，Windows 上抢在前面
     * rename 会撞 EPERM/EBUSY，等一拍再比重试几次更省事。
     */
    async function deleteSessions(ids) {
      let result;
      for (let attempt = 0; ; attempt += 1) {
        result = await call("delete", { ids });
        const locked = (row) => !row.ok && /EPERM|EBUSY/i.test(String(row.error));
        if (attempt >= 6 || !result.results?.some(locked)) return result;
        await sleep(250);
      }
    }

    /** 侧栏删除一条；失败时抛带原因的文案。 */
    async function runDelete(sessionId, t) {
      const result = await deleteSessions([sessionId]);
      const row = result.results?.find((item) => item.id === sessionId);
      if (row?.ok !== true) throw new Error(failureText(row?.error, t));
    }

    /** 取到回收站绝对路径就附在句尾；没取到也不该留个空括号。 */
    function withTrash(template, values, t) {
      const base = fill(template, values);
      return trashHint === "" ? base : `${base} ${t("trashAt")}: ${trashHint}`;
    }

    /**
     * 挂在 shell.overlay 上：服务侧栏菜单的确认框，以及删除成功后的原生 Toast。
     * 确认框不能挂在菜单项里，菜单一关就跟着卸载了。
     */
    function DeleteConfirmSeat({ t }) {
      const request = useDeleteRequest();
      const [busy, setBusy] = react.useState(false);
      const [error, setError] = react.useState(null);
      const [done, setDone] = react.useState(false);
      if (request === null) {
        if (!done) return null;
        return react_jsx_runtime.jsx(primitives.Toast, {
          text: withTrash(t("deleteDone"), {}, t),
          tone: "success",
          holdMs: 6000,
          onDone: () => setDone(false)
        });
      }
      const close = () => {
        if (!busy) deleteRequest.set(null);
      };
      const confirm = () => {
        setBusy(true);
        setError(null);
        runDelete(request.sessionId, t).then(() => {
          setBusy(false);
          deleteRequest.set(null);
          setDone(true);
        }).catch((reason) => {
          setBusy(false);
          setError(reason instanceof Error ? reason.message : String(reason));
        });
      };
      return react_jsx_runtime.jsx(ConfirmDialog, {
        title: t("confirmDeleteTitle"),
        description: withTrash(t("menuDeleteDesc"), { id: request.sessionId }, t),
        confirmLabel: t("confirm"),
        cancelLabel: t("cancel"),
        busy,
        error,
        onConfirm: confirm,
        onCancel: close
      });
    }

    /**
     * 侧栏会话 "..." 菜单项：真正删除该会话的磁盘日志。
     * 槽位 sidebar.workspaces.session.menu.item 由 dsh-client-ui-workspace 声明，
     * 官方那四项（置顶/重命名/分叉/归档）也从这里注册，order 分别 100..400。
     * 宿主会给菜单项组件注入自己的 t，所以本插件的文案走 sd 这个独立 prop，
     * 避免命名空间串台。
     */
    function DeleteSessionMenuItem({ sessionId, useMenuOpenState, sd }) {
      const [, setMenuOpen] = useMenuOpenState();
      return react_jsx_runtime.jsx(primitives.MenuItemButton, {
        icon: react_jsx_runtime.jsx(primitives.IconTrashOutlineRegular, { size: 14 }),
        onSelect: () => {
          setMenuOpen(false);
          sd.request(sessionId);
        },
        children: sd.t("menuDelete")
      });
    }

    /**
     * 挂载设置页面板与侧栏菜单项。
     * @param ctx - 浏览器插件上下文。
     */
    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-delete: dictionaries");
      // settings.section 由设置外壳的 children 表声明；插件激活时它可能还没声明，
      // 直接 ctx.slots.register 会抛 "slot is not declared"。slots.inject 把注册
      // 推迟到声明落地那一刻（官方 dsh-client-ui-settings-plugins 同款写法）。
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "session-delete",
        order: SECTION_ORDER,
        label: () => t("nav"),
        locale: NS
      }, (props) => react_jsx_runtime.jsx(SessionDeletePanel, { ctx, t, ...props })));
      ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
        name: "sidebar.workspaces.session.menu.item",
        id: "session-delete",
        order: 500,
        locale: NS
      }, (props) => react_jsx_runtime.jsx(DeleteSessionMenuItem, { ...props, sd: { t, request: requestDelete } })));
      // 确认框不能挂在菜单项里：菜单一关就卸载，弹窗跟着消失。挂 shell.overlay，
      // 与官方 SessionArchiveConfirmDialog 同一个位置。
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "session-delete",
        locale: NS
      }, () => react_jsx_runtime.jsx(DeleteConfirmSeat, { t })));
      loadTrashHint();
    }

    /** 菜单项 → shell.overlay 确认框的一次请求交接。 */
    function requestDelete(sessionId) {
      deleteRequest.set({ sessionId });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
