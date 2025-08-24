import * as utils from '@iobroker/adapter-core';
declare class Freeair extends utils.Adapter {
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
}
export default function startAdapter(options: Partial<utils.AdapterOptions> | undefined): Freeair;
export {};
