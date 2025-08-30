import CryptoJS from "crypto-js";
export class DataParser {
    adapter;
    serialNo;
    clsLogPrefix = 'DataParser';
    operationMode = {
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
    program = {
        0: "Minimum ventilation",
        1: "Dehumidification (rel)",
        2: "Dehumidification (abs)",
        3: "Active cooling",
        4: "co2 reduction",
        5: "Water input",
        6: "Outside air < -22 ℃",
        7: "Humidity entry",
    };
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
            // In CryptoJS WordArray konvertieren
            const ciphertext = CryptoJS.lib.WordArray.create(encryptedData);
            const key = CryptoJS.enc.Utf8.parse(password.padEnd(16, "0"));
            const ivHex = '000102030405060708090a0b0c0d0e0f';
            const iv = CryptoJS.enc.Hex.parse(ivHex);
            // AES (Rijndael-128/256) CBC ZeroPadding
            const decrypted = CryptoJS.AES.decrypt({ ciphertext }, key, {
                iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.ZeroPadding,
            });
            // Messwerte als Uint8Array zurückgeben
            const decryptedData = Uint8Array.from(decrypted.words.flatMap((word, i) => [
                (word >>> 24) & 0xff,
                (word >>> 16) & 0xff,
                (word >>> 8) & 0xff,
                word & 0xff,
            ]));
            return decryptedData;
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
            // Mapping: Byte-Index -> [Feldnamen...], Reihenfolge = Bits von divideByte
            const bitMappings = {
                23: ["uErrorFileNr", "uDeicing"],
                24: ["uErrorState", "uDefrostExhaust"],
                25: ["uVentPosSupply", "uCtrlSetSupVent"],
                26: ["uVentPosExtract", "uCtrlSetExtVent"],
                27: ["uVentPosBath", "uCtrlSet2ndVent"],
                28: ["uVentPosBypass", "uCtrlSetBypVent"],
                29: ["uTempSupplyHigh", "uComfortLevel"],
                30: ["uTempExtractHigh", "uState"],
                31: ["uTempExhaustHigh", "uControlAuto"],
                32: ["uTempOutdoorHigh", "uDummy1"],
                33: ["uTempVirtSupExitHigh", "uDummy2"],
                34: ["uPressure4LSB", "uCFAHigh", "uFilterSupplyFul", "uFilterExtractFul"],
                35: ["uAirFlowAve", "u2ndRoomOnly20", "uFanLim2ndRoom"],
                36: ["uFanExtractRPMHigh", "uCO2High", "uDIPSwitchHigh"],
                37: ["uFanSupplyRPMHigh", "uHumRedMode", "uSumCooling"],
                38: ["uFanSpeed", "uFSCHigh", "uFECHigh", "uCSUHigh"],
                39: ["uPressure5MSB", "uErrorLineNrSuperHigh"],
                40: ["uOperatingHoursSuperHigh", "uFilterHoursSuperHigh", "uErrorCodeHigh"],
            };
            const divisions = {
                23: [6, 1],
                24: [5, 2],
                25: [5, 2],
                26: [5, 2],
                27: [5, 2],
                28: [5, 2],
                29: [4, 3],
                30: [4, 3],
                31: [4, 3],
                32: [4, 3],
                33: [4, 3],
                34: [4, 1, 1, 1],
                35: [5, 1, 1],
                36: [5, 1, 1],
                37: [5, 1, 1],
                38: [4, 1, 1, 1],
                39: [5, 2],
                40: [4, 2, 1],
            };
            // Ergebnisse in Map sammeln
            const values = {};
            for (const [idxStr, div] of Object.entries(divisions)) {
                const idx = +idxStr;
                const parts = this.divideByte(div, decryptedData[idx]);
                const fields = bitMappings[idx];
                if (fields) {
                    fields.forEach((f, i) => {
                        values[f] = parts[i];
                    });
                }
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
                operatingModeName: humRedMode ? this.operationMode[8] : this.operationMode[state] || "unknown",
                deicing: isDeicing
            };
            if (state === 0 || state === 1) {
                obj.program = controlAuto;
                obj.programName = this.program[controlAuto] || "unknown";
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
    lowPlusHigh(low, high, superHigh = undefined) {
        const arBitsTotal = [];
        for (let i = 0; i < 21; i++) {
            arBitsTotal.push(0);
        }
        const LSB7 = this.byteToBits(low);
        let MSB7;
        for (let i = 0; i < 7; i++) {
            arBitsTotal[i] = LSB7[i];
        }
        if (superHigh != void 0) {
            MSB7 = this.byteToBits(high);
            // if (MSB7.length != 8) {
            for (let i = 0; i < 7; i++) {
                arBitsTotal[i + 7] = MSB7[i];
            }
            // }
            let superHighBit = 0;
            for (let i = 14; i < superHigh.length + 14; i++) {
                arBitsTotal[i] = superHigh[superHighBit];
                superHighBit = superHighBit + 1;
            }
        }
        else {
            let highBit = 0;
            for (let i = 7; i < high.length + 7; i++) {
                arBitsTotal[i] = high[highBit];
                highBit = highBit + 1;
            }
        }
        let value = 0;
        let potenz = 1;
        for (let i = 0; i < 20; i++) {
            value = value + arBitsTotal[i] * potenz;
            potenz = potenz * 2;
        }
        return value;
    }
    divideByte(division, byte) {
        const bits = this.byteToBits(byte);
        const dividedByte = [];
        let bit = 0;
        for (let i = 0; i < division.length; i++) {
            dividedByte[i] = [];
            for (let b = 0; b < division[i]; b++) {
                dividedByte[i].push(bits[bit]);
                bit += 1;
            }
        }
        let checkSumByte = 0;
        for (let i = 0; i < division.length; i++) {
            checkSumByte += dividedByte[i].length;
        }
        return dividedByte;
    }
    byteToBits(byte) {
        const bits = [0, 0, 0, 0, 0, 0, 0, 0];
        let potenz = 128;
        for (let i = 7; i >= 0; i--) {
            if (byte / potenz >= 1) {
                bits[i] = 1;
                byte = byte - potenz;
            }
            potenz = potenz / 2;
        }
        return bits;
    }
    getNumberFrBits(arBits) {
        let potenz = 1;
        let uNumber = 0;
        for (let i = 0; i < arBits.length; i++) {
            uNumber += arBits[i] * potenz;
            potenz = potenz * 2;
        }
        return uNumber;
    }
    getPressure(Pressure5MSB, Pressure4LSB) {
        const arBitsTotal = [];
        for (let i = 0; i < 21; i++) {
            arBitsTotal.push(0);
        }
        for (let i = 0; i < 4; i++) {
            arBitsTotal[i] = Pressure4LSB[i];
        }
        for (let i = 0; i < 5; i++) {
            arBitsTotal[i + 4] = Pressure5MSB[i];
        }
        let value = 0;
        let potenz = 1;
        for (let i = 0; i < 20; i++) {
            value = value + arBitsTotal[i] * potenz;
            potenz = potenz * 2;
        }
        return value + 700;
    }
    getSecondRoomFlow(dip7, dip8) {
        const secRoomFlowCode = 2 * dip7 + dip8;
        let secondRoomFlow;
        switch (secRoomFlowCode) {
            case 0:
                secondRoomFlow = 0;
                break;
            case 1:
                secondRoomFlow = 30;
                break;
            case 2:
                secondRoomFlow = 60;
                break;
            case 3:
                secondRoomFlow = 100;
                break;
            default:
                this.adapter.log.error(`invalid value of second room flow`);
                break;
        }
        return secondRoomFlow;
    }
    getRoomArea(dip2, dip3, dip4) {
        const roomAreaCode = 4 * dip2 + 2 * dip3 + dip4;
        let roomArea = 0;
        switch (roomAreaCode) {
            case 0:
                roomArea = 20;
                break;
            case 1:
                roomArea = 25;
                break;
            case 2:
                roomArea = 35;
                break;
            case 3:
                roomArea = 45;
                break;
            case 4:
                roomArea = 60;
                break;
            case 5:
                roomArea = 75;
                break;
            case 6:
                roomArea = 30;
                break;
            case 7:
                roomArea = 50;
                break;
            default:
                this.adapter.log.error('invalid value of room area');
                break;
        }
        return roomArea;
    }
    getAbsHum(relHum, temp) {
        const ahPlusG10m3 = [
            49, 52, 56, 60, 64, 69, 73, 78, 84, 89, 95, 102, 108, 115, 123,
            131, 139, 148, 157, 167, 177, 188, 199, 212, 224, 238, 252, 267,
            283, 299, 317, 335, 354, 375, 396, 419, 442, 467, 494, 521, 550,
            581, 613, 647, 683, 721, 760, 802, 846, 893, 942
        ];
        const ahMinusG10m3 = [
            49, 45, 42, 39, 37, 34, 32, 29, 27, 25, 23, 21, 20, 18, 17,
            15, 14, 13, 12, 11, 10
        ];
        let absHum;
        if (temp >= 0) {
            if (temp > 50) {
                absHum = ((1e3 / 10) * relHum) / 100;
            }
            else {
                absHum = ((ahPlusG10m3[temp] / 10) * relHum) / 100;
            }
        }
        else {
            temp = Math.abs(temp);
            if (temp > 20) {
                absHum = ((5 / 10) * relHum) / 100;
            }
            else {
                absHum = ((ahMinusG10m3[temp] / 10) * relHum) / 100;
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
        const DIPbits = this.byteToBits(DIP);
        if (typ == 0) {
            return this.getRoomArea(DIPbits[6], DIPbits[5], DIPbits[4]);
        }
        else {
            return this.getSecondRoomFlow(DIPbits[1], DIPbits[0]);
        }
    }
    toSigned(num, potenz) {
        let maxUn = 2;
        for (let i = 2; i <= potenz; i++) {
            maxUn = maxUn * 2;
        }
        if (num >= maxUn / 2) {
            num = num - maxUn;
        }
        return num;
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
        const fanSupplyRPMs = {
            0: [20, 870, 1510],
            1: [30, 1000, 1640],
            2: [40, 1230, 1870],
            3: [50, 1460, 2100],
            4: [60, 1690, 2410],
            5: [70, 1910, 2630],
            6: [85, 2230, 2950],
            7: [100, 2540, 3260],
            8: [0, 0, 0]
        };
        return this.filterStatus(fanSupplyRPM, fanSpeed, fanSupplyRPMs);
    }
    filterExtractStatus(fanExtractRPM, fanSpeed) {
        const fanExtractRPMs = {
            0: [20, 920, 1560],
            1: [30, 1040, 1680],
            2: [40, 1260, 1900],
            3: [50, 1480, 2200],
            4: [60, 1700, 2420],
            5: [70, 1910, 2710],
            6: [85, 2210, 2930],
            7: [100, 2480, 3200],
            8: [0, 0, 0]
        };
        return this.filterStatus(fanExtractRPM, fanSpeed, fanExtractRPMs);
    }
    filterStatus(fanRPM, fanSpeed, filterRPMs) {
        // fillOverviewAndDetails.js
        fanSpeed = fanSpeed * 10;
        for (let i = 0; filterRPMs[i][0]; i++) {
            if (filterRPMs[i][0] < fanSpeed) {
                continue;
            }
            const nDiff = filterRPMs[i][2] - filterRPMs[i][1];
            if (fanRPM < filterRPMs[i][1] - nDiff / 2) {
                return 100;
            }
            ;
            if (fanRPM < filterRPMs[i][1] + nDiff * 0.4) {
                return 1;
            }
            ;
            if (fanRPM < filterRPMs[i][1] + nDiff * 0.7) {
                return 2;
            }
            ;
            if (fanRPM < filterRPMs[i][1] + nDiff * 0.95) {
                return 3;
            }
            ;
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
            const strPoUnderscore = versionFrBlob.substr(indexUnderscore + 1);
            if (strPoUnderscore != '0') {
                wantSubversion = true;
            }
            length = indexUnderscore;
        }
        let versionNew;
        if (((length - indexDot) <= 3) && ((length - indexDot) >= 1)) {
            const strDoDot = versionFrBlob.substr(0, indexDot + 1);
            let strPoDot = versionFrBlob.substr(indexDot + 1);
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
                    strPoDot = strPoDot.substr(0, 2);
                    versionNew = strDoDot + strPoDot;
                }
                else {
                    strPoDot = strPoDot.substr(0, 1);
                    versionNew = `${strDoDot}0${strPoDot}`;
                }
            }
            return versionNew;
        }
        return undefined;
    }
    sortByKey(obj) {
        const sortedEntries = Object.entries(obj).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
        return Object.fromEntries(new Map(sortedEntries));
    }
}
