import { defaultMotionConfig } from './MotionConfig';
export class MotionProcessor {
    config;
    zeroAngleX = 0;
    zeroAngleY = 0;
    calibrated = false;
    calibrationActive = false;
    calibrationStartedAt = 0;
    calibrationDurationMs = 1000;
    calibrationSamplesX = [];
    calibrationSamplesY = [];
    constructor(config = defaultMotionConfig) {
        this.config = structuredClone(config);
    }
    updateConfig(config) {
        this.config = structuredClone(config);
    }
    startCalibration(durationMs = 1000) {
        this.calibrationActive = true;
        this.calibrationStartedAt = 0;
        this.calibrationDurationMs = Math.max(300, durationMs);
        this.calibrationSamplesX = [];
        this.calibrationSamplesY = [];
        this.calibrated = false;
    }
    resetCalibration() {
        this.calibrationActive = false;
        this.calibrated = false;
        this.zeroAngleX = 0;
        this.zeroAngleY = 0;
        this.calibrationSamplesX = [];
        this.calibrationSamplesY = [];
    }
    getCalibrationSnapshot(now = Date.now()) {
        const elapsed = this.calibrationStartedAt > 0 ? now - this.calibrationStartedAt : 0;
        return {
            active: this.calibrationActive,
            progress: this.calibrationActive
                ? Math.min(1, elapsed / this.calibrationDurationMs)
                : this.calibrated
                    ? 1
                    : 0,
            calibrated: this.calibrated,
            zeroAngleX: this.zeroAngleX,
            zeroAngleY: this.zeroAngleY,
        };
    }
    process(frame, connected) {
        this.consumeCalibration(frame);
        if (!this.calibrated) {
            return {
                x: 0,
                y: 0,
                connected,
                calibrated: false,
                timestamp: frame.timestamp,
            };
        }
        const relativeAngleX = frame.angleX - this.zeroAngleX;
        const relativeAngleY = frame.angleY - this.zeroAngleY;
        // 真实 T01~T10 数据确认：左右=AngleY，前后=-AngleX。
        const horizontalRaw = relativeAngleY;
        const verticalRaw = -relativeAngleX;
        return {
            x: this.normalizeSigned(horizontalRaw, this.config.horizontalDeadZone, this.config.range.leftMax, this.config.range.rightMax),
            y: this.normalizeSigned(verticalRaw, this.config.verticalDeadZone, this.config.range.backwardMax, this.config.range.forwardMax),
            connected,
            calibrated: true,
            timestamp: frame.timestamp,
        };
    }
    consumeCalibration(frame) {
        if (!this.calibrationActive)
            return;
        if (this.calibrationStartedAt === 0) {
            this.calibrationStartedAt = frame.timestamp;
        }
        this.calibrationSamplesX.push(frame.angleX);
        this.calibrationSamplesY.push(frame.angleY);
        const elapsed = frame.timestamp - this.calibrationStartedAt;
        if (elapsed < this.calibrationDurationMs)
            return;
        if (this.calibrationSamplesX.length < 5)
            return;
        this.zeroAngleX = average(this.calibrationSamplesX);
        this.zeroAngleY = average(this.calibrationSamplesY);
        this.calibrated = true;
        this.calibrationActive = false;
    }
    normalizeSigned(value, deadZone, negativeMax, positiveMax) {
        const magnitude = Math.abs(value);
        if (magnitude <= deadZone)
            return 0;
        const sign = Math.sign(value);
        const max = sign < 0 ? negativeMax : positiveMax;
        const effectiveRange = Math.max(0.001, max - deadZone);
        const effectiveValue = magnitude - deadZone;
        return clamp(sign * (effectiveValue / effectiveRange), -1, 1);
    }
}
function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
