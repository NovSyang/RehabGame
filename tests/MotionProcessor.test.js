import { describe, expect, it } from 'vitest';
import { MotionProcessor } from '../src/core/motion/MotionProcessor';
function frame(angleX, angleY, timestamp) {
    return {
        accX: 0, accY: 0, accZ: 1,
        gyroX: 0, gyroY: 0, gyroZ: 0,
        angleX, angleY, angleZ: 0,
        timestamp,
    };
}
describe('MotionProcessor', () => {
    it('完成零点校准后，向右为 X+，向前为 Y+', () => {
        const processor = new MotionProcessor();
        processor.startCalibration(300);
        processor.process(frame(-3, -2, 1000), true);
        processor.process(frame(-3, -2, 1150), true);
        processor.process(frame(-3, -2, 1200), true);
        processor.process(frame(-3, -2, 1250), true);
        processor.process(frame(-3, -2, 1300), true);
        const right = processor.process(frame(-3, 8, 1320), true);
        const forward = processor.process(frame(-13, -2, 1340), true);
        expect(right.calibrated).toBe(true);
        expect(right.x).toBeGreaterThan(0);
        expect(forward.y).toBeGreaterThan(0);
    });
});
