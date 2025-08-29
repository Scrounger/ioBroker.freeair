import * as utils from '@iobroker/adapter-core';
import type { JsonConfigAutocompleteSendTo, myCommonState } from './lib/myTypes.js';
declare class Freeair extends utils.Adapter {
    isConnected: boolean;
    aliveInterval: number;
    aliveTimeout: ioBroker.Timeout | undefined;
    subscribedList: string[];
    endpoints: {
        data: string;
        control: string;
    };
    statesList: JsonConfigAutocompleteSendTo[];
    constructor(options?: Partial<utils.AdapterOptions>);
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private onReady;
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback
     */
    private onUnload;
    /**
     * Is called if a subscribed state changes
     *
     * @param id
     * @param state
     */
    private onStateChange;
    private onMessage;
    private initServer;
    private socketHandler;
    private parseUrl;
    private updateDevice;
    /**
     * create or update a channel object, update will only be done on adapter start
     *
     * @param id
     * @param name
     * @param icon
     * @param isAdapterStart
     */
    private createOrUpdateChannel;
    /**
     * create or update a device object, update will only be done on adapter start
     *
     * @param id
     * @param name
     * @param onlineId
     * @param errorId
     * @param icon
     * @param isAdapterStart
     * @param logChanges
     */
    private createOrUpdateDevice;
    createOrUpdateGenericState(channel: string, treeDefinition: any, objValues: any, blacklistFilter: {
        id: string;
    }[], isWhiteList: boolean, objDevices: any, objChannel: any, isAdapterStart?: boolean, filterId?: string, isChannelOnWhitelist?: boolean): Promise<void>;
    getCommonGenericState(id: string, treeDefinition: {
        [key: string]: myCommonState;
    }, objDevices: any, logMsgState: string): any;
    private base64UrlDecode;
    /**
     * Set adapter info.connection state and internal var
     *
     * @param isConnected
     */
    setConnectionStatus(isConnected: boolean): Promise<void>;
    /**
     * set isOnline state for every device
     *
     * @param serialNo
     * @param isConnected
     */
    setDeviceConnectionStatus(serialNo: string, isConnected: boolean): Promise<void>;
    /**
     Check whether the connection to FreeAir 100 exists
    */
    private aliveChecker;
}
export default function startAdapter(options: Partial<utils.AdapterOptions> | undefined): Freeair;
export {};
