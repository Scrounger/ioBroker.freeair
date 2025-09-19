import { myTreeDefinition } from '../myIob.js';
export declare namespace FreeAirDevice {
    function get(): {
        [key: string]: myTreeDefinition;
    };
    function getKeys(): string[];
    function getStateIDs(): string[];
}
