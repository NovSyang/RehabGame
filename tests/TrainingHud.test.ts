// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// HUD 测试只验证展示契约，不初始化真实 BLE 和全局服务。
vi.mock('../src/components/app/DeviceConnectionStatus.vue', () => ({
  default: {
    props: { compact: Boolean },
    template: '<button class="device-status-stub" :data-compact="compact">设备</button>',
  },
}))

import TrainingHud from '../src/components/training/TrainingHud.vue'

describe('TrainingHud', () => {
  it('只显示紧凑指标和设备状态，不显示游戏标题或 playing', () => {
    const wrapper = mount(TrainingHud, {
      props: {
        hud: { title: '森林溪谷漂流', subtitle: '标准难度', metrics: [{ label: '星星', value: '13/20' }, { label: '进度', value: '75%' }] },
        trainingState: 'playing',
        canPause: true,
      },
    })
    expect(wrapper.text()).toContain('星星')
    expect(wrapper.text()).toContain('13/20')
    expect(wrapper.text()).not.toContain('森林溪谷漂流')
    expect(wrapper.text()).not.toContain('playing')
    expect(wrapper.get('.device-status-stub').attributes('data-compact')).toBe('true')
  })

  it('发出暂停和结束事件，并在暂停时显示继续', async () => {
    const wrapper = mount(TrainingHud, {
      props: { hud: { title: '训练', metrics: [] }, trainingState: 'playing', canPause: true },
    })
    const buttons = wrapper.findAll('.training-hud-button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('pause')).toHaveLength(1)
    expect(wrapper.emitted('abort')).toHaveLength(1)

    await wrapper.setProps({ trainingState: 'paused' })
    expect(wrapper.findAll('.training-hud-button')[0].text()).toBe('继续')
  })

  it('不可暂停时禁用暂停按钮，但仍允许结束训练', () => {
    const wrapper = mount(TrainingHud, {
      props: { hud: { title: '训练', metrics: [] }, trainingState: 'countdown', canPause: false },
    })
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button')[2].attributes('disabled')).toBeUndefined()
  })
})
