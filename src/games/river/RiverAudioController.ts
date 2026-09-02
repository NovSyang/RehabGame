/** River 音频失败时只静默降级，不影响传感器和训练流程。 */
export class RiverAudioController {
  private readonly bgm = createAudio('/assets/games/river/audio/forest-ambience.mp3', true, 0.15)
  private readonly effects = new Map<string, HTMLAudioElement>([
    ['collect', createAudio('/assets/games/river/audio/collect.ogg', false, 0.3)],
    ['gate', createAudio('/assets/games/river/audio/gate.ogg', false, 0.3)],
    ['collision', createAudio('/assets/games/river/audio/collision.ogg', false, 0.3)],
    ['hold', createAudio('/assets/games/river/audio/hold.ogg', false, 0.3)],
    ['finish', createAudio('/assets/games/river/audio/finish.ogg', false, 0.3)],
  ])

  playBgm(): void { void this.bgm?.play().catch(() => undefined) }
  pause(): void { this.bgm?.pause(); for (const audio of this.effects.values()) audio.pause() }
  resume(): void { this.playBgm() }
  playEffect(name: 'collect' | 'gate' | 'collision' | 'hold' | 'finish'): void {
    const source = this.effects.get(name)
    if (!source) return
    const audio = source.cloneNode(true) as HTMLAudioElement
    audio.volume = source.volume
    void audio.play().catch(() => undefined)
  }
  destroy(): void {
    this.pause()
    if (this.bgm) this.bgm.currentTime = 0
    this.effects.clear()
  }
}

function createAudio(src: string, loop: boolean, volume: number): HTMLAudioElement {
  // 测试环境没有 Audio 构造器，返回最小空实现避免业务逻辑被媒体能力阻塞。
  if (typeof Audio === 'undefined') return { play: async () => undefined, pause: () => undefined, cloneNode: () => createAudio(src, loop, volume), volume, loop, currentTime: 0 } as unknown as HTMLAudioElement
  const audio = new Audio(src)
  audio.preload = 'auto'
  audio.loop = loop
  audio.volume = volume
  return audio
}
