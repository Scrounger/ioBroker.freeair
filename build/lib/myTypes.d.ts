import { Device } from "./types-device";
export interface requestData {
    method: string;
    url: string;
    headers: string[];
}
export interface myCommonState {
    id?: string;
    iobType: ioBroker.CommonType;
    name?: string;
    role?: string;
    read?: boolean;
    write?: boolean;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    states?: {
        [key: string]: string;
    } | {
        [key: number]: string;
    } | {
        [key: number]: number;
    };
    expert?: true;
    icon?: string;
    def?: ioBroker.StateValue;
    desc?: string;
    readVal?(val: ioBroker.StateValue, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue | Promise<ioBroker.StateValue>;
    writeVal?(val: ioBroker.StateValue, adapter: ioBroker.Adapter): ioBroker.StateValue | Promise<ioBroker.StateValue>;
    valFromProperty?: string;
    statesFromProperty?: string;
    conditionToCreateState?(objDevice: any, adapter: ioBroker.Adapter): boolean;
    subscribeMe?: true;
    required?: true;
}
export interface myCommoneChannelObject {
    idChannel?: string;
    channelName?(objDevice: any, objChannel: any, adapter: ioBroker.Adapter): string;
    icon?: string;
    object: {
        [key: string]: myCommonState | myCommoneChannelObject;
    };
}
export interface myCommonChannelArray {
    idChannel?: string;
    channelName?(objDevice: any, objChannel: any, adapter: ioBroker.Adapter): string;
    icon?: string;
    arrayChannelIdPrefix?: string;
    arrayChannelIdZeroPad?: number;
    arrayChannelIdFromProperty?(objDevice: any, i: number, adapter: ioBroker.Adapter): string;
    arrayChannelNamePrefix?: string;
    arrayChannelNameFromProperty?(objDevice: any, adapter: ioBroker.Adapter): string;
    arrayStartNumber?: number;
    array: {
        [key: string]: myCommonState;
    };
}
export interface JsonConfigAutocompleteSendTo {
    value: string;
    label: string;
}
