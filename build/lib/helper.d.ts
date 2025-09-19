import { myTreeDefinition } from './myIob';
/**
 * max. Anzahl Nachkommastellen
 *
 * @param val
 * @param digits
 * @returns
 */
export declare function maxDigits(val: number, digits: number): number;
export declare function getObjectByString(path: any, obj: any, separator?: string): any;
export declare function getAllowedCommonStates(path: any, obj: any, separator?: string): any;
export declare function zeroPad(source: any, places: number): string;
/**
 * Id without last part
 *
 * @param id
 * @returns
 */
export declare function getIdWithoutLastPart(id: string): string;
/**
 * last part of id
 *
 * @param id
 * @returns
 */
export declare function getIdLastPart(id: string): string;
/**
 * Collect all properties used in tree defintions
 *
 * @param treefDefintion @see tree-devices.ts @see tree-clients.ts
 * @returns
 */
export declare function getAllKeysOfTreeDefinition(treefDefintion: {
    [key: string]: myTreeDefinition;
}): string[];
export declare function getAllIdsOfTreeDefinition(treefDefintion: {
    [key: string]: myTreeDefinition;
}): string[];
