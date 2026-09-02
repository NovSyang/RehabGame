export type BackActionHandler = () => void | Promise<void>

interface BackActionEntry {
  token: symbol
  priority: number
  order: number
  handler: BackActionHandler
}

/** 不同浮层使用统一优先级，确保一次返回操作只关闭最上层界面。 */
export const BACK_ACTION_PRIORITY = {
  historyDialog: 40,
  replayFullscreen: 60,
  updateDialog: 70,
} as const

/** 统一协调 ESC 与 Android Back，不让具体业务组件直接操作路由。 */
export class BackActionCoordinator {
  private entries: BackActionEntry[] = []
  private nextOrder = 0

  register(priority: number, handler: BackActionHandler): () => void {
    const token = Symbol('back-action')
    this.entries.push({ token, priority, order: this.nextOrder++, handler })
    return () => { this.entries = this.entries.filter((entry) => entry.token !== token) }
  }

  handle(): boolean {
    const entry = [...this.entries].sort((left, right) => right.priority - left.priority || right.order - left.order)[0]
    if (!entry) return false
    try {
      void Promise.resolve(entry.handler()).catch(() => undefined)
    } catch {
      // 顶层处理器失败时仍消费本次返回，避免意外继续关闭下一层页面。
    }
    return true
  }
}
