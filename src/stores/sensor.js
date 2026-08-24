import { defineStore } from 'pinia';
export const useSensorStore = defineStore('sensor', {
    state: () => ({
        state: 'idle',
        devices: [],
        selectedDeviceId: '',
        errorMessage: '',
    }),
});
