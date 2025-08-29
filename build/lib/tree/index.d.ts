import { myCommonChannelArray, myCommonState, myCommoneChannelObject } from '../myTypes.js';
import { FreeAirDevice } from './device.js';
export { FreeAirDevice };
/**
 * generate a list with all defined names, that can be used for translation
 * @param tree
 * @param adapter
 */
export declare function tree2Translation(tree: {
    [key: string]: myCommonState | myCommoneChannelObject | myCommonChannelArray;
}, adapter: ioBroker.Adapter): void;
