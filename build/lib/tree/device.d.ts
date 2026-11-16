import { myTreeDefinition } from '../myIob.js';
import type { Device } from '../types-device.js';
export declare namespace FreeAirDevice {
    function get(): {
        [key: string]: myTreeDefinition<any, Device, ioBroker.myAdapter>;
    };
    function getKeys(): string[];
    function getStateIDs(): string[];
}
