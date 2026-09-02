/** 玩法说明既用于游戏卡片，也用于训练中的暂停面板。 */
export interface GameInstruction {
  title: string
  description: string
}

/** 教程步骤只描述标准化输入，不接触角度、零点或 ROM。 */
export interface GameTutorialStep {
  id: string
  title: string
  description: string
  axis: 'x' | 'y'
  direction: 'negative' | 'positive'
  threshold: number
  holdMs: number
}

/** version 变化时会要求用户重新完成教程。 */
export interface GameTutorialDefinition {
  version: number
  steps: GameTutorialStep[]
}

/** 游戏选择页需要的展示、渲染和可选引导信息。 */
export interface GameDefinition {
  id: string
  name: string
  description: string
  renderer: 'pixi' | 'three'
  enabled: boolean
  coverImage?: string
  estimatedDuration?: string
  instructions?: GameInstruction[]
  tutorial?: GameTutorialDefinition
}
