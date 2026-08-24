/** 游戏选择页需要的最小展示与渲染能力信息。 */
export interface GameDefinition {
  id: string
  name: string
  description: string
  renderer: 'pixi' | 'three'
  enabled: boolean
}

/** V0.3 先注册已验证的正式训练游戏，为后续游戏扩展预留入口。 */
export const gameDefinitions: GameDefinition[] = [{
  id: 'target-reach',
  name: '四方向目标触达',
  description: '根据目标方向完成前后左右控制训练。',
  renderer: 'pixi',
  enabled: true,
}]
