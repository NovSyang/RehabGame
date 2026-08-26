import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import releaseVersion from '../release-version.json'
import tauriConfig from '../src-tauri/tauri.conf.json'

describe('release version', () => {
  it('0.8.0 产品版本和 Android code 使用固定发布基线', () => {
    expect(releaseVersion).toMatchObject({
      schemaVersion: 1,
      productVersion: '0.8.0',
      displayVersion: '0.8',
      desktop: { version: '0.8.0' },
      android: { versionName: '0.8.0', versionCode: 8 },
    })
  })

  it('同步检查确认所有构建配置没有版本漂移', () => {
    // 使用真实 --check 入口，但不会修改任何项目文件。
    expect(() => execFileSync(process.execPath, ['scripts/sync-version.mjs', '--check'], {
      cwd: resolve(import.meta.dirname, '..'),
      stdio: 'pipe',
    })).not.toThrow()
  })

  it('Windows 产品名、主程序名和跨平台包标识保持一致', () => {
    expect(tauriConfig).toMatchObject({
      productName: 'RehabGame',
      mainBinaryName: 'RehabGame',
      identifier: 'com.rehabgame.app',
    })
  })
})
