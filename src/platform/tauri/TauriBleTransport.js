import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
const TAURI_REQUIRED_MESSAGE = '蓝牙扫描仅支持在 Tauri 桌面应用中运行，请执行 npm run tauri:dev 后在自动打开的应用窗口中操作。';
export class TauriBleTransport {
    dataCallbacks = new Set();
    stateCallbacks = new Set();
    listenersReady = false;
    unlisteners = [];
    async scan() {
        this.ensureTauriRuntime();
        await this.ensureListeners();
        return invoke('ble_scan');
    }
    async connect(deviceId) {
        this.ensureTauriRuntime();
        await this.ensureListeners();
        await invoke('ble_connect', { deviceId });
    }
    async disconnect() {
        this.ensureTauriRuntime();
        await invoke('ble_disconnect');
    }
    async write(data) {
        this.ensureTauriRuntime();
        await invoke('ble_write', { data: Array.from(data) });
    }
    onData(callback) {
        this.dataCallbacks.add(callback);
        return () => this.dataCallbacks.delete(callback);
    }
    onStateChanged(callback) {
        this.stateCallbacks.add(callback);
        return () => this.stateCallbacks.delete(callback);
    }
    async dispose() {
        for (const unlisten of this.unlisteners)
            unlisten();
        this.unlisteners = [];
        this.listenersReady = false;
    }
    async ensureListeners() {
        if (this.listenersReady)
            return;
        const unlistenData = await listen('bsbt91-data', (event) => {
            const packet = {
                data: Uint8Array.from(event.payload.data),
                timestamp: event.payload.timestampMs,
            };
            for (const callback of this.dataCallbacks)
                callback(packet);
        });
        const unlistenState = await listen('bsbt91-state', (event) => {
            for (const callback of this.stateCallbacks)
                callback(event.payload.state);
        });
        this.unlisteners.push(unlistenData, unlistenState);
        this.listenersReady = true;
    }
    ensureTauriRuntime() {
        // 浏览器没有 Tauri 注入的 IPC 与事件桥接，不能直接访问 BLE 后端。
        if (typeof window === 'undefined' || !isTauri()) {
            throw new Error(TAURI_REQUIRED_MESSAGE);
        }
    }
}
