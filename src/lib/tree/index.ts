import type { myCommonChannelArray, myCommonState, myCommoneChannelObject } from '../myTypes.js';
import { FreeAirDevice } from './device.js';

export { FreeAirDevice };

/**
 * generate a list with all defined names, that can be used for translation
 * 
 * @param tree 
 * @param adapter 
 */
export function tree2Translation(tree: { [key: string]: myCommonState | myCommoneChannelObject | myCommonChannelArray }, adapter: ioBroker.Adapter): void {
    const tree2translation = {};
    for (const key in tree) {
        const prop = tree[key] as myCommonState;

        if (prop && prop.name) {
            tree2translation[prop.name] = prop.name;
        } else {
            tree2translation[key] = key;
        }
    }

    adapter.log.warn(JSON.stringify(tree2translation));
}