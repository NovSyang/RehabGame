import { MotionProcessor } from '../motion/MotionProcessor';
import { BsBt91FrameAssembler } from './bsbt91/BsBt91FrameAssembler';
import { BsBt91Parser } from './bsbt91/BsBt91Parser';
export class SensorService {
    transport;
    assembler = new BsBt91FrameAssembler();
    parser = new BsBt91Parser();
    motion = new MotionProcessor();
    snapshotCallbacks = new Set();
    frameTimes = [];
    state = 'idle';
    frame = null;
    gameInput = {
        x: 0,
        y: 0,
        connected: false,
        calibrated: false,
        timestamp: 0,
    };
    rawHex = '';
    constructor(transport) {
        this.transport = transport;
        this.transport.onData((packet) => this.handleData(packet.data, packet.timestamp));
        this.transport.onStateChanged((state) => {
            this.state = state;
            if (state !== 'connected') {
                this.gameInput = { ...this.gameInput, connected: false, x: 0, y: 0 };
            }
            this.publish();
        });
    }
    scan() {
        return this.transport.scan();
    }
    connect(deviceId) {
        this.assembler.reset();
        this.frameTimes = [];
        return this.transport.connect(deviceId);
    }
    disconnect() {
        return this.transport.disconnect();
    }
    startCalibration() {
        this.motion.startCalibration(1000);
        this.publish();
    }
    onSnapshot(callback) {
        this.snapshotCallbacks.add(callback);
        callback(this.getSnapshot());
        return () => this.snapshotCallbacks.delete(callback);
    }
    handleData(chunk, timestamp) {
        const assembled = this.assembler.push(chunk, timestamp);
        for (const item of assembled) {
            this.rawHex = Array.from(item.bytes)
                .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
                .join(' ');
            const frame = this.parser.parseRealtimeFrame(item.bytes, item.timestamp);
            if (!frame)
                continue;
            this.frame = frame;
            this.frameTimes.push(frame.timestamp);
            const threshold = frame.timestamp - 1000;
            while (this.frameTimes.length > 0 && this.frameTimes[0] < threshold) {
                this.frameTimes.shift();
            }
            this.gameInput = this.motion.process(frame, this.state === 'connected');
            this.publish();
        }
    }
    getSnapshot() {
        return {
            state: this.state,
            frame: this.frame,
            gameInput: this.gameInput,
            rateHz: this.frameTimes.length,
            rawHex: this.rawHex,
        };
    }
    publish() {
        const snapshot = this.getSnapshot();
        for (const callback of this.snapshotCallbacks)
            callback(snapshot);
    }
}
