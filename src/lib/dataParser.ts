import CryptoJS from "crypto-js";
import { Device } from "./types-device.js";

export class DataParser {
    private adapter: ioBroker.Adapter;
    private serialNo: string;

    private clsLogPrefix = 'DataParser'

    private operationMode = {
        0: "Comfort",
        1: "Comfort",
        2: "Sleep",
        3: "Turbo",
        4: "Turbo Cool",
        5: "Service",
        6: "Test",
        7: "Manufacturer",
        8: "Dehumidification"
    }

    private program = {
        0: "Minimum ventilation",
        1: "Dehumidification (rel)",
        2: "Dehumidification (abs)",
        3: "Active cooling",
        4: "co2 reduction",
        5: "Water input",
        6: "Outside air < -22 ℃",
        7: "Humidity entry",
    }

    constructor(adapter: ioBroker.Adapter, serialNo: string) {
        this.adapter = adapter;
        this.serialNo = serialNo;
    }

    public parse(encryptedData: Uint8Array, timestamp: number, version: string, password: string): Device {
        const logPrefix = `[${this.clsLogPrefix}.parse]: ${this.serialNo} - `;

        try {
            // In CryptoJS WordArray konvertieren
            const ciphertext = CryptoJS.lib.WordArray.create(encryptedData as any);

            const key = CryptoJS.enc.Utf8.parse(password.padEnd(16, "0"));

            const ivHex = '000102030405060708090a0b0c0d0e0f';
            const iv = CryptoJS.enc.Hex.parse(ivHex);

            // AES (Rijndael-128/256) CBC ZeroPadding
            const decrypted = CryptoJS.AES.decrypt({ ciphertext }, key,
                {
                    iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.ZeroPadding,
                }
            );

            // Messwerte als Uint8Array zurückgeben
            const decryptedData = Uint8Array.from(
                decrypted.words.flatMap((word, i) => [
                    (word >>> 24) & 0xff,
                    (word >>> 16) & 0xff,
                    (word >>> 8) & 0xff,
                    word & 0xff,
                ])
            );

            const processedData = this.processData(decryptedData, timestamp, version, version);

            if (processedData) {
                const result = this.sortByKey({
                    ...this.getOverview(processedData),
                    ...this.getDetails(processedData),
                    ...this.getMisc(processedData)
                });

                return result as Device;
            }
        } catch (error: any) {
            this.adapter.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }

        return undefined;
    }

    private processData(decryptedData: any[] | Uint8Array, timestamp: number, version: string, versionFA100: string): {} {
        const logPrefix = `[${this.clsLogPrefix}.processData]: ${this.serialNo} - `;

        try {
            let blobObject = {};
            let division23 = [6, 1];
            let dividedByte23 = this.divideByte(division23, decryptedData[23]);
            let division24 = [5, 2];
            let dividedByte24 = this.divideByte(division24, decryptedData[24]);
            let division25 = [5, 2];
            let dividedByte25 = this.divideByte(division25, decryptedData[25]);
            let division26 = [5, 2];
            let dividedByte26 = this.divideByte(division26, decryptedData[26]);
            let division27 = [5, 2];
            let dividedByte27 = this.divideByte(division27, decryptedData[27]);
            let division28 = [5, 2];
            let dividedByte28 = this.divideByte(division28, decryptedData[28]);
            let division29 = [4, 3];
            let dividedByte29 = this.divideByte(division29, decryptedData[29]);
            let division30 = [4, 3];
            let dividedByte30 = this.divideByte(division30, decryptedData[30]);
            let division31 = [4, 3];
            let dividedByte31 = this.divideByte(division31, decryptedData[31]);
            let division32 = [4, 3];
            let dividedByte32 = this.divideByte(division32, decryptedData[32]);
            let division33 = [4, 3];
            let dividedByte33 = this.divideByte(division33, decryptedData[33]);
            let division34 = [4, 1, 1, 1];
            let dividedByte34 = this.divideByte(division34, decryptedData[34]);
            let division35 = [5, 1, 1];
            let dividedByte35 = this.divideByte(division35, decryptedData[35]);
            let division36 = [5, 1, 1];
            let dividedByte36 = this.divideByte(division36, decryptedData[36]);
            let division37 = [5, 1, 1];
            let dividedByte37 = this.divideByte(division37, decryptedData[37]);
            let division38 = [4, 1, 1, 1];
            let dividedByte38 = this.divideByte(division38, decryptedData[38]);
            let division39 = [5, 2];
            let dividedByte39 = this.divideByte(division39, decryptedData[39]);
            let division40 = [4, 2, 1];
            let dividedByte40 = this.divideByte(division40, decryptedData[40]);
            let uDeicing = dividedByte23[1];
            let uErrorFileNr = dividedByte23[0];
            let uErrorState = dividedByte24[0];
            let uDefrostExhaust = dividedByte24[1];
            let uVentPosSupply = dividedByte25[0];
            let uCtrlSetSupVent = dividedByte25[1];
            let uVentPosExtract = dividedByte26[0];
            let uCtrlSetExtVent = dividedByte26[1];
            let uVentPosBath = dividedByte27[0];
            let uCtrlSet2ndVent = dividedByte27[1];
            let uVentPosBypass = dividedByte28[0];
            let uCtrlSetBypVent = dividedByte28[1];
            let uTempSupplyHigh = dividedByte29[0];
            let uComfortLevel = dividedByte29[1];
            let uTempExtractHigh = dividedByte30[0];
            let uState = dividedByte30[1];
            let uTempExhaustHigh = dividedByte31[0];
            let uControlAuto = dividedByte31[1];
            let uTempOutdoorHigh = dividedByte32[0];
            let uDummy1 = dividedByte32[1];
            let uTempVirtSupExitHigh = dividedByte33[0];
            let uDummy2 = dividedByte33[1];
            let uPressure4LSB = dividedByte34[0];
            let uCFAHigh = dividedByte34[1];
            let uFilterSupplyFul = dividedByte34[2];
            let uFilterExtractFul = dividedByte34[3];
            let uAirFlowAve = dividedByte35[0];
            let u2ndRoomOnly20 = dividedByte35[1];
            let uFanLim2ndRoom = dividedByte35[2];
            let uFanExtractRPMHigh = dividedByte36[0];
            let uCO2High = dividedByte36[1];
            let uDIPSwitchHigh = dividedByte36[2];
            let uFanSupplyRPMHigh = dividedByte37[0];
            let uHumRedMode = dividedByte37[1];
            let uSumCooling = dividedByte37[2];
            let uFanSpeed = dividedByte38[0];
            let uFSCHigh = dividedByte38[1];
            let uFECHigh = dividedByte38[2];
            let uCSUHigh = dividedByte38[3];
            let uPressure5MSB = dividedByte39[0];
            let uErrorLineNrSuperHigh = dividedByte39[1];
            let uOperatingHoursSuperHigh = dividedByte40[0];
            let uFilterHoursSuperHigh = dividedByte40[1];
            let uErrorCodeHigh = dividedByte40[2];
            let uTempSupplyLow = decryptedData[2];
            let uTempOutdoorLow = decryptedData[3];
            let uTempExhaustLow = decryptedData[4];
            let uTempExtractLow = decryptedData[5];
            let uTempVirtSupExitLow = decryptedData[6];
            let uFanExtractRPMLow = decryptedData[7];
            let uDIPSwitchLow = decryptedData[8];
            let uFanSupplyRPMLow = decryptedData[9];
            let uErrorLineNrHigh = decryptedData[10];
            let uErrorLineNrLow = decryptedData[11];
            let uErrorCodeLow = decryptedData[12];
            let uCO2Low = decryptedData[13];
            let uOperatingHoursLow = decryptedData[14];
            let uOperatingHoursHigh = decryptedData[15];
            let uFilterHoursLow = decryptedData[16];
            let uFilterHoursHigh = decryptedData[17];
            let uFSCLow = decryptedData[18];
            let uFECLow = decryptedData[19];
            let uCSULow = decryptedData[20];
            let uCFALow = decryptedData[21];
            let uRSSILow = decryptedData[47];
            if (timestamp != null) blobObject["timestamp"] = timestamp;
            if (version != null) blobObject["version"] = version.replace("x", ".");
            if (versionFA100 != null) blobObject["versionFA100"] = versionFA100.replace("x", ".");
            blobObject["outdoorHum"] = decryptedData[0];
            blobObject["extractHum"] = decryptedData[1];
            let iTempSupply = this.lowPlusHigh(uTempSupplyLow, uTempSupplyHigh);
            blobObject["supplyTemp"] = this.toSigned(iTempSupply, 11) / 8;
            let iTempOutdoor = this.lowPlusHigh(uTempOutdoorLow, uTempOutdoorHigh);
            blobObject["outdoorTemp"] = this.toSigned(iTempOutdoor, 11) / 8;
            let iTempExhaust = this.lowPlusHigh(uTempExhaustLow, uTempExhaustHigh);
            blobObject["exhaustTemp"] = this.toSigned(iTempExhaust, 11) / 8;
            let iTempExtract = this.lowPlusHigh(uTempExtractLow, uTempExtractHigh);
            blobObject["extractTemp"] = this.toSigned(iTempExtract, 11) / 8;
            let iTempVirtSupExit = this.lowPlusHigh(uTempVirtSupExitLow, uTempVirtSupExitHigh);
            blobObject["tempVirtSupExit"] = this.toSigned(iTempVirtSupExit, 11) / 8;
            blobObject["co2"] = this.lowPlusHigh(uCO2Low, uCO2High) * 16;
            blobObject["pressure"] = this.getPressure(uPressure5MSB, uPressure4LSB);
            blobObject["comfortLevel"] = this.getNumberFrBits(uComfortLevel) + 1;
            blobObject["state"] = this.getNumberFrBits(uState);
            blobObject["humRedMode"] = this.getNumberFrBits(uHumRedMode);
            blobObject["fanLim2ndRoom"] = this.getNumberFrBits(uFanLim2ndRoom);
            blobObject["b2ndRoomOnly20"] = this.getNumberFrBits(u2ndRoomOnly20);
            blobObject["bSumCooling"] = this.getNumberFrBits(uSumCooling);
            blobObject["errorState"] = this.getNumberFrBits(uErrorState);
            blobObject["fanSpeed"] = this.getNumberFrBits(uFanSpeed);
            blobObject["supplyFanRPM"] = this.lowPlusHigh(uFanSupplyRPMLow, uFanSupplyRPMHigh);
            blobObject["extractFanRPM"] = this.lowPlusHigh(uFanExtractRPMLow, uFanExtractRPMHigh);
            blobObject["airFlowAve"] = this.getNumberFrBits(uAirFlowAve);
            blobObject["supplyFilterFul"] = this.getNumberFrBits(uFilterSupplyFul);
            blobObject["extractFilterFul"] = this.getNumberFrBits(uFilterExtractFul);
            blobObject["extractVentPos"] = this.getNumberFrBits(uVentPosExtract);
            blobObject["bathVentPos"] = this.getNumberFrBits(uVentPosBath);
            blobObject["supplyVentPos"] = this.getNumberFrBits(uVentPosSupply);
            blobObject["bypassVentPos"] = this.getNumberFrBits(uVentPosBypass);
            blobObject["controlAuto"] = this.getNumberFrBits(uControlAuto);
            blobObject["dipSwitch"] = this.lowPlusHigh(uDIPSwitchLow, uDIPSwitchHigh);
            blobObject["exhaustDefrost"] = this.getNumberFrBits(uDefrostExhaust);
            blobObject["CtrlSetSupVent"] = this.getNumberFrBits(uCtrlSetSupVent);
            blobObject["CtrlSetExtVent"] = this.getNumberFrBits(uCtrlSetExtVent);
            blobObject["CtrlSet2ndVent"] = this.getNumberFrBits(uCtrlSet2ndVent);
            blobObject["CtrlSetBypVent"] = this.getNumberFrBits(uCtrlSetBypVent);
            blobObject["ErrorFileNr"] = this.getNumberFrBits(uErrorFileNr);
            blobObject["ErrorLineNr"] = this.lowPlusHigh(uErrorLineNrLow, uErrorLineNrHigh);
            blobObject["ErrorCode"] = this.lowPlusHigh(uErrorCodeLow, uErrorCodeHigh);
            blobObject["filter_hours"] = this.lowPlusHigh(uFilterHoursLow, uFilterHoursHigh, uFilterHoursSuperHigh);
            blobObject["operating_hours"] = this.lowPlusHigh(uOperatingHoursLow, uOperatingHoursHigh, uOperatingHoursSuperHigh);
            blobObject["board_version"] = decryptedData[22];
            blobObject["bDeicing"] = this.getNumberFrBits(uDeicing);
            blobObject["FSC"] = this.lowPlusHigh(uFSCLow, uFSCHigh);
            blobObject["FEC"] = this.lowPlusHigh(uFECLow, uFECHigh);
            blobObject["CSU"] = this.lowPlusHigh(uCSULow, uCSUHigh);
            blobObject["CFA"] = this.lowPlusHigh(uCFALow, uCFAHigh);
            blobObject["roomArea"] = this.parseDIP(blobObject["dipSwitch"], 0);
            blobObject["secondRoomFlow"] = this.parseDIP(blobObject["dipSwitch"], 1);
            let outdoorHumAbs = this.getAbsHum(blobObject["outdoorHum"], this.roundVal(blobObject["outdoorTemp"]));
            let extractHumAbs = this.getAbsHum(blobObject["extractHum"], this.roundVal(blobObject["extractTemp"]));
            let airDensity = this.getAirDensity(blobObject["pressure"], blobObject["extractTemp"]);
            blobObject["extractHumAbs"] = extractHumAbs;
            blobObject["outdoorHumAbs"] = outdoorHumAbs;
            blobObject["airDensity"] = airDensity;
            blobObject["rssi"] = this.toSigned(uRSSILow, 8);
            blobObject["S1"] = decryptedData[41];
            blobObject["S2"] = decryptedData[42];
            blobObject["S3"] = decryptedData[43];
            blobObject["S4"] = decryptedData[44];
            blobObject["S5"] = decryptedData[45];
            blobObject["S6"] = decryptedData[46];
            if (blobObject["fanSpeed"] > 2) {
                blobObject["airFlow"] = blobObject["fanSpeed"] * 10;
            } else {
                blobObject["airFlow"] = blobObject["airFlowAve"];
            }

            const sorted = this.sortByKey(blobObject);
            this.adapter.log.debug(`${logPrefix} ${JSON.stringify(sorted)}`);

            return sorted;

        } catch (error: any) {
            this.adapter.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }

        return undefined;
    }

    private getOverview(processedData: { [key: string]: any }): Partial<Device> | undefined {
        const logPrefix = `[${this.clsLogPrefix}.getOverview]: ${this.serialNo} - `;

        try {
            const {
                outdoorTemp, outdoorHum, outdoorHumAbs, exhaustTemp, extractTemp,
                extractHum, extractHumAbs, co2, airFlow, tempVirtSupExit, bSumCooling,
                supplyFanRPM, extractFanRPM, fanSpeed
            } = processedData;

            const obj: Record<string, any> = {
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

        } catch (err: any) {
            this.adapter.log.error(`${logPrefix} error: ${err.message}, stack: ${err.stack}`);
            return undefined;
        }
    }

    private getDetails(processedData: { [key: string]: any }): Partial<Device> | undefined {
        const logPrefix = `[${this.clsLogPrefix}.getDetails]: ${this.serialNo} - `;

        try {
            const {
                comfortLevel, operating_hours, filter_hours, roomArea, secondRoomFlow,
                supplyFanRPM, extractFanRPM, version, board_version, timestamp,
                state, humRedMode, bDeicing, exhaustDefrost, controlAuto
            } = processedData;

            const isDeicing = bDeicing === 1 || exhaustDefrost === 1 || exhaustDefrost === 2;

            const obj: Record<string, any> = {
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

        } catch (err: any) {
            this.adapter.log.error(`${logPrefix} error: ${err.message}, stack: ${err.stack}`);
            return undefined;
        }
    }

    private getMisc(processedData: { [key: string]: any }): Partial<Device> | undefined {
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

        } catch (err: any) {
            console.error(`${logPrefix} error: ${err.message}, stack: ${err.stack}`);
            return undefined;
        }
    }


    private getIndicatorLevel(value: number, levels: { min?: number; max?: number; level: number }[]): number {
        for (const { min = -Infinity, max = Infinity, level } of levels) {
            if (value >= min && value <= max) {
                return level;
            }
        }
        return 0; // fallback
    }

    private lowPlusHigh(low: number, high: string | any[], superHigh: string | any[] = undefined) {
        let arBitsTotal = [];
        for (let i = 0; i < 21; i++) {
            arBitsTotal.push(0);
        }
        let LSB7 = this.byteToBits(low);
        let MSB7;
        for (let i = 0; i < 7; i++) {
            arBitsTotal[i] = LSB7[i];
        }
        if (superHigh != undefined) {
            MSB7 = this.byteToBits(high);
            if (MSB7.length != 8) {
            }
            for (let i = 0; i < 7; i++) {
                arBitsTotal[i + 7] = MSB7[i];
            }
            let superHighBit = 0;
            for (let i = 14; i < superHigh.length + 14; i++) {
                arBitsTotal[i] = superHigh[superHighBit];
                superHighBit = superHighBit + 1;
            }
        } else {
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
    private divideByte(division: string | any[], byte: any) {
        let bits = this.byteToBits(byte);
        let dividedByte = [];
        let bit = 0;
        for (let i = 0; i < division.length; i++) {
            dividedByte[i] = [];
            for (let b = 0; b < division[i]; b++) {
                dividedByte[i].push(bits[bit]);
                bit += 1;
            }
        }
        if (bit != 8) {
        }
        let checkSumByte = 0;
        for (let i = 0; i < division.length; i++) {
            checkSumByte += dividedByte[i].length;
        }
        if (checkSumByte != 7) {
        }
        return dividedByte;
    }
    private byteToBits(byte: any) {
        let bits = [0, 0, 0, 0, 0, 0, 0, 0];
        let potenz = 128;
        for (let i = 7; i >= 0; i--) {
            if (byte / potenz >= 1) {
                bits[i] = 1;
                byte = byte - potenz;
                if (i == 0 && byte > 0) {
                }
            }
            potenz = potenz / 2;
        }
        return bits;
    }
    private getNumberFrBits(arBits: any[]) {
        let potenz = 1;
        let uNumber = 0;
        for (let i = 0; i < arBits.length; i++) {
            uNumber += arBits[i] * potenz;
            potenz = potenz * 2;
        }
        return uNumber;
    }
    private getPressure(Pressure5MSB: any[], Pressure4LSB: any[]) {
        let arBitsTotal = [];
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

    private getSecondRoomFlow(dip7: number, dip8: number) {
        let secRoomFlowCode = 2 * dip7 + dip8;
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
                throw "invalid value of second room flow";
                break;
        }
        return secondRoomFlow;
    }
    private getRoomArea(dip2: number, dip3: number, dip4: number) {
        let roomAreaCode = 4 * dip2 + 2 * dip3 + dip4;
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
                throw "invalid value of room area";
                break;
        }
        return roomArea;
    }
    private getAbsHum(relHum: number, temp: number) {
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
            } else {
                absHum = ((ahPlusG10m3[temp] / 10) * relHum) / 100;
            }
        } else {
            temp = Math.abs(temp);
            if (temp > 20) {
                absHum = ((5 / 10) * relHum) / 100;
            } else {
                absHum = ((ahMinusG10m3[temp] / 10) * relHum) / 100;
            }
        }
        return absHum;
    }
    private getAirDensity(pressure: number, tempExtract: number) {
        let density = (pressure * 100) / ((tempExtract + 273.15) * 287.058);
        density = (density + 0);
        return density;
    }

    private roundVal(val: number) {
        return Math.round(val);
    }

    private parseDIP(DIP: any, typ: number) {
        let DIPbits = this.byteToBits(DIP);
        if (typ == 0) {
            return this.getRoomArea(DIPbits[6], DIPbits[5], DIPbits[4]);
        } else {
            return this.getSecondRoomFlow(DIPbits[1], DIPbits[0]);
        }
    }

    private toSigned(num: number, potenz: number) {
        let maxUn = 2;
        for (let i = 2; i <= potenz; i++) {
            maxUn = maxUn * 2;
        }
        if (num >= maxUn / 2) {
            num = num - maxUn;
        }
        return num;
    }

    private getHeatRecoveryPercentage(tempExtract: number, tempOutdoor: number, tempSupply: number, airFlow: number) {
        // fillOverviewAndDetails.js
        if (airFlow == 0) {
            return 100;
        }
        if (Math.abs(tempExtract - tempOutdoor) < 2) {
            return 100;
        }
        let val = 100 * (1 - (tempExtract - tempSupply) / (tempExtract - tempOutdoor)) + 0.5;
        return val;
    }

    private getPowerRecovery(tempExtract: number, tempOutdoor: number, tempSupply: number, airFlow: number) {
        if (Math.abs(tempExtract - tempOutdoor) < 2) {
            return 0;
        }
        let recovery1 = airFlow * (tempSupply - tempOutdoor);
        return (recovery1 / 3 + 0.5);
    }

    private getCoolingPower(airFlow: number, tempExtract: number, tempSupply: number) {
        return ((airFlow * (tempExtract - tempSupply)) / 3 + 0.5);
    }

    private filterSupplyStatus(fanSupplyRPM: any, fanSpeed: any) {
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

    private filterExtractStatus(fanExtractRPM: any, fanSpeed: any) {
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

    private filterStatus(fanRPM: number, fanSpeed: number, filterRPMs: any) {
        // fillOverviewAndDetails.js

        fanSpeed = fanSpeed * 10;
        for (let i = 0; filterRPMs[i][0]; i++) {
            if (filterRPMs[i][0] < fanSpeed) {
                continue;
            }
            let nDiff = filterRPMs[i][2] - filterRPMs[i][1];
            if (fanRPM < filterRPMs[i][1] - nDiff / 2) return 100;
            if (fanRPM < filterRPMs[i][1] + nDiff * 0.4) return 1;
            if (fanRPM < filterRPMs[i][1] + nDiff * 0.7) return 2;
            if (fanRPM < filterRPMs[i][1] + nDiff * 0.95) return 3;
            return 4;
        }

        return undefined;
    }

    private correctVersion(versionFrBlob: string) {
        let indexDot = versionFrBlob.indexOf('.');
        let wantSubversion = false;
        let indexUnderscore = versionFrBlob.indexOf('x');
        let length = versionFrBlob.length;
        if (indexUnderscore > 0) {
            let strPoUnderscore = versionFrBlob.substr(indexUnderscore + 1);
            if (strPoUnderscore != '0')
                wantSubversion = true;
            length = indexUnderscore;
        }
        let versionNew: string;
        if (((length - indexDot) <= 3) && ((length - indexDot) >= 1)) {
            let strDoDot = versionFrBlob.substr(0, indexDot + 1);
            let strPoDot = versionFrBlob.substr(indexDot + 1);
            if (wantSubversion) {
                //versionNew = strDoDot + '0' + strPoDot;

                if ((length - indexDot) == 3) {
                    versionNew = strDoDot + strPoDot;
                }
                else {
                    versionNew = strDoDot + '0' + strPoDot;
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
                    versionNew = strDoDot + '0' + strPoDot;
                }
            }
            return versionNew;
        }

        return undefined;
    }

    private sortByKey<T>(obj: Record<string, T>): Partial<Device> {
        const sortedEntries = Object.entries(obj).sort(([keyA], [keyB]) =>
            keyA.localeCompare(keyB)
        );

        return Object.fromEntries(new Map(sortedEntries));
    }
}