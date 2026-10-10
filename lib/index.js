/**
 * dsh-delete-sessions —— 宿主半
 *
 * 职责：真正删除 DeepSeek Harness 的会话磁盘日志。
 *
 * 官方「归档」只把会话移出侧栏，`~/.dsh/sessions/**` 下的日志永久留在磁盘；
 * 本插件的宿主半提供扫描 / 删除 / 还原 / 清空四类操作，删除先进回收站
 * （`~/.dsh/trash/sessions/`），可还原，也可彻底删除。
 *
 * 设计要点：
 * - 绝不解析（zstd 压缩的）会话日志，标题由客户端从侧栏同源的 sessions 服务取，
 *   宿主只回答「磁盘上有哪些会话目录、多大、何时创建」。
 * - 正在运行的会话拒绝删除：以 `ctx.agents` 的实时会话集合为准。
 * - 所有路径先经 realpath 收敛，再校验落在 sessions 根内，杜绝越界删除。
 */
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'

/** 服务名，宿主与浏览器两半各自发布同一名字。 */
export const SERVICE_NAME = 'sessionDelete'

/** HTTP 路由前缀。 */
const API_PREFIX = '/api/session-delete'

/** 回收站目录名（位于 DSH 主目录下）。 */
const TRASH_SEGMENT = 'trash'
const TRASH_SUBDIR = 'sessions'
/** 回收站条目元数据文件名。 */
const TRASH_META = 'entry.json'

/**
 * 解析 DSH 主目录：显式配置 > $DSH_HOME > ~/.dsh。
 * 空白值一律忽略，避免把主目录解析到当前工作目录。
 * @param configured - 插件配置里的显式主目录。
 * @returns 绝对路径形式的主目录。
 */
function resolveHome(configured) {
  for (const candidate of [configured, process.env.DSH_HOME]) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return resolve(candidate.trim())
    }
  }
  return join(homedir(), '.dsh')
}

/** 会话日志根目录。 */
const sessionsRoot = (home) => join(home, 'sessions')
/** 回收站根目录。 */
const trashRoot = (home) => join(home, TRASH_SEGMENT, TRASH_SUBDIR)

/**
 * 尽力取得真实路径；目标不存在时退回其绝对规范化形式。
 * @param path - 待解析路径。
 * @returns 用于边界比较的绝对路径。
 */
function realish(path) {
  const absolute = resolve(path)
  try {
    return resolve(realpathSync(absolute))
  } catch {
    return absolute
  }
}

/**
 * 判断 `child` 是否位于 `root` 之内（含 root 自身）。
 * 大小写不敏感，以适配 Windows 的文件系统语义。
 * @param child - 待检查路径。
 * @param root - 允许的根目录。
 * @returns 是否在根内。
 */
function isInside(child, root) {
  const a = realish(child).toLowerCase()
  const b = realish(root).toLowerCase().replace(/[\\/]+$/, '')
  return a === b || a.startsWith(b + '\\') || a.startsWith(b + '/')
}

/**
 * 目录的递归字节数与会话日志代际。
 * 粗略统计即可：面板只用来展示占用，不做配额判断。
 * @param dir - 会话目录。
 * @returns 字节数与代际文件名列表。
 */
function measure(dir) {
  let bytes = 0
  let logs = []
  const walk = (current) => {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      try {
        bytes += statSync(path).size
      } catch {
        /* 统计失败不影响列表面板 */
      }
      if (/^session\..*\.jsonl(\.zstd)?$/.test(entry.name)) logs.push(entry.name)
    }
  }
  walk(dir)
  return { bytes, logs: logs.sort() }
}

/**
 * 扫描磁盘上的全部会话。
 *
 * 目录布局为 `sessions/<项目键>/<编码后的会话 id>`；这里不重算项目键，
 * 直接遍历一层子目录，因此 `_no-cwd` 等特殊分组同样被覆盖。
 * @param home - DSH 主目录。
 * @returns 会话行数组，按创建时间倒序。
 */
function scanSessions(home) {
  const root = sessionsRoot(home)
  if (!existsSync(root)) return []
  const rows = []
  let projects
  try {
    projects = readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const projectDir = join(root, project.name)
    let sessions
    try {
      sessions = readdirSync(projectDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const session of sessions) {
      if (!session.isDirectory() || !session.name.startsWith('session-')) continue
      const dir = join(projectDir, session.name)
      let stat
      try {
        stat = statSync(dir)
      } catch {
        continue
      }
      const { bytes, logs } = measure(dir)
      rows.push({
        id: session.name,
        dir,
        projectKey: project.name,
        bytes,
        logs,
        mtimeMs: stat.mtimeMs,
      })
    }
  }
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

/** 列出回收站条目。 */
function scanTrash(home) {
  const root = trashRoot(home)
  if (!existsSync(root)) return []
  const rows = []
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(root, entry.name)
    let meta = {}
    try {
      meta = JSON.parse(readFileSync(join(dir, TRASH_META), 'utf8'))
    } catch {
      /* 元数据缺失时仍允许列出与还原 */
    }
    const { bytes } = measure(dir)
    rows.push({
      id: meta.id ?? entry.name,
      key: entry.name,
      dir,
      projectKey: meta.projectKey ?? '',
      deletedAt: meta.deletedAt ?? 0,
      bytes,
    })
  }
  return rows.sort((a, b) => b.deletedAt - a.deletedAt)
}

/** 响应 JSON。 */
function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** 读取并解析 JSON 请求体，超限或非法则抛出。 */
async function readJsonBody(req, limit = 256 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('body-too-large')
    chunks.push(chunk)
  }
  if (size === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * 插件主体。
 * @param ctx - 宿主上下文。
 * @param config - 插件配置。
 */
export function apply(ctx, config) {
  const home = resolveHome(config?.dshHome)

  const listState = () => {
    const sessions = scanSessions(home).map((row) => ({
      id: row.id,
      projectKey: row.projectKey,
      bytes: row.bytes,
      logs: row.logs,
      mtimeMs: row.mtimeMs,
    }))
    return {
      ok: true,
      home,
      trashDir: trashRoot(home),
      sessions,
      trash: scanTrash(home).map((row) => ({
        id: row.id,
        key: row.key,
        projectKey: row.projectKey,
        deletedAt: row.deletedAt,
        bytes: row.bytes,
      })),
    }
  }

  /**
   * 把一批会话移入回收站。
   *
   * 这里不做「运行中就不许删」的预判：宿主侧唯一可用的 agents.get(id) 表示的是
   * 「本进程为这个会话开过 agent」，看过一眼就一直算，拿它当闸门会把所有会话都挡掉，
   * 而且 stopActivity 只保证停止请求「已发出」，不保证 agent 已经退掉。
   * 真正的判据是文件系统：目录里有没被释放的句柄，rename 会直接抛 EPERM/EBUSY，
   * 原样带回错误即可，既不会误挡也没漏放。
   */
  const moveToTrash = (ids) => {
    const root = sessionsRoot(home)
    const store = trashRoot(home)
    mkdirSync(store, { recursive: true })
    const results = []
    for (const id of ids) {
      const target = scanSessions(home).find((row) => row.id === id)
      if (target === undefined) {
        results.push({ id, ok: false, error: 'not-found' })
        continue
      }
      if (!isInside(target.dir, root)) {
        results.push({ id, ok: false, error: 'outside-root' })
        continue
      }
      const key = `${Date.now().toString(36)}-${id}`
      const dest = join(store, key)
      try {
        renameSync(target.dir, dest)
        writeFileSync(
          join(dest, TRASH_META),
          JSON.stringify({
            id,
            projectKey: target.projectKey,
            deletedAt: Date.now(),
          }),
        )
        results.push({ id, ok: true, key })
        /**
         * 补发宿主在 session/disposed 时转发给浏览器的那条事件。
         * 宿主没有 delete API，会话仍留在内存注册表里，已连接的浏览器会一直显示这一行；
         * 浏览器侧收到后就把行从列表投影里摘掉，所以既不用归档也不用刷新页面。
         */
        ctx.emit('api-session/removed', id)
      } catch (error) {
        results.push({
          id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return results
  }

  /** 从回收站还原一批会话。 */
  const restore = (keys) => {
    const store = trashRoot(home)
    const results = []
    for (const key of keys) {
      const source = join(store, key)
      if (!isInside(source, store)) {
        results.push({ key, ok: false, error: 'outside-root' })
        continue
      }
      if (!existsSync(source)) {
        results.push({ key, ok: false, error: 'not-found' })
        continue
      }
      let meta = {}
      try {
        meta = JSON.parse(readFileSync(join(source, TRASH_META), 'utf8'))
      } catch {
        /* 复用键中的会话 id */
      }
      const id = meta.id ?? key.replace(/^[^-]+-/, '')
      const projectKey = meta.projectKey
      if (typeof projectKey !== 'string' || projectKey === '') {
        results.push({ key, ok: false, error: 'missing-project' })
        continue
      }
      const dest = join(sessionsRoot(home), projectKey, id)
      if (!isInside(dest, sessionsRoot(home))) {
        results.push({ key, ok: false, error: 'outside-root' })
        continue
      }
      try {
        mkdirSync(join(sessionsRoot(home), projectKey), { recursive: true })
        const staging = join(source, TRASH_META)
        rmSync(staging, { force: true })
        renameSync(source, dest)
        results.push({ key, ok: true, id })
      } catch (error) {
        results.push({
          key,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return results
  }

  /** 彻底删除回收站条目（不可还原）。 */
  const purge = (keys) => {
    const store = trashRoot(home)
    const results = []
    for (const key of keys) {
      const target = join(store, key)
      if (!isInside(target, store) || !existsSync(target)) {
        results.push({ key, ok: false, error: 'not-found' })
        continue
      }
      try {
        rmSync(target, { recursive: true, force: true })
        results.push({ key, ok: true })
      } catch (error) {
        results.push({
          key,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return results
  }

  const routes = [
    {
      kind: 'exact',
      path: `${API_PREFIX}/paths`,
      handler: (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        writeJson(res, 200, { ok: true, home, trashDir: trashRoot(home) })
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/state`,
      handler: (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        writeJson(res, 200, listState())
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/delete`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        try {
          const body = await readJsonBody(req)
          const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
          if (ids.length === 0) return writeJson(res, 400, { ok: false, error: 'no-ids' })
          writeJson(res, 200, { ok: true, results: moveToTrash(ids) })
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/restore`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        try {
          const body = await readJsonBody(req)
          const keys = Array.isArray(body.keys) ? body.keys.map(String) : []
          if (keys.length === 0) return writeJson(res, 400, { ok: false, error: 'no-keys' })
          writeJson(res, 200, { ok: true, results: restore(keys) })
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/purge`,
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        try {
          const body = await readJsonBody(req)
          const keys = Array.isArray(body.keys) ? body.keys.map(String) : []
          if (keys.length === 0) return writeJson(res, 400, { ok: false, error: 'no-keys' })
          writeJson(res, 200, { ok: true, results: purge(keys) })
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
  ]

  /**
   * 鉴权门。官方 /api/* 的 401 来自 dsh-api-gateway，不挂在 webServer 前缀上，
   * 所以 ctx.webServer.register() 自挂的路由默认是裸的（无 cookie 也能读到数据）。
   * 这里走官方留给插件的接缝 ctx.connection.requestRejection()：它先过 Host/Origin
   * 围栏，再校验本次激活签发的浏览器 cookie。拿不到 connection 时一律拒绝 —— 鉴权
   * 不可用必须 fail closed，不能退化成放行。
   */
  const gate = (handler) => (req, res) => {
    const connection = ctx.get('connection')
    if (typeof connection?.requestRejection !== 'function') {
      return writeJson(res, 503, { ok: false, error: 'auth-unavailable' })
    }
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) {
      return writeJson(res, rejection, { ok: false, error: rejection === 403 ? 'forbidden' : 'unauthorized' })
    }
    return handler(req, res)
  }

  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register({ ...route, handler: gate(route.handler) }))
    ctx.logger?.info?.(`[session-delete] 已挂载（带鉴权），主目录 ${home}`)
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'session-delete: routes')

  if (typeof ctx.provide === 'function') {
    ctx.provide(SERVICE_NAME, {
      state: listState,
      delete: moveToTrash,
      restore,
      purge,
      home: () => home,
    })
  }
}

/** Cordis 依赖注入声明：服务名数组，或「服务名 → 拦截配置」映射。 */
export const inject = ['webServer']
