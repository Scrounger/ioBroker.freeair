import type { Device } from "./types-device";
export type myTreeData = Device | {
    isOnline: boolean;
};
export interface JsonConfigAutocompleteSendTo {
    value: string;
    label: string;
}
