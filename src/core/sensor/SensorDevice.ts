export interface SensorDevice {
  id: string
  name: string
  address?: string
}

export type SensorConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'discovering'
  | 'subscribing'
  | 'connected'
  | 'disconnected'
  | 'error'

export interface SensorDataPacket {
  data: Uint8Array
  timestamp: number
}
