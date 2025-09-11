import _ from 'lodash';
import type { myTreeDefinition } from './myTypes.js';

/**
 * max. Anzahl Nachkommastellen
 * 
 * @param val 
 * @param digits 
 * @returns
 */
export function maxDigits(val: number, digits: number): number {
    return Number(val.toFixed(digits));
}

export function getObjectByString(path: any, obj: any, separator = '.'): any {
    const properties = Array.isArray(path) ? path : path.split(separator);
    return properties.reduce((prev: any, curr: any) => prev?.[curr], obj);
}

export function getAllowedCommonStates(path: any, obj: any, separator = '.'): any {
    const objByString = getObjectByString(path, obj, separator);
    const states: any = {};

    if (objByString) {
        for (const str of objByString) {
            states[str] = str;
        }

        return states;
    }

    return undefined;
}

export function zeroPad(source: any, places: number): string {
    const zero = places - source.toString().length + 1;
    return Array(+(zero > 0 && zero)).join('0') + source;
}

/**
 * Id without last part
 * 
 * @param id
 * @returns
 */
export function getIdWithoutLastPart(id: string): string {
    const lastIndex = id.lastIndexOf('.');
    return id.substring(0, lastIndex);
}

/**
 * last part of id
 * 
 * @param id
 * @returns
 */
export function getIdLastPart(id: string): string {
    const result = id.split('.').pop();
    return result ? result : '';
}


/**
 * Collect all properties used in tree defintions
 *
 * @param treefDefintion @see tree-devices.ts @see tree-clients.ts
 * @returns
 */
export function getAllKeysOfTreeDefinition(treefDefintion: { [key: string]: myTreeDefinition }): string[] {
    const keys: any = [];

    // Hilfsfunktion für rekursive Durchsuchung des Objekts
    function recurse(currentObj: any, prefix = ''): void {
        _.forOwn(currentObj, (value, key) => {
            const fullKey = (prefix ? `${prefix}.${key}` : key).replace('.array', '').replace('.object', '');

            // Wenn der Wert ein Objekt ist (und kein Array), dann weiter rekursiv gehen
            if (_.isObject(value) && typeof value !== 'function' && key !== 'states') {
                keys.push(fullKey);

                // Wenn es ein Array oder Object ist, dann rekursiv weitergehen
                if (_.isArray(value) || _.isObject(value)) {
                    // Nur unter 'array' oder 'object' rekursiv weiter
                    recurse(value, fullKey);
                }
            } else {
                if (key === 'valFromProperty') {
                    const prefixCleared = getIdWithoutLastPart(prefix);
                    keys.push(`${prefixCleared ? `${prefixCleared}.` : ''}${value}`);
                }
            }
        });
    }

    // Start der Rekursion
    recurse(treefDefintion);

    return _.uniq(keys);
}

export function getAllIdsOfTreeDefinition(treefDefintion: { [key: string]: myTreeDefinition }): string[] {
    const keys: any = [];

    // Hilfsfunktion für rekursive Durchsuchung des Objekts
    function recurse(currentObj: any, prefix = ''): void {
        _.forOwn(currentObj, (value, key) => {
            let fullKey = prefix ? `${prefix}.${key}` : key;

            if (Object.hasOwn(value, 'idChannel') && !_.isObject(value.idChannel)) {
                fullKey = prefix ? `${prefix}.${value.idChannel}` : value.idChannel;
            } else if (Object.hasOwn(value, 'id') && !_.isObject(value.id)) {
                fullKey = prefix ? `${prefix}.${value.id}` : value.id;
            }

            fullKey = fullKey.replace('.array', '').replace('.object', '');

            // Wenn der Wert ein Objekt ist (und kein Array), dann weiter rekursiv gehen
            if (_.isObject(value) && typeof value !== 'function' && key !== 'states') {
                if (!_.has(value, 'required')) {
                    keys.push(fullKey);
                }

                // Wenn es ein Array oder Object ist, dann rekursiv weitergehen
                if (_.isArray(value) || _.isObject(value)) {
                    // Nur unter 'array' oder 'object' rekursiv weiter
                    recurse(value, fullKey);
                }
            }
        });
    }

    // Start der Rekursion
    recurse(treefDefintion);

    return _.uniq(keys);
}