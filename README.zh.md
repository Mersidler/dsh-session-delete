# dsh-delete-sessions

DeepSeek Harness 会话删除插件：**真正删除磁盘日志**（先进回收站，可还原），补上官方「归档」只隐藏不删盘的能力缺口。

[English](README.md) | 中文

> npm 包名 `dsh-delete-sessions`；GitHub 仓库名沿用 `dsh-session-delete`。

## 功能

- **侧栏直接删**：会话行「⋯」菜单里多一项「删除会话」，用 dsh 原生确认框，删完这一行自动消失，不用刷新页面
- **设置页管理**：**设置 → 会话回收站**，扫描 `~/.dsh/sessions/**` 的真实目录，显示标题（取侧栏同源的会话服务，零解压）、项目、磁盘占用、更新时间
- **批量操作**：勾选后批量移入回收站；支持全选、按标题 / ID / 项目搜索
- **回收站**：还原（回到原分组）/ 彻底删除 / 一键清空
- **界面跟主题走**：控件全部用 dsh 自己的 primitives，配色圆角取宿主设计令牌，深浅色自动跟随

## 安装

```bash
dsh plugin --profile web add dsh-delete-sessions
```

装完重启 `dsh web` 生效。卸载：

```bash
dsh plugin --profile web remove dsh-delete-sessions
```

## 使用

1. 侧栏某条会话点「⋯」→「删除会话」→ 确认；或打开 **设置 → 会话回收站** 批量处理
2. 删除只是把会话目录 `rename` 进回收站（`~/.dsh/trash/sessions/`）——**这是本插件自己的文件夹，不是系统回收站**
3. 「回收站」页签可还原或彻底删除；只有「彻底删除」才真的 `rmSync`

## 数据安全

- 删除 = `renameSync` 移入回收站，原文件不会被覆盖，还原后字节级一致
- 宿主侧所有路径先经 `realpath` 收敛，再校验必须位于 sessions 根目录内，杜绝越界删除
- 不解析（zstd 压缩的）会话日志内容，标题只从 DSH 自己的会话服务读取

## 鉴权

四条 `/api/session-delete/*` 路由全部经过宿主的 `ctx.connection.requestRejection()`：先过 Host/Origin 围栏，再校验本次激活签发的浏览器 cookie。未登录返回 401，来源不可信返回 403；取不到该服务时返回 503 而不是放行（fail closed）。

> 这一点必须自己做：`ctx.webServer.register()` 挂的路由不经过 `dsh-api-gateway`，默认没有鉴权。

## 关于「运行中」的会话

本插件**不做**「运行中就不许删」的预判。宿主侧唯一可用的 `agents.get(id)` 含义是「本进程为该会话开过 agent」，点开看过一眼就一直算，拿它当闸门会挡掉几乎所有会话；而 `stopActivity` 只保证停止请求已发出，不保证 agent 已经退出。

真正的判据是文件系统：目录里还有没释放的句柄，`rename` 会直接抛 `EPERM` / `EBUSY`，插件原样把原因显示出来，并做至多 6 次、每次间隔 250ms 的有界重试。既不会误挡，也不会漏放。

## 兼容性

面向 DSH `0.2.0-rc.2` 及以上版本编写，零构建（纯 JS，无 TypeScript、无打包步骤）。仅 Web 界面。

## License

Apache-2.0
