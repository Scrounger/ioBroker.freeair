import type { Device } from "./types-device";
export type myTreeData = Device | {
    isOnline: boolean;
};
type ReadValFunction = (val: any, adapter: ioBroker.Adapter | ioBroker.myAdapter, device: myTreeData) => ioBroker.StateValue | Promise<ioBroker.StateValue>;
export type WriteValFunction = (val: ioBroker.StateValue, id?: string, device?: myTreeData, adapter?: ioBroker.Adapter | ioBroker.myAdapter) => any | Promise<any>;
type ConditionToCreateStateFunction = (objDevice: myTreeData, objChannel: myTreeData, adapter: ioBroker.Adapter | ioBroker.myAdapter) => boolean;
export type myTreeDefinition = myTreeState | myTreeObject | myTreeArray;
export interface myTreeState {
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
    states?: Record<string, string> | string[] | string;
    expert?: true;
    icon?: string;
    def?: ioBroker.StateValue;
    desc?: string;
    readVal?: ReadValFunction;
    writeVal?: WriteValFunction;
    valFromProperty?: string;
    statesFromProperty?(objDevice: myTreeData, objChannel: myTreeData, adapter: ioBroker.Adapter | ioBroker.myAdapter): Record<string, string> | string[] | string;
    conditionToCreateState?: ConditionToCreateStateFunction;
    subscribeMe?: true;
    required?: true;
}
export interface myTreeObject {
    idChannel?: string;
    name?: string;
    icon?: string;
    object: {
        [key: string]: myTreeDefinition;
    };
    conditionToCreateState?: ConditionToCreateStateFunction;
}
export interface myTreeArray {
    idChannel?: string;
    name?: string;
    icon?: string;
    arrayChannelIdPrefix?: string;
    arrayChannelIdZeroPad?: number;
    arrayChannelIdFromProperty?(objDevice: myTreeData, objChannel: myTreeData, i: number, adapter: ioBroker.Adapter | ioBroker.myAdapter): string;
    arrayChannelNamePrefix?: string;
    arrayChannelNameFromProperty?(objDevice: myTreeData, objChannel: myTreeData, adapter: ioBroker.Adapter | ioBroker.myAdapter): string;
    arrayStartNumber?: number;
    array: {
        [key: string]: myTreeDefinition;
    };
}
export interface JsonConfigAutocompleteSendTo {
    value: string;
    label: string;
}
export {};
