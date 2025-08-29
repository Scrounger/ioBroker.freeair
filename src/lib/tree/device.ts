import * as myHelper from '../helper.js';
import type { myCommonChannelArray, myCommonState, myCommoneChannelObject } from '../myTypes.js';
import { Device } from '../types-device.js';


export namespace FreeAirDevice {
    let keys: string[] | undefined = undefined;

    export function get(): { [key: string]: myCommonState | myCommoneChannelObject | myCommonChannelArray } {
        return {
            airDensity: {
                iobType: 'number',
                name: 'air density',
                unit: 'kg/m³',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 3);
                },
            },
            airFlow: {
                iobType: 'number',
                name: 'air flow',
                unit: 'm³/h',
            },
            bathVentPos: {
                iobType: 'number',
                name: 'bath flap position',
                unit: '%',
            },
            board_version: {
                iobType: 'number',
                name: 'hardware version'
            },
            bypassVentPos: {
                iobType: 'number',
                name: 'bypass flap position',
                unit: '%',
            },
            co2: {
                iobType: 'number',
                name: 'CO2 concentration',
                unit: 'ppm',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 0);
                },
            },
            co2Indicator: {
                iobType: 'number',
                name: 'CO2 indicator',
                states: {
                    1: "green",
                    2: "yellow",
                    3: "orange",
                    4: "red",
                }
            },
            comfortLevel: {
                iobType: 'number',
                name: 'comfort level',
                write: true,
                states: {
                    1: 1,
                    2: 2,
                    3: 3,
                    4: 4,
                    5: 5,
                },
                min: 1,
                max: 5,
                step: 1,
            },
            coolingPower: {
                iobType: 'number',
                name: 'cooling power',
                unit: 'W',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 1);
                },
            },
            deicing: {
                iobType: 'boolean',
                name: 'deicing'
            },
            exhaustFilterIndicator: {
                iobType: 'number',
                name: 'indicator exhaust air filter',
                states: {
                    1: "green",
                    2: "yellow",
                    3: "orange",
                    4: "red",
                },
            },
            exhaustTemp: {
                iobType: 'number',
                name: 'exhaust air temperature',
                unit: '°C',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 1);
                }
            },
            extractFilterFul: {
                iobType: 'boolean',
                name: 'extract filter full',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return val === 1;
                },
            },
            extractFanRPM: {
                iobType: 'number',
                name: 'fan speed exhaust air',
                unit: '1/min',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 0);
                },
            },
            extractHum: {
                iobType: 'number',
                name: 'relative humidity of the exhaust air',
                unit: '%',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 0);
                },
            },
            extractHumAbs: {
                iobType: 'number',
                name: 'absolute humidity of the exhaust air',
                unit: 'g/m³',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 1);
                },
            },
            extractHumidityIndicator: {
                iobType: 'number',
                name: 'indicator extract humidity',
                states: {
                    1: "green",
                    2: "yellow",
                    3: "orange",
                    4: "red",
                },
            },
            extractTemp: {
                iobType: 'number',
                name: 'extract air temperature',
                unit: '°C',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 1);
                },
            },
            extractVentPos: {
                iobType: 'number',
                name: 'extract flap position',
                unit: '%',
            },
            filter_hours: {
                iobType: 'number',
                name: 'filter hours',
                unit: 'h'
            },
            hasErrors: {
                iobType: 'boolean',
                name: 'devices reported errors',
            },
            heatRecovery: {
                iobType: 'number',
                name: 'heat recovery',
                unit: '%',
            },
            isOnline: {
                id: 'isOnline',
                iobType: 'boolean',
                name: 'Is device online',
                def: false,
                required: true,
            },
            operating_hours: {
                iobType: 'number',
                name: 'operating hours',
                unit: 'h',
            },
            operatingMode: {
                iobType: 'number',
                name: 'operating mode',
                write: true,
                states: {
                    0: "Comfort",
                    1: "Comfort",
                    2: "Sleep",
                    3: "Turbo",
                    4: "Turbo Cool",
                    5: "Service",
                    6: "Test",
                    7: "Manufacturer",
                    8: "Dehumidification"
                },
                min: 1,
                max: 4,
                def: 1,
            },
            operatingModeName: {
                iobType: 'string',
                name: 'operating mode name',
            },
            outdoorFilterIndicator: {
                iobType: 'number',
                name: 'indicator outdoor air filter',
                states: {
                    1: "green",
                    2: "yellow",
                    3: "orange",
                    4: "red",
                },
            },
            outdoorHum: {
                iobType: 'number',
                name: 'relative humidity of the outdoor air',
                unit: '%',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 0);
                },
            },
            outdoorHumAbs: {
                iobType: 'number',
                name: 'absolute humidity of the outdor air',
                unit: 'g/m³',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 1);
                },
            },
            outdoorTemp: {
                iobType: 'number',
                name: 'outdor air temperature',
                unit: '°C',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 1);
                },
            },
            powerRecovery: {
                iobType: 'number',
                name: 'power recovery',
                unit: 'W',
            },
            pressure: {
                iobType: 'number',
                name: 'pressure',
                unit: 'mbar',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 0);
                },
            },
            program: {
                iobType: 'number',
                name: 'program',
                states: {
                    0: "Minimum ventilation",
                    1: "Dehumidification (rel)",
                    2: "Dehumidification (abs)",
                    3: "Active cooling",
                    4: "CO2 reduction",
                    5: "Water input",
                    6: "Outside air < -22 ℃",
                    7: "Humidity entry",
                }
            },
            programName: {
                iobType: 'string',
                name: 'program name',
            },
            roomArea: {
                iobType: 'number',
                name: 'space area',
                unit: 'm²',
            },
            rssi: {
                iobType: 'number',
                name: 'WiFi reception strength',
                unit: 'dBm',
            },
            secondRoomFlow: {
                iobType: 'number',
                name: 'second room airflow',
                unit: 'm³/h',
            },
            supplyFanRPM: {
                iobType: 'number',
                name: 'fan speed supply air',
                unit: '1/min',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 0);
                },
            },
            supplyFilterFul: {
                iobType: 'boolean',
                name: 'supply filter full',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return val === 1;
                },
            },
            supplyTemp: {
                iobType: 'number',
                name: 'supply air temperature',
                unit: '°C',
                readVal(val: number, adapter: ioBroker.Adapter, device: Device, id: string): ioBroker.StateValue {
                    return myHelper.maxDigits(val, 1);
                },
            },
            supplyVentPos: {
                iobType: 'number',
                name: 'supply flap position',
                unit: '%',
            },
            timestamp: {
                iobType: 'number',
                name: 'timestamp'
            },
            version: {
                iobType: 'string',
                name: 'software version'
            },
        }
    }

    export function getKeys(): string[] {
        if (keys === undefined) {
            keys = myHelper.getAllKeysOfTreeDefinition(get());
        }

        return keys
    }

    export function getStateIDs(): string[] {
        return myHelper.getAllIdsOfTreeDefinition(get());
    }
}
