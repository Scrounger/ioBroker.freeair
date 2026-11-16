import { createDecipheriv } from "node:crypto";
/** AES-CBC initialization vector of the device protocol. */
const AES_IV = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
const OPERATION_MODE = {
    0: "Comfort",
    1: "Comfort",
    2: "Sleep",
    3: "Turbo",
    4: "Turbo Cool",
    5: "Service",
    6: "Test",
    7: "Manufacturer",
    8: "Dehumidification"
};
const PROGRAM = {
    0: "Minimum ventilation",
    1: "Dehumidification (rel)",
    2: "Dehumidification (abs)",
    3: "Active cooling",
    4: "co2 reduction",
    5: "Water input",
    6: "Outside air < -22 ℃",
    7: "Humidity entry",
};
/**
 * Bit layout of the data bytes: byte index -> [field name, number of bits].
 * Bits are assigned consecutively, starting with the least significant bit.
 */
const BIT_LAYOUT = {
    23: [["uErrorFileNr", 6], ["uDeicing", 1]],
    24: [["uErrorState", 5], ["uDefrostExhaust", 2]],
    25: [["uVentPosSupply", 5], ["uCtrlSetSupVent", 2]],
    26: [["uVentPosExtract", 5], ["uCtrlSetExtVent", 2]],
    27: [["uVentPosBath", 5], ["uCtrlSet2ndVent", 2]],
    28: [["uVentPosBypass", 5], ["uCtrlSetBypVent", 2]],
    29: [["uTempSupplyHigh", 4], ["uComfortLevel", 3]],
    30: [["uTempExtractHigh", 4], ["uState", 3]],
    31: [["uTempExhaustHigh", 4], ["uControlAuto", 3]],
    32: [["uTempOutdoorHigh", 4], ["uDummy1", 3]],
    33: [["uTempVirtSupExitHigh", 4], ["uDummy2", 3]],
    34: [["uPressure4LSB", 4], ["uCFAHigh", 1], ["uFilterSupplyFul", 1], ["uFilterExtractFul", 1]],
    35: [["uAirFlowAve", 5], ["u2ndRoomOnly20", 1], ["uFanLim2ndRoom", 1]],
    36: [["uFanExtractRPMHigh", 5], ["uCO2High", 1], ["uDIPSwitchHigh", 1]],
    37: [["uFanSupplyRPMHigh", 5], ["uHumRedMode", 1], ["uSumCooling", 1]],
    38: [["uFanSpeed", 4], ["uFSCHigh", 1], ["uFECHigh", 1], ["uCSUHigh", 1]],
    39: [["uPressure5MSB", 5], ["uErrorLineNrSuperHigh", 2]],
    40: [["uOperatingHoursSuperHigh", 4], ["uFilterHoursSuperHigh", 2], ["uErrorCodeHigh", 1]],
};
/** Second room flow [m³/h] by code (2 * DIP7 + DIP8). */
const SECOND_ROOM_FLOW = [0, 30, 60, 100];
/** Room area [m²] by code (4 * DIP2 + 2 * DIP3 + DIP4). */
const ROOM_AREA = [20, 25, 35, 45, 60, 75, 30, 50];
/** Absolute humidity [g/m³] for temperatures 0..50 °C (index = temperature). */
const AH_PLUS_G10M3 = [
    49, 52, 56, 60, 64, 69, 73, 78, 84, 89, 95, 102, 108, 115, 123,
    131, 139, 148, 157, 167, 177, 188, 199, 212, 224, 238, 252, 267,
    283, 299, 317, 335, 354, 375, 396, 419, 442, 467, 494, 521, 550,
    581, 613, 647, 683, 721, 760, 802, 846, 893, 942
];
/** Absolute humidity [g/m³] for temperatures -0..-20 °C (index = |temperature|). */
const AH_MINUS_G10M3 = [
    49, 45, 42, 39, 37, 34, 32, 29, 27, 25, 23, 21, 20, 18, 17,
    15, 14, 13, 12, 11, 10
];
/** Filter thresholds for the supply fan: [min. fan speed * 10, RPM reference, RPM upper reference]. */
const FILTER_RPM_SUPPLY = [
    [20, 870, 1510],
    [30, 1000, 1640],
    [40, 1230, 1870],
    [50, 1460, 2100],
    [60, 1690, 2410],
    [70, 1910, 2630],
    [85, 2230, 2950],
    [100, 2540, 3260],
];
/** Filter thresholds for the extract fan: [min. fan speed * 10, RPM reference, RPM upper reference]. */
const FILTER_RPM_EXTRACT = [
    [20, 920, 1560],
    [30, 1040, 1680],
    [40, 1260, 1900],
    [50, 1480, 2200],
    [60, 1700, 2420],
    [70, 1910, 2710],
    [85, 2210, 2930],
    [100, 2480, 3200],
];
export class DataParser {
    adapter;
    serialNo;
    clsLogPrefix = 'DataParser';
    constructor(adapter, serialNo) {
        this.adapter = adapter;
        this.serialNo = serialNo;
    }
    parseData(encryptedData, timestamp, version, password) {
        const logPrefix = `[${this.clsLogPrefix}.parseData]: ${this.serialNo} - `;
        try {
            const decryptedData = this.parse(encryptedData, timestamp, version, password);
            if (decryptedData) {
                const processedData = this.processData(decryptedData, timestamp, version, version);
                if (processedData) {
                    return this.sortByKey({
                        ...this.getOverview(processedData),
                        ...this.getDetails(processedData),
                        ...this.getMisc(processedData)
                    });
                }
            }
            else {
                this.adapter.log.error(`${logPrefix} unable to decrypt data -> check password of device!`);
            }
        }
        catch (error) {
            this.adapter.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
        return undefined;
    }
    parseControl(encryptedData, timestamp, version, password) {
        const logPrefix = `[${this.clsLogPrefix}.parseData]: ${this.serialNo} - `;
        try {
            const decryptedData = this.parse(encryptedData, timestamp, version, password);
            if (decryptedData) {
                const processedData = this.processData(decryptedData, timestamp, version, version);
                if (processedData) {
                    const result = {
                        comfortLevel: processedData.comfortLevel,
                        operatingMode: processedData.state
                    };
                    this.adapter.log.debug(`${logPrefix} ${JSON.stringify(result)}`);
                    return result;
                }
            }
            else {
                this.adapter.log.error(`${logPrefix} unable to decrypt data -> check password of device!`);
            }
        }
        catch (error) {
            this.adapter.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
        return undefined;
    }
    parse(encryptedData, timestamp, version, password) {
        const logPrefix = `[${this.clsLogPrefix}.parse]: ${this.serialNo} - `;
        try {
            // AES-CBC (Rijndael) ohne Padding-Entfernung (entspricht CryptoJS ZeroPadding).
            // Schlüssellänge bestimmt die Variante: 16 Byte = AES-128, 24 = AES-192, 32 = AES-256
            const keyBuffer = Buffer.from(password.padEnd(16, "0"), "utf8");
            const decipher = createDecipheriv(`aes-${keyBuffer.length * 8}-cbc`, keyBuffer, AES_IV);
            decipher.setAutoPadding(false);
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(encryptedData)),
                decipher.final()
            ]);
            // Messwerte als Uint8Array zurückgeben
            return new Uint8Array(decrypted);
        }
        catch (error) {
            this.adapter.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
        return undefined;
    }
    processData(decryptedData, timestamp, version, versionFA100) {
        const logPrefix = `[${this.clsLogPrefix}.processData]: ${this.serialNo} - `;
        try {
            const blobObject = {};
            // Bitfelder aus den Datenbytes extrahieren (siehe BIT_LAYOUT)
            const values = {};
            for (const [idxStr, fields] of Object.entries(BIT_LAYOUT)) {
                const parts = this.divideByte(fields.map(([, bits]) => bits), decryptedData[+idxStr]);
                fields.forEach(([name], i) => {
                    values[name] = parts[i];
                });
            }
            // Direktbytes (keine Division nötig)
            values.uTempSupplyLow = decryptedData[2];
            values.uTempOutdoorLow = decryptedData[3];
            values.uTempExhaustLow = decryptedData[4];
            values.uTempExtractLow = decryptedData[5];
            values.uTempVirtSupExitLow = decryptedData[6];
            values.uFanExtractRPMLow = decryptedData[7];
            values.uDIPSwitchLow = decryptedData[8];
            values.uFanSupplyRPMLow = decryptedData[9];
            values.uErrorLineNrHigh = decryptedData[10];
            values.uErrorLineNrLow = decryptedData[11];
            values.uErrorCodeLow = decryptedData[12];
            values.uCO2Low = decryptedData[13];
            values.uOperatingHoursLow = decryptedData[14];
            values.uOperatingHoursHigh = decryptedData[15];
            values.uFilterHoursLow = decryptedData[16];
            values.uFilterHoursHigh = decryptedData[17];
            values.uFSCLow = decryptedData[18];
            values.uFECLow = decryptedData[19];
            values.uCSULow = decryptedData[20];
            values.uCFALow = decryptedData[21];
            values.uRSSILow = decryptedData[47];
            // Metadaten
            if (timestamp != null) {
                blobObject.timestamp = timestamp;
            }
            ;
            if (version != null) {
                blobObject.version = version.replace("x", ".");
            }
            ;
            if (versionFA100 != null) {
                blobObject.versionFA100 = versionFA100.replace("x", ".");
            }
            ;
            blobObject.outdoorHum = decryptedData[0];
            blobObject.extractHum = decryptedData[1];
            const iTempSupply = this.lowPlusHigh(values.uTempSupplyLow, values.uTempSupplyHigh);
            blobObject.supplyTemp = this.toSigned(iTempSupply, 11) / 8;
            const iTempOutdoor = this.lowPlusHigh(values.uTempOutdoorLow, values.uTempOutdoorHigh);
            blobObject.outdoorTemp = this.toSigned(iTempOutdoor, 11) / 8;
            const iTempExhaust = this.lowPlusHigh(values.uTempExhaustLow, values.uTempExhaustHigh);
            blobObject.exhaustTemp = this.toSigned(iTempExhaust, 11) / 8;
            const iTempExtract = this.lowPlusHigh(values.uTempExtractLow, values.uTempExtractHigh);
            blobObject.extractTemp = this.toSigned(iTempExtract, 11) / 8;
            const iTempVirtSupExit = this.lowPlusHigh(values.uTempVirtSupExitLow, values.uTempVirtSupExitHigh);
            blobObject.tempVirtSupExit = this.toSigned(iTempVirtSupExit, 11) / 8;
            blobObject.co2 = this.lowPlusHigh(values.uCO2Low, values.uCO2High) * 16;
            blobObject.pressure = this.getPressure(values.uPressure5MSB, values.uPressure4LSB);
            blobObject.comfortLevel = this.getNumberFrBits(values.uComfortLevel) + 1;
            blobObject.state = this.getNumberFrBits(values.uState);
            blobObject.humRedMode = this.getNumberFrBits(values.uHumRedMode);
            blobObject.fanLim2ndRoom = this.getNumberFrBits(values.uFanLim2ndRoom);
            blobObject.b2ndRoomOnly20 = this.getNumberFrBits(values.u2ndRoomOnly20);
            blobObject.bSumCooling = this.getNumberFrBits(values.uSumCooling);
            blobObject.errorState = this.getNumberFrBits(values.uErrorState);
            blobObject.fanSpeed = this.getNumberFrBits(values.uFanSpeed);
            blobObject.supplyFanRPM = this.lowPlusHigh(values.uFanSupplyRPMLow, values.uFanSupplyRPMHigh);
            blobObject.extractFanRPM = this.lowPlusHigh(values.uFanExtractRPMLow, values.uFanExtractRPMHigh);
            blobObject.airFlowAve = this.getNumberFrBits(values.uAirFlowAve);
            blobObject.supplyFilterFul = this.getNumberFrBits(values.uFilterSupplyFul);
            blobObject.extractFilterFul = this.getNumberFrBits(values.uFilterExtractFul);
            blobObject.extractVentPos = this.getNumberFrBits(values.uVentPosExtract);
            blobObject.bathVentPos = this.getNumberFrBits(values.uVentPosBath);
            blobObject.supplyVentPos = this.getNumberFrBits(values.uVentPosSupply);
            blobObject.bypassVentPos = this.getNumberFrBits(values.uVentPosBypass);
            blobObject.controlAuto = this.getNumberFrBits(values.uControlAuto);
            blobObject.dipSwitch = this.lowPlusHigh(values.uDIPSwitchLow, values.uDIPSwitchHigh);
            blobObject.exhaustDefrost = this.getNumberFrBits(values.uDefrostExhaust);
            blobObject.CtrlSetSupVent = this.getNumberFrBits(values.uCtrlSetSupVent);
            blobObject.CtrlSetExtVent = this.getNumberFrBits(values.uCtrlSetExtVent);
            blobObject.CtrlSet2ndVent = this.getNumberFrBits(values.uCtrlSet2ndVent);
            blobObject.CtrlSetBypVent = this.getNumberFrBits(values.uCtrlSetBypVent);
            blobObject.ErrorFileNr = this.getNumberFrBits(values.uErrorFileNr);
            blobObject.ErrorLineNr = this.lowPlusHigh(values.uErrorLineNrLow, values.uErrorLineNrHigh);
            blobObject.ErrorCode = this.lowPlusHigh(values.uErrorCodeLow, values.uErrorCodeHigh);
            blobObject.filter_hours = this.lowPlusHigh(values.uFilterHoursLow, values.uFilterHoursHigh, values.uFilterHoursSuperHigh);
            blobObject.operating_hours = this.lowPlusHigh(values.uOperatingHoursLow, values.uOperatingHoursHigh, values.uOperatingHoursSuperHigh);
            blobObject.board_version = decryptedData[22];
            blobObject.bDeicing = this.getNumberFrBits(values.uDeicing);
            blobObject.FSC = this.lowPlusHigh(values.uFSCLow, values.uFSCHigh);
            blobObject.FEC = this.lowPlusHigh(values.uFECLow, values.uFECHigh);
            blobObject.CSU = this.lowPlusHigh(values.uCSULow, values.uCSUHigh);
            blobObject.CFA = this.lowPlusHigh(values.uCFALow, values.uCFAHigh);
            blobObject.roomArea = this.parseDIP(blobObject.dipSwitch, 0);
            blobObject.secondRoomFlow = this.parseDIP(blobObject.dipSwitch, 1);
            const outdoorHumAbs = this.getAbsHum(blobObject.outdoorHum, this.roundVal(blobObject.outdoorTemp));
            const extractHumAbs = this.getAbsHum(blobObject.extractHum, this.roundVal(blobObject.extractTemp));
            const airDensity = this.getAirDensity(blobObject.pressure, blobObject.extractTemp);
            blobObject.extractHumAbs = extractHumAbs;
            blobObject.outdoorHumAbs = outdoorHumAbs;
            blobObject.airDensity = airDensity;
            blobObject.rssi = this.toSigned(values.uRSSILow, 8);
            blobObject.S1 = decryptedData[41];
            blobObject.S2 = decryptedData[42];
            blobObject.S3 = decryptedData[43];
            blobObject.S4 = decryptedData[44];
            blobObject.S5 = decryptedData[45];
            blobObject.S6 = decryptedData[46];
            if (blobObject.fanSpeed > 2) {
                blobObject.airFlow = blobObject.fanSpeed * 10;
            }
            else {
                blobObject.airFlow = blobObject.airFlowAve;
            }
            const sorted = this.sortByKey(blobObject);
            this.adapter.log.debug(`${logPrefix} ${JSON.stringify(sorted)}`);
            return sorted;
        }
        catch (error) {
            this.adapter.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
        return undefined;
    }
    getOverview(processedData) {
        const logPrefix = `[${this.clsLogPrefix}.getOverview]: ${this.serialNo} - `;
        try {
            const { outdoorTemp, outdoorHum, outdoorHumAbs, exhaustTemp, extractTemp, extractHum, extractHumAbs, co2, airFlow, tempVirtSupExit, bSumCooling, supplyFanRPM, extractFanRPM, fanSpeed } = processedData;
            const obj = {
                outdoorTemp, outdoorHum, outdoorHumAbs, exhaustTemp, extractTemp,
                extractHum, extractHumAbs, co2, airFlow, supplyTemp: tempVirtSupExit,
            };
            const isCooling = bSumCooling !== 0;
            obj.heatRecovery = isCooling ? 0 : this.getHeatRecoveryPercentage(extractTemp, outdoorTemp, tempVirtSupExit, airFlow);
            obj.powerRecovery = isCooling ? 0 : this.getPowerRecovery(extractTemp, outdoorTemp, tempVirtSupExit, airFlow);
            obj.coolingPower = isCooling ? this.getCoolingPower(airFlow, extractTemp, tempVirtSupExit) : 0;
            // --- Indicator: extractHum ---
            if (extractHum !== undefined) {
                obj.extractHumidityIndicator = this.getIndicatorLevel(extractHum, [
                    { min: 30, max: 60, level: 1 },
                    { min: 20, max: 70, level: 2 },
                    { min: 10, max: 85, level: 3 },
                    { min: -Infinity, max: Infinity, level: 4 }
                ]);
            }
            // --- Indicator: co2 ---
            if (co2 !== undefined) {
                obj.co2Indicator = this.getIndicatorLevel(co2, [
                    { max: 1000, level: 1 },
                    { max: 1700, level: 2 },
                    { max: 2500, level: 3 },
                    { max: Infinity, level: 4 }
                ]);
            }
            // --- Indicator: Filter ---
            if (supplyFanRPM !== undefined && fanSpeed) {
                obj.outdoorFilterIndicator = this.filterSupplyStatus(supplyFanRPM, fanSpeed);
            }
            if (extractFanRPM !== undefined && fanSpeed) {
                obj.exhaustFilterIndicator = this.filterExtractStatus(extractFanRPM, fanSpeed);
            }
            const sorted = this.sortByKey(obj);
            this.adapter.log.debug(`${logPrefix} ${JSON.stringify(sorted)}`);
            return sorted;
        }
        catch (err) {
            this.adapter.log.error(`${logPrefix} error: ${err.message}, stack: ${err.stack}`);
            return undefined;
        }
    }
    getDetails(processedData) {
        const logPrefix = `[${this.clsLogPrefix}.getDetails]: ${this.serialNo} - `;
        try {
            const { comfortLevel, operating_hours, filter_hours, roomArea, secondRoomFlow, supplyFanRPM, extractFanRPM, version, board_version, timestamp, state, humRedMode, bDeicing, exhaustDefrost, controlAuto } = processedData;
            const isDeicing = bDeicing === 1 || exhaustDefrost === 1 || exhaustDefrost === 2;
            const obj = {
                comfortLevel, operating_hours, filter_hours, roomArea, secondRoomFlow, supplyFanRPM, extractFanRPM,
                version: this.correctVersion(version),
                board_version, timestamp,
                operatingMode: state,
                operatingModeName: humRedMode ? OPERATION_MODE[8] : OPERATION_MODE[state] || "unknown",
                deicing: isDeicing
            };
            if (state === 0 || state === 1) {
                obj.program = controlAuto;
                obj.programName = PROGRAM[controlAuto] || "unknown";
            }
            const sorted = this.sortByKey(obj);
            this.adapter.log.debug(`${logPrefix} ${JSON.stringify(sorted)}`);
            return sorted;
        }
        catch (err) {
            this.adapter.log.error(`${logPrefix} error: ${err.message}, stack: ${err.stack}`);
            return undefined;
        }
    }
    getMisc(processedData) {
        const logPrefix = `[${this.clsLogPrefix}.getMisc]: ${this.serialNo} - `;
        try {
            const { rssi, errorState, pressure, airDensity, supplyVentPos, extractVentPos, bypassVentPos, extractFilterFul, supplyFilterFul } = processedData;
            const hasErrors = ![0, "0", 22, "22"].includes(errorState);
            const obj = {
                rssi,
                hasErrors,
                pressure,
                airDensity: airDensity,
                supplyVentPos: supplyVentPos,
                extractVentPos: extractVentPos,
                bypassVentPos: bypassVentPos,
                extractFilterFul: extractFilterFul,
                supplyFilterFul: supplyFilterFul,
            };
            const sorted = this.sortByKey(obj);
            this.adapter.log.debug(`${logPrefix} ${JSON.stringify(sorted)}`);
            return sorted;
        }
        catch (err) {
            console.error(`${logPrefix} error: ${err.message}, stack: ${err.stack}`);
            return undefined;
        }
    }
    getIndicatorLevel(value, levels) {
        for (const { min = -Infinity, max = Infinity, level } of levels) {
            if (value >= min && value <= max) {
                return level;
            }
        }
        return 0; // fallback
    }
    // Combines a 7-bit low byte with the high part.
    // - superHigh given: high is a byte (bits 7..13), superHigh is a bit array (bits 14 and up).
    // - otherwise: high is a bit array (bits 7 and up); a plain number contributes nothing.
    lowPlusHigh(low, high, superHigh) {
        const lowPart = low & 0x7f;
        if (superHigh !== undefined) {
            return lowPart + ((high & 0x7f) << 7) + (this.getNumberFrBits(superHigh) << 14);
        }
        return lowPart + this.getNumberFrBits(high) * 128;
    }
    // Splits a byte into consecutive bit groups of the given widths (LSB first).
    divideByte(widths, byte) {
        const dividedByte = [];
        let bit = 0;
        for (const width of widths) {
            const group = [];
            for (let b = 0; b < width; b++) {
                group.push((byte >> bit) & 1);
                bit += 1;
            }
            dividedByte.push(group);
        }
        return dividedByte;
    }
    getNumberFrBits(arBits) {
        let uNumber = 0;
        for (let i = 0; i < arBits.length; i++) {
            uNumber += arBits[i] * 2 ** i;
        }
        return uNumber;
    }
    // 4 LSB bits and 5 MSB bits form a 9-bit value, offset by 700.
    getPressure(Pressure5MSB, Pressure4LSB) {
        return this.getNumberFrBits(Pressure4LSB) + this.getNumberFrBits(Pressure5MSB) * 16 + 700;
    }
    getSecondRoomFlow(dip7, dip8) {
        const secondRoomFlow = SECOND_ROOM_FLOW[2 * dip7 + dip8];
        if (secondRoomFlow === undefined) {
            this.adapter.log.error(`invalid value of second room flow`);
        }
        return secondRoomFlow;
    }
    getRoomArea(dip2, dip3, dip4) {
        const roomArea = ROOM_AREA[4 * dip2 + 2 * dip3 + dip4];
        if (roomArea === undefined) {
            this.adapter.log.error('invalid value of room area');
            return 0;
        }
        return roomArea;
    }
    getAbsHum(relHum, temp) {
        let absHum;
        if (temp >= 0) {
            if (temp > 50) {
                absHum = ((1e3 / 10) * relHum) / 100;
            }
            else {
                absHum = ((AH_PLUS_G10M3[temp] / 10) * relHum) / 100;
            }
        }
        else {
            temp = Math.abs(temp);
            if (temp > 20) {
                absHum = ((5 / 10) * relHum) / 100;
            }
            else {
                absHum = ((AH_MINUS_G10M3[temp] / 10) * relHum) / 100;
            }
        }
        return absHum;
    }
    getAirDensity(pressure, tempExtract) {
        let density = (pressure * 100) / ((tempExtract + 273.15) * 287.058);
        density = (density + 0);
        return density;
    }
    roundVal(val) {
        return Math.round(val);
    }
    parseDIP(DIP, typ) {
        const bit = (index) => (DIP >> index) & 1;
        if (typ == 0) {
            return this.getRoomArea(bit(6), bit(5), bit(4));
        }
        else {
            return this.getSecondRoomFlow(bit(1), bit(0));
        }
    }
    // Interprets the lowest `bits` bits of `num` as two's complement value.
    toSigned(num, bits) {
        const range = 2 ** bits;
        return num >= range / 2 ? num - range : num;
    }
    getHeatRecoveryPercentage(tempExtract, tempOutdoor, tempSupply, airFlow) {
        // fillOverviewAndDetails.js
        if (airFlow == 0) {
            return 100;
        }
        if (Math.abs(tempExtract - tempOutdoor) < 2) {
            return 100;
        }
        const val = 100 * (1 - (tempExtract - tempSupply) / (tempExtract - tempOutdoor)) + 0.5;
        return val;
    }
    getPowerRecovery(tempExtract, tempOutdoor, tempSupply, airFlow) {
        if (Math.abs(tempExtract - tempOutdoor) < 2) {
            return 0;
        }
        const recovery1 = airFlow * (tempSupply - tempOutdoor);
        return (recovery1 / 3 + 0.5);
    }
    getCoolingPower(airFlow, tempExtract, tempSupply) {
        return ((airFlow * (tempExtract - tempSupply)) / 3 + 0.5);
    }
    filterSupplyStatus(fanSupplyRPM, fanSpeed) {
        return this.filterStatus(fanSupplyRPM, fanSpeed, FILTER_RPM_SUPPLY);
    }
    filterExtractStatus(fanExtractRPM, fanSpeed) {
        return this.filterStatus(fanExtractRPM, fanSpeed, FILTER_RPM_EXTRACT);
    }
    filterStatus(fanRPM, fanSpeed, filterRPMs) {
        // fillOverviewAndDetails.js
        const speed = fanSpeed * 10;
        for (const [minSpeed, rpm, rpmMax] of filterRPMs) {
            if (minSpeed < speed) {
                continue;
            }
            const nDiff = rpmMax - rpm;
            if (fanRPM < rpm - nDiff / 2) {
                return 100;
            }
            if (fanRPM < rpm + nDiff * 0.4) {
                return 1;
            }
            if (fanRPM < rpm + nDiff * 0.7) {
                return 2;
            }
            if (fanRPM < rpm + nDiff * 0.95) {
                return 3;
            }
            return 4;
        }
        return undefined;
    }
    correctVersion(versionFrBlob) {
        const indexDot = versionFrBlob.indexOf('.');
        let wantSubversion = false;
        const indexUnderscore = versionFrBlob.indexOf('x');
        let length = versionFrBlob.length;
        if (indexUnderscore > 0) {
            const strPoUnderscore = versionFrBlob.slice(indexUnderscore + 1);
            if (strPoUnderscore != '0') {
                wantSubversion = true;
            }
            length = indexUnderscore;
        }
        let versionNew;
        if (((length - indexDot) <= 3) && ((length - indexDot) >= 1)) {
            const strDoDot = versionFrBlob.slice(0, indexDot + 1);
            let strPoDot = versionFrBlob.slice(indexDot + 1);
            if (wantSubversion) {
                //versionNew = strDoDot + '0' + strPoDot;
                if ((length - indexDot) == 3) {
                    versionNew = strDoDot + strPoDot;
                }
                else {
                    versionNew = `${strDoDot}0${strPoDot}`;
                }
                versionNew = versionNew.replace("x", "_");
            }
            else {
                if ((length - indexDot) == 3) {
                    strPoDot = strPoDot.slice(0, 2);
                    versionNew = strDoDot + strPoDot;
                }
                else {
                    strPoDot = strPoDot.slice(0, 1);
                    versionNew = `${strDoDot}0${strPoDot}`;
                }
            }
            return versionNew;
        }
        return undefined;
    }
    sortByKey(obj) {
        const sortedEntries = Object.entries(obj).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
        return Object.fromEntries(sortedEntries);
    }
}
