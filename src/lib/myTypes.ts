import type { Device } from "./types-device.js"

export type myTreeData = Device | { isOnline: boolean };

export interface JsonConfigAutocompleteSendTo {
    value: string;
    label: string;
}