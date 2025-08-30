/*
 * Created with @iobroker/create-adapter v2.6.5
 */
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import url from 'node:url';
import _ from 'lodash';
import * as http from 'node:http';
// Adapter imports
import * as myI18n from './lib/i18n.js';
import { DataParser } from './lib/dataParser.js';
import * as myHelper from './lib/helper.js';
import * as tree from './lib/tree/index.js';
class Freeair extends utils.Adapter {
    isConnected = false;
    aliveTimeout = undefined;
    subscribedList = [];
    endpoints = {
        data: '/apps/data/blucontrol/',
        control: '/apps/data/blucontrol/control/'
    };
    commandTasks = {};
    statesList = undefined;
    constructor(options = {}) {
        super({
            ...options,
            name: 'freeair',
            useFormatDate: true,
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        const logPrefix = '[onReady]:';
        try {
            // ohne worte....
            await myI18n.init(`${utils.getAbsoluteDefaultDataDir().replace('iobroker-data/', '')}node_modules/iobroker.${this.name}/admin`, this);
            await this.initServer();
            for (const device of this.config.devices) {
                await this.createOrUpdateDevice(device.serialNo, device.serialNo, `${this.namespace}.${device.serialNo}.${tree.FreeAirDevice.get().isOnline.id}`, `${this.namespace}.${device.serialNo}.${tree.FreeAirDevice.get().hasErrors.id}`, undefined, true, true);
                await this.createOrUpdateGenericState(device.serialNo, tree.FreeAirDevice.get(), {}, this.config.statesBlackList, this.config.statesIsWhiteList, {}, {}, true);
            }
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback
     */
    onUnload(callback) {
        try {
            this.clearTimeout(this.aliveTimeout);
            callback();
        }
        catch (e) {
            callback();
        }
    }
    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  */
    // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
    // 	if (obj) {
    // 		// The object was changed
    // 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    // 	} else {
    // 		// The object was deleted
    // 		this.log.info(`object ${id} deleted`);
    // 	}
    // }
    /**
     * Is called if a subscribed state changes
     *
     * @param id
     * @param state
     */
    async onStateChange(id, state) {
        const logPrefix = '[onStateChange]:';
        try {
            if (state && !state.ack) {
                if (state.from.includes(this.namespace)) {
                    //internal changes
                }
                else {
                    // external changes
                    const serialNo = myHelper.getIdLastPart(myHelper.getIdWithoutLastPart(id));
                    const comfortLevel = await this.getStateAsync(`${myHelper.getIdWithoutLastPart(id)}.comfortLevel`);
                    const operatingMode = await this.getStateAsync(`${myHelper.getIdWithoutLastPart(id)}.operatingMode`);
                    this.commandTasks[serialNo] = {
                        comfortLevel: comfortLevel.val,
                        operatingMode: operatingMode.val
                    };
                    this.log.info(`${logPrefix} command added to task list (${serialNo}: ${JSON.stringify(this.commandTasks[serialNo])})`);
                }
            }
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
    }
    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  */
    onMessage(obj) {
        const logPrefix = '[onMessage]:';
        try {
            if (typeof obj === 'object') {
                if (obj.command === 'stateList') {
                    if (this.statesList === undefined) {
                        const states = tree.FreeAirDevice.getStateIDs();
                        this.statesList = [];
                        if (states) {
                            for (let i = 0; i <= states.length - 1; i++) {
                                if (states[i + 1] && states[i] === myHelper.getIdWithoutLastPart(states[i + 1])) {
                                    this.statesList.push({
                                        label: `[Channel]\t ${states[i]}`,
                                        value: states[i],
                                    });
                                }
                                else {
                                    this.statesList.push({
                                        label: `[State]\t\t ${states[i]}`,
                                        value: states[i],
                                    });
                                }
                            }
                        }
                        this.statesList = _.orderBy(this.statesList, ['value'], ['asc']);
                    }
                    this.sendTo(obj.from, obj.command, this.statesList, obj.callback);
                }
            }
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}, obj: ${JSON.stringify(obj)}`);
        }
    }
    async initServer() {
        const logPrefix = '[initServer]:';
        try {
            const server = http.createServer(async (req, res) => {
                try {
                    await this.messageHandler(req, res);
                }
                catch (err) {
                    this.log.error(`${logPrefix} error in messageHandler: ${err}, stack: ${err.stack}`);
                    this.sendResponse(res, 400, 'Internal Server Error', logPrefix);
                }
            });
            server.listen(this.config.port, async () => {
                this.log.info(`${logPrefix} listening on port: ${this.config.port}`);
                await this.setConnectionStatus(true);
            });
            server.on('error', async (err) => {
                this.log.error(`${logPrefix} server error: ${err}`);
                await this.setConnectionStatus(false);
            });
            // Alive-Checker starten
            this.aliveTimeout = this.setTimeout(async () => {
                await this.aliveChecker();
            }, this.config.aliveCheckInterval * 1000);
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
            await this.setConnectionStatus(false);
        }
    }
    async messageHandler(req, res) {
        const logPrefix = '[messageHandler]:';
        try {
            const data = {
                method: req.method,
                url: req.url,
                headers: req.headers,
            };
            const url = data.url.split("?")[0];
            const params = new URLSearchParams(data.url.split("?")[1]);
            const s_value = params.get("s");
            const b_value = params.get("b");
            const parts = s_value.split('y');
            const version = parts[1];
            const serialNo = parts[0].split('x')[2];
            const timestamp = Date.now();
            if (serialNo) {
                this.log.debug(`${logPrefix} url: ${url}, s: ${s_value}, b: ${b_value}, version: ${version.replace(/x/g, '.')}, serialNo: ${serialNo}`);
                const deviceCred = this.config.devices.filter(x => x.serialNo === serialNo);
                if (deviceCred && deviceCred.length === 1) {
                    if (url === this.endpoints.data) {
                        // receiving data from device
                        await this.setDeviceConnectionStatus(serialNo, true);
                        const encryptedData = this.base64UrlDecode(b_value);
                        const dataParser = new DataParser(this, serialNo);
                        const result = dataParser.parseData(encryptedData, timestamp, version, deviceCred[0].password);
                        if (result) {
                            await this.updateDevice(serialNo, result);
                            this.sendResponse(res, 200, 'OK', logPrefix);
                        }
                        else {
                            this.log.error(`${logPrefix} result is '${JSON.stringify(result)}'`);
                            this.sendResponse(res, 400, 'Bad Request', logPrefix);
                        }
                    }
                    else if (url === this.endpoints.control) {
                        // receiving control request from device -> here we can answer with control commands
                        // const encoder = new TextEncoder();
                        // const uint8 = encoder.encode(b_value);
                        // const dataParser = new DataParser(this, serialNo);
                        // const result = dataParser.parseControl(uint8, timestamp, version, deviceCred[0].password);
                        await this.setDeviceConnectionStatus(serialNo, true);
                        this.sendResponse(res, 200, 'OK', logPrefix);
                        // ToDo: implementation of Control Handler
                        if (this.commandTasks[serialNo]) {
                            // res.writeHead(200, { 'Content-Type': 'text/plain' });
                            // res.end(`heart__beat11${this.commandTasks[serialNo].comfortLevel}${this.commandTasks[serialNo].operatingMode}\n`);
                            this.log.info(`${logPrefix} command sent to device '${serialNo}' (${JSON.stringify(this.commandTasks[serialNo])})`);
                            delete this.commandTasks[serialNo];
                        }
                    }
                    else {
                        this.log.error(`${logPrefix} endpoint '${url}' is unknown!`);
                        this.sendResponse(res, 200, 'OK', logPrefix);
                    }
                }
                else {
                    this.log.warn(`${logPrefix} device '${serialNo}' credential missing -> skip device`);
                    this.sendResponse(res, 200, 'OK', logPrefix);
                }
            }
            else {
                this.log.warn(`device serial number in message missing (code: ${res.statusCode})`);
                this.sendResponse(res, 400, 'Bad Request', logPrefix);
            }
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
            this.sendResponse(res, 400, 'Bad Request', logPrefix);
        }
    }
    sendResponse(res, statusCode, message, logPrefix) {
        res.statusCode = statusCode;
        res.end(message);
        this.log.debug(`${logPrefix} connection to freeair 100 closed (code: ${res.statusCode}, message: ${message})`);
    }
    async updateDevice(serialNo, data) {
        const logPrefix = `[updateDevice]:  ${serialNo} - `;
        try {
            this.log.debug(`${logPrefix} ${JSON.stringify(data)}`);
            await this.createOrUpdateGenericState(serialNo, tree.FreeAirDevice.get(), data, this.config.statesBlackList, this.config.statesIsWhiteList, data, data, true);
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
    }
    /**
     * create or update a channel object, update will only be done on adapter start
     *
     * @param id
     * @param name
     * @param icon
     * @param isAdapterStart
     */
    async createOrUpdateChannel(id, name, icon = undefined, isAdapterStart = false) {
        const logPrefix = '[createOrUpdateChannel]:';
        try {
            const i18n = name ? myI18n.getTranslatedObject(name) : name;
            const common = {
                name: name && Object.keys(i18n).length > 1 ? i18n : name,
                icon: icon
            };
            if (!await this.objectExists(id)) {
                this.log.debug(`${logPrefix} creating channel '${id}'`);
                await this.setObjectAsync(id, {
                    type: 'channel',
                    common: common,
                    native: {}
                });
            }
            else {
                if (isAdapterStart) {
                    const obj = await this.getObjectAsync(id);
                    if (obj && obj.common) {
                        if (!myHelper.isChannelCommonEqual(obj.common, common)) {
                            await this.extendObject(id, { common: common });
                            const diff = myHelper.deepDiffBetweenObjects(common, obj.common, this);
                            if (diff && diff.icon) {
                                diff.icon = _.truncate(diff.icon); // reduce base64 image string for logging
                            }
                            this.log.debug(`${logPrefix} channel updated '${id}' (updated properties: ${JSON.stringify(diff)})`);
                        }
                    }
                }
            }
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
    }
    /**
     * create or update a device object, update will only be done on adapter start
     *
     * @param id
     * @param name
     * @param onlineId
     * @param errorId
     * @param icon
     * @param isAdapterStart
     * @param logChanges
     */
    async createOrUpdateDevice(id, name, onlineId, errorId = undefined, icon = undefined, isAdapterStart = false, logChanges = true) {
        const logPrefix = '[createOrUpdateDevice]:';
        try {
            const i18n = name ? myI18n.getTranslatedObject(name) : name;
            const common = {
                name: name && Object.keys(i18n).length > 1 ? i18n : name,
                icon: icon
            };
            if (onlineId) {
                common.statusStates = {
                    onlineId: onlineId
                };
            }
            if (errorId) {
                common.statusStates.errorId = errorId;
            }
            if (!await this.objectExists(id)) {
                this.log.debug(`${logPrefix} creating device '${id}'`);
                await this.setObject(id, {
                    type: 'device',
                    common: common,
                    native: {}
                });
            }
            else {
                if (isAdapterStart) {
                    const obj = await this.getObjectAsync(id);
                    if (obj && obj.common) {
                        if (!myHelper.isDeviceCommonEqual(obj.common, common)) {
                            await this.extendObject(id, { common: common });
                            const diff = myHelper.deepDiffBetweenObjects(common, obj.common, this);
                            if (diff && diff.icon) {
                                diff.icon = _.truncate(diff.icon); // reduce base64 image string for logging
                            }
                            this.log.debug(`${logPrefix} device updated '${id}' ${logChanges ? `(updated properties: ${JSON.stringify(diff)})` : ''}`);
                        }
                    }
                }
            }
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
    }
    async createOrUpdateGenericState(channel, treeDefinition, objValues, blacklistFilter, isWhiteList, objDevices, objChannel, isAdapterStart = false, filterId = '', isChannelOnWhitelist = false) {
        const logPrefix = '[createOrUpdateGenericState]:';
        try {
            for (const key in treeDefinition) {
                let logMsgState = `${channel}.${key}`.split('.')?.slice(1)?.join('.');
                const logDetails = `${(objDevices)?.mac ? `mac: ${(objDevices)?.mac}` : (objDevices)?.ip ? `ip: ${(objDevices)?.ip}` : (objDevices)?._id ? `id: ${(objDevices)?._id}` : ''}`;
                try {
                    // if we have an own defined state which takes val from other property
                    const valKey = Object.hasOwn(objValues, treeDefinition[key].valFromProperty) && treeDefinition[key].valFromProperty ? treeDefinition[key].valFromProperty : key;
                    const cond1 = (Object.hasOwn(objValues, valKey) && objValues[valKey] !== undefined) || (Object.hasOwn(treeDefinition[key], 'id') && !Object.hasOwn(treeDefinition[key], 'valFromProperty'));
                    const cond2 = Object.hasOwn(treeDefinition[key], 'iobType') && !Object.hasOwn(treeDefinition[key], 'object') && !Object.hasOwn(treeDefinition[key], 'array');
                    const cond3 = (Object.hasOwn(treeDefinition[key], 'conditionToCreateState') && treeDefinition[key].conditionToCreateState(objChannel, this) === true) || !Object.hasOwn(treeDefinition[key], 'conditionToCreateState');
                    // if (channel === 'devices.f4:e2:c6:55:55:e2' && (key === 'satisfaction' || valKey === 'satisfaction')) {
                    // 	this.log.warn(`cond 1: ${cond1}`);
                    // 	this.log.warn(`cond 2: ${cond2}`);
                    // 	this.log.warn(`cond 3: ${cond3}`)
                    // 	this.log.warn(`val: ${objValues[valKey]}`);
                    // }
                    if (key && cond1 && cond2 && cond3) {
                        // if we have a 'iobType' property, then it's a state
                        let stateId = key;
                        if (Object.hasOwn(treeDefinition[key], 'id')) {
                            // if we have a custom state, use defined id
                            stateId = treeDefinition[key].id;
                        }
                        logMsgState = `${channel}.${stateId}`.split('.')?.slice(1)?.join('.');
                        if ((!isWhiteList && !_.some(blacklistFilter, { id: `${filterId}${stateId}` })) || (isWhiteList && _.some(blacklistFilter, { id: `${filterId}${stateId}` })) || isChannelOnWhitelist || Object.hasOwn(treeDefinition[key], 'required')) {
                            if (!await this.objectExists(`${channel}.${stateId}`)) {
                                // create State
                                this.log.silly(`${logPrefix} ${objDevices?.name} - creating state '${logMsgState}'`);
                                const obj = {
                                    type: 'state',
                                    common: await this.getCommonGenericState(key, treeDefinition, objDevices, logMsgState),
                                    native: {}
                                };
                                // @ts-ignore
                                await this.setObjectAsync(`${channel}.${stateId}`, obj);
                            }
                            else {
                                // update State if needed (only on adapter start)
                                if (isAdapterStart) {
                                    const obj = await this.getObjectAsync(`${channel}.${stateId}`);
                                    const commonUpdated = await this.getCommonGenericState(key, treeDefinition, objDevices, logMsgState);
                                    if (obj && obj.common) {
                                        if (!myHelper.isStateCommonEqual(obj.common, commonUpdated)) {
                                            await this.extendObject(`${channel}.${stateId}`, { common: commonUpdated });
                                            this.log.debug(`${logPrefix} ${objDevices?.name} - updated common properties of state '${logMsgState}' (updated properties: ${JSON.stringify(myHelper.deepDiffBetweenObjects(commonUpdated, obj.common, this))})`);
                                        }
                                    }
                                }
                            }
                            if (!this.subscribedList.includes(`${channel}.${stateId}`) && ((treeDefinition[key].write && treeDefinition[key].write === true) || Object.hasOwn(treeDefinition[key], 'subscribeMe'))) {
                                // state is writeable or has subscribeMe Property -> subscribe it
                                this.log.silly(`${logPrefix} ${objDevices?.name} - subscribing state '${logMsgState}'`);
                                await this.subscribeStatesAsync(`${channel}.${stateId}`);
                                this.subscribedList.push(`${channel}.${stateId}`);
                            }
                            if (objValues && (Object.hasOwn(objValues, key) || (Object.hasOwn(objValues, treeDefinition[key].valFromProperty)))) {
                                const val = treeDefinition[key].readVal ? await treeDefinition[key].readVal(objValues[valKey], this, objDevices, `${channel}.${stateId}`) : objValues[valKey];
                                let changedObj = undefined;
                                if (key === 'last_seen' || key === 'first_seen' || key === 'rundate') {
                                    // set lc to last_seen value
                                    changedObj = await this.setStateChangedAsync(`${channel}.${stateId}`, { val: val, lc: val * 1000 }, true);
                                }
                                else {
                                    changedObj = await this.setStateChangedAsync(`${channel}.${stateId}`, val, true);
                                }
                                if (!isAdapterStart && changedObj && Object.hasOwn(changedObj, 'notChanged') && !changedObj.notChanged) {
                                    this.log.silly(`${logPrefix} value of state '${logMsgState}' changed to ${val}`);
                                }
                            }
                            else {
                                if (!Object.hasOwn(treeDefinition[key], 'id')) {
                                    // only report it if it's not a custom defined state
                                    this.log.debug(`${logPrefix} ${objDevices?.name} - property '${logMsgState}' not exists in bootstrap values (sometimes this option may first need to be activated / used in the Unifi Network application or will update by an event)`);
                                }
                            }
                        }
                        else {
                            // channel is on blacklist
                            // delete also at runtime, because some properties are only available on websocket data
                            if (await this.objectExists(`${channel}.${stateId}`)) {
                                await this.delObjectAsync(`${channel}.${stateId}`);
                                this.log.info(`${logPrefix} ${logDetails ? `(${logDetails}) ` : ''}state '${channel}.${stateId}' delete, ${isWhiteList ? 'it\'s not on the whitelist' : 'it\'s on the blacklist'}`);
                            }
                        }
                    }
                    else {
                        // it's a channel from type object
                        if (Object.hasOwn(treeDefinition[key], 'object') && Object.hasOwn(objValues, key)) {
                            const idChannelAppendix = Object.hasOwn(treeDefinition[key], 'idChannel') ? treeDefinition[key].idChannel : key;
                            const idChannel = `${channel}.${idChannelAppendix}`;
                            if ((!isWhiteList && !_.some(blacklistFilter, { id: `${filterId}${idChannelAppendix}` })) || (isWhiteList && _.some(blacklistFilter, (x) => x.id.startsWith(`${filterId}${idChannelAppendix}`))) || Object.hasOwn(treeDefinition[key], 'required')) {
                                await this.createOrUpdateChannel(`${idChannel}`, Object.hasOwn(treeDefinition[key], 'channelName') ? treeDefinition[key].channelName(objDevices, objChannel, this) : key, Object.hasOwn(treeDefinition[key], 'icon') ? treeDefinition[key].icon : undefined, true);
                                await this.createOrUpdateGenericState(`${idChannel}`, treeDefinition[key].object, objValues[key], blacklistFilter, isWhiteList, objDevices, objChannel[key], isAdapterStart, `${filterId}${idChannelAppendix}.`, isWhiteList && _.some(blacklistFilter, { id: `${filterId}${idChannelAppendix}` }));
                            }
                            else {
                                // channel is on blacklist
                                if (await this.objectExists(idChannel)) {
                                    await this.delObjectAsync(idChannel, { recursive: true });
                                    this.log.info(`${logPrefix} ${logDetails ? `(${logDetails}) ` : ''}channel '${idChannel}' delete, ${isWhiteList ? 'it\'s not on the whitelist' : 'it\'s on the blacklist'}`);
                                }
                            }
                        }
                        // it's a channel from type array
                        if (Object.hasOwn(treeDefinition[key], 'array') && Object.hasOwn(objValues, key)) {
                            if (objValues[key] !== null && objValues[key].length > 0) {
                                const idChannelAppendix = Object.hasOwn(treeDefinition[key], 'idChannel') ? treeDefinition[key].idChannel : key;
                                const idChannel = `${channel}.${idChannelAppendix}`;
                                if ((!isWhiteList && !_.some(blacklistFilter, { id: `${filterId}${idChannelAppendix}` })) || (isWhiteList && _.some(blacklistFilter, (x) => x.id.startsWith(`${filterId}${idChannelAppendix}`))) || Object.hasOwn(treeDefinition[key], 'required')) {
                                    await this.createOrUpdateChannel(`${idChannel}`, Object.hasOwn(treeDefinition[key], 'channelName') ? treeDefinition[key].channelName(objDevices, objChannel, this) : key, Object.hasOwn(treeDefinition[key], 'icon') ? treeDefinition[key].icon : undefined, isAdapterStart);
                                    const arrayNumberAdd = Object.hasOwn(treeDefinition[key], 'arrayStartNumber') ? treeDefinition[key].arrayStartNumber : 0;
                                    for (let i = 0; i <= objValues[key].length - 1; i++) {
                                        const nr = i + arrayNumberAdd;
                                        if (objValues[key][i] !== null && objValues[key][i] !== undefined) {
                                            let idChannelArray = myHelper.zeroPad(nr, treeDefinition[key].arrayChannelIdZeroPad || 0);
                                            if (Object.hasOwn(treeDefinition[key], 'arrayChannelIdFromProperty')) {
                                                idChannelArray = treeDefinition[key].arrayChannelIdFromProperty(objChannel[key][i], i, this);
                                            }
                                            else if (Object.hasOwn(treeDefinition[key], 'arrayChannelIdPrefix')) {
                                                idChannelArray = treeDefinition[key].arrayChannelIdPrefix + myHelper.zeroPad(nr, treeDefinition[key].arrayChannelIdZeroPad || 0);
                                            }
                                            if (idChannelArray !== undefined) {
                                                await this.createOrUpdateChannel(`${idChannel}.${idChannelArray}`, Object.hasOwn(treeDefinition[key], 'arrayChannelNameFromProperty') ? treeDefinition[key].arrayChannelNameFromProperty(objChannel[key][i], this) : treeDefinition[key].arrayChannelNamePrefix + nr || nr.toString(), undefined, true);
                                                await this.createOrUpdateGenericState(`${idChannel}.${idChannelArray}`, treeDefinition[key].array, objValues[key][i], blacklistFilter, isWhiteList, objDevices, objChannel[key][i], true, `${filterId}${idChannelAppendix}.`, isWhiteList && _.some(blacklistFilter, { id: `${filterId}${idChannelAppendix}` }));
                                            }
                                        }
                                    }
                                }
                                else {
                                    // channel is on blacklist, wlan is comming from realtime api
                                    if (await this.objectExists(idChannel)) {
                                        await this.delObjectAsync(idChannel, { recursive: true });
                                        this.log.info(`${logPrefix} ${logDetails ? `(${logDetails}) ` : ''}channel '${idChannel}' delete, ${isWhiteList ? 'it\'s not on the whitelist' : 'it\'s on the blacklist'}`);
                                    }
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    this.log.error(`${logPrefix} [id: ${key}, ${logDetails ? `${logDetails}, ` : ''}key: ${key}] error: ${error}, stack: ${error.stack}, data: ${JSON.stringify(objValues[key])}`);
                }
            }
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
    }
    getCommonGenericState(id, treeDefinition, objDevices, logMsgState) {
        const logPrefix = '[getCommonGenericState]:';
        try {
            // i18x translation if exists
            const i18n = myI18n.getTranslatedObject(treeDefinition[id].name || id);
            const name = Object.keys(i18n).length > 1 ? i18n : (treeDefinition[id].name || id);
            const common = {
                name: name,
                type: treeDefinition[id].iobType,
                read: (treeDefinition[id].read !== undefined) ? treeDefinition[id].read : true,
                write: (treeDefinition[id].write !== undefined) ? treeDefinition[id].write : false,
                role: treeDefinition[id].role ? treeDefinition[id].role : 'state',
            };
            if (treeDefinition[id].unit) {
                common.unit = treeDefinition[id].unit;
            }
            if (treeDefinition[id].min || treeDefinition[id].min === 0) {
                common.min = treeDefinition[id].min;
            }
            if (treeDefinition[id].max || treeDefinition[id].max === 0) {
                common.max = treeDefinition[id].max;
            }
            if (treeDefinition[id].step) {
                common.step = treeDefinition[id].step;
            }
            if (treeDefinition[id].expert) {
                common.expert = treeDefinition[id].expert;
            }
            if (treeDefinition[id].def || treeDefinition[id].def === 0 || treeDefinition[id].def === false) {
                common.def = treeDefinition[id].def;
            }
            if (treeDefinition[id].states) {
                common.states = treeDefinition[id].states;
            }
            else if (Object.hasOwn(treeDefinition[id], 'statesFromProperty')) {
                const statesFromProp = myHelper.getAllowedCommonStates(treeDefinition[id].statesFromProperty, objDevices);
                common.states = statesFromProp;
                this.log.debug(`${logPrefix} ${objDevices?.name} - set allowed common.states for '${logMsgState}' (from: ${treeDefinition[id].statesFromProperty})`);
            }
            if (treeDefinition[id].desc) {
                common.desc = treeDefinition[id].desc;
            }
            return common;
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
        return undefined;
    }
    base64UrlDecode(bValue) {
        let base64 = bValue.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4 !== 0) {
            base64 += "=";
        }
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    /**
     * Set adapter info.connection state and internal var
     *
     * @param isConnected
     */
    async setConnectionStatus(isConnected) {
        const logPrefix = '[setConnectionStatus]:';
        try {
            this.isConnected = isConnected;
            await this.setState('info.connection', isConnected, true);
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
        }
    }
    /**
     * set isOnline state for every device
     *
     * @param serialNo
     * @param isConnected
     */
    async setDeviceConnectionStatus(serialNo, isConnected) {
        const logPrefix = '[setDeviceConnectionStatus]:';
        try {
            this.isConnected = isConnected;
            await this.setState(`${serialNo}.${tree.FreeAirDevice.get().isOnline.id}`, isConnected, true);
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack} `);
        }
    }
    /**
     Check whether the connection to FreeAir 100 exists
    */
    async aliveChecker() {
        const logPrefix = '[aliveChecker]:';
        try {
            const isOnlineList = await this.getStatesAsync(`*.${tree.FreeAirDevice.get().isOnline.id}`);
            for (const id in isOnlineList) {
                if (Date.now() - isOnlineList[id].ts > (this.config.aliveCheckInterval) * 1000) {
                    const serialNo = myHelper.getIdLastPart(myHelper.getIdWithoutLastPart(id));
                    this.log.error(`${logPrefix} ${serialNo} - no data was sent from FreeAir 100 since ${this.config.aliveCheckInterval} s!`);
                    await this.setDeviceConnectionStatus(serialNo, false);
                }
                this.clearTimeout(this.aliveTimeout);
                this.aliveTimeout = this.setTimeout(async () => {
                    await this.aliveChecker();
                }, (this.config.aliveCheckInterval) * 1000);
            }
        }
        catch (error) {
            this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack} `);
        }
    }
}
// replace only needed for dev system
const modulePath = url.fileURLToPath(import.meta.url).replace('/development/', '/node_modules/');
if (process.argv[1] === modulePath) {
    // start the instance directly
    new Freeair();
}
export default function startAdapter(options) {
    // compact mode
    return new Freeair(options);
}
