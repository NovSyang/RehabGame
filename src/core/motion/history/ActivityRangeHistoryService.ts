import type { MotionRange } from '../MotionConfig'
import type { MotionProfile } from '../MotionProfile'
import type { ITrainingRepository } from '../../training/ITrainingRepository'
import {
  activityRangeHistoryIdentity,
  copyActivityRangeHistoryRecord,
  type ActivityRangeHistoryRecord,
  type ActivityRangeHistorySource,
} from './ActivityRangeHistoryRecord'
import type { IActivityRangeHistoryRepository } from './IActivityRangeHistoryRepository'

type IdFactory = () => string
type ProfileProvider = () => MotionProfile

/** 创建、读取并恢复单个使用者的个人活动范围历史。 */
export class ActivityRangeHistoryService {
  private recoveryPromise: Promise<void> | null = null
  private recoveryCompleted = false

  constructor(
    private readonly repository: IActivityRangeHistoryRepository,
    private readonly trainingRepository: Pick<ITrainingRepository, 'getAll'>,
    private readonly getCurrentProfile: ProfileProvider,
    private readonly now: () => number = Date.now,
    private readonly createId: IdFactory = createHistoryId,
  ) {}

  async record(
    range: MotionRange,
    profile: MotionProfile,
    source: ActivityRangeHistorySource,
  ): Promise<ActivityRangeHistoryRecord> {
    const record = this.fromProfile(range, profile, source)
    const identity = activityRangeHistoryIdentity(record)
    const existing = (await this.repository.getAll()).find((item) => activityRangeHistoryIdentity(item) === identity)
    if (existing) return copyActivityRangeHistoryRecord(existing)
    await this.repository.append(record)
    return copyActivityRangeHistoryRecord(record)
  }

  async getAll(): Promise<ActivityRangeHistoryRecord[]> {
    return deduplicate(await this.repository.getAll())
      .sort((left, right) => right.measuredAt - left.measuredAt)
      .map(copyActivityRangeHistoryRecord)
  }

  async getChronological(): Promise<ActivityRangeHistoryRecord[]> {
    return (await this.getAll()).sort((left, right) => left.measuredAt - right.measuredAt)
  }

  /** 多个页面同时请求恢复时复用同一任务，失败后仍允许下次启动重试。 */
  recoverLegacyIfNeeded(): Promise<void> {
    if (this.recoveryCompleted) return Promise.resolve()
    if (this.recoveryPromise) return this.recoveryPromise
    // 初始化调用发生在 Profile 加载之后，先固定当前快照以免后台恢复与新测量互相覆盖来源。
    const currentProfile = this.getCurrentProfile()
    this.recoveryPromise = this.recoverLegacy(currentProfile)
      .then(() => { this.recoveryCompleted = true })
      .finally(() => { this.recoveryPromise = null })
    return this.recoveryPromise
  }

  private async recoverLegacy(currentProfile: MotionProfile): Promise<void> {
    if ((await this.repository.getAll()).length > 0) return
    const records = await this.trainingRepository.getAll()
    // IndexedDB 可能包含旧版或损坏对象，恢复过程必须逐个验证后再读取字段。
    const profiles: unknown[] = records.map((record) => record.motionProfile)
    profiles.push(currentProfile)
    const candidates = deduplicateProfiles(profiles)
      .map((profile) => this.fromProfile(profile.measuredRange!, profile, 'legacy-recovered'))
      .sort((left, right) => left.measuredAt - right.measuredAt)
    for (const candidate of candidates) await this.repository.append(candidate)
  }

  private fromProfile(
    range: MotionRange,
    profile: MotionProfile,
    source: ActivityRangeHistorySource,
  ): ActivityRangeHistoryRecord {
    const measuredAt = Number.isFinite(profile.updatedAt) && profile.updatedAt > 0 ? profile.updatedAt : this.now()
    return {
      schemaVersion: 1,
      id: this.createId(),
      profileId: profile.id || 'default',
      measuredAt,
      measuredRange: copyRange(range),
      activeRange: copyRange(profile.activeRange),
      trainingRatio: profile.trainingRatio,
      source,
    }
  }
}

function deduplicate(records: ActivityRangeHistoryRecord[]): ActivityRangeHistoryRecord[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    const identity = activityRangeHistoryIdentity(record)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function deduplicateProfiles(profiles: unknown[]): MotionProfile[] {
  const seen = new Set<string>()
  return profiles.filter((profile): profile is MotionProfile => {
    if (!isRecoverableProfile(profile)) return false
    const identity = activityRangeHistoryIdentity({
      profileId: profile.id || 'default',
      measuredAt: profile.updatedAt,
      measuredRange: profile.measuredRange!,
    })
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function isRecoverableProfile(value: unknown): value is MotionProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<MotionProfile>
  return profile.schemaVersion === 1
    && typeof profile.id === 'string' && profile.id.length > 0
    && !!profile.measuredRange
    && typeof profile.updatedAt === 'number' && Number.isFinite(profile.updatedAt) && profile.updatedAt > 0
    && validRange(profile.measuredRange)
    && !!profile.activeRange && validRange(profile.activeRange)
    && typeof profile.trainingRatio === 'number' && Number.isFinite(profile.trainingRatio)
    && profile.trainingRatio > 0 && profile.trainingRatio <= 1
}

function validRange(range: MotionRange): boolean {
  return [range.leftMax, range.rightMax, range.forwardMax, range.backwardMax]
    .every((value) => Number.isFinite(value) && value > 0)
}

function copyRange(range: MotionRange): MotionRange {
  return {
    leftMax: range.leftMax,
    rightMax: range.rightMax,
    forwardMax: range.forwardMax,
    backwardMax: range.backwardMax,
  }
}

function createHistoryId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `activity-range-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
