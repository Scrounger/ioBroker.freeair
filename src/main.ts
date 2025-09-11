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
import type { JsonConfigAutocompleteSendTo, myTreeState } from './lib/myTypes.js';
import { DataParser } from './lib/dataParser.js';
import type { Device, DeviceControl } from './lib/types-device.js';
import * as myHelper from './lib/helper.js';
import * as tree from './lib/tree/index.js'
import { myIob } from './lib/myIob.js';

class Freeair extends utils.Adapter {

	myIob: myIob;

	aliveTimeout: ioBroker.Timeout | undefined = undefined;

	subscribedList: string[] = [];

	endpoints = {
		data: '/apps/data/blucontrol/',
		control: '/apps/data/blucontrol/control/'
	}

	commandTasks: { [serialNo: string]: DeviceControl } = {}

	statesList: JsonConfigAutocompleteSendTo[] = undefined;

	statesUsingValAsLastChanged = [          // id of states where lc is taken from the value
		'timestamp'
	];

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
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
	private async onReady(): Promise<void> {
		const logPrefix = '[onReady]:';

		try {
			this.connected = false;

			await utils.I18n.init(`${utils.getAbsoluteDefaultDataDir().replace('iobroker-data/', '')}node_modules/iobroker.${this.name}/admin`, this);

			this.myIob = new myIob(this, utils, this.statesUsingValAsLastChanged);

			if (this.config.aliveCheckInterval >= 60 && this.config.aliveCheckInterval <= 7200) {
				await this.initServer();
			} else {
				this.log.error(`${logPrefix} alive check interval not correct!`);
				await this.stop({ reason: 'alive check interval not correct' });
			}

			this.myIob.findMissingTranslation();

		} catch (error: any) {
			this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param callback
	 */
	private async onUnload(callback: () => void): Promise<void> {
		try {
			this.clearTimeout(this.aliveTimeout);

			for (const device of this.config.devices) {
				await this.setDeviceConnectionStatus(device.serialNo, false);
			}

			callback();
		} catch (e) {
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
	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		const logPrefix = '[onStateChange]:';

		try {
			if (state && !state.ack) {
				if (state.from.includes(this.namespace)) {
					//internal changes

				} else {
					// external changes
					const serialNo = myHelper.getIdLastPart(myHelper.getIdWithoutLastPart(id));

					const comfortLevel = await this.getStateAsync(`${myHelper.getIdWithoutLastPart(id)}.comfortLevel`);
					const operatingMode = await this.getStateAsync(`${myHelper.getIdWithoutLastPart(id)}.operatingMode`);

					this.commandTasks[serialNo] = {
						comfortLevel: comfortLevel.val as number,
						operatingMode: operatingMode.val as number
					};

					this.log.info(`${logPrefix} command added to task list (${serialNo}: ${JSON.stringify(this.commandTasks[serialNo])})`);
				}
			}

		} catch (error) {
			this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  */
	private onMessage(obj: ioBroker.Message): void {
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
								} else {
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
		} catch (error) {
			this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}, obj: ${JSON.stringify(obj)}`);
		}
	}

	private async initServer(): Promise<void> {
		const logPrefix = '[initServer]:';

		try {
			const server = http.createServer(async (req, res) => {
				try {
					await this.messageHandler(req, res);

				} catch (err: any) {
					this.log.error(`${logPrefix} error in messageHandler: ${err}, stack: ${err.stack}`);
					this.sendResponse(res, 400, 'Internal Server Error', logPrefix);
				}
			});

			server.listen(this.config.port, async () => {
				this.log.info(`${logPrefix} listening on port: ${this.config.port}`);
				await this.setConnectionStatus(true);

				for (const device of this.config.devices) {
					await this.myIob.createOrUpdateDevice(device.serialNo, device.serialNo, `${this.namespace}.${device.serialNo}.${(tree.FreeAirDevice.get().isOnline as myTreeState).id}`, `${this.namespace}.${device.serialNo}.${(tree.FreeAirDevice.get().hasErrors as myTreeState).id}`, undefined, true, true);
					await this.myIob.createOrUpdateStates(device.serialNo, tree.FreeAirDevice.get(), { isOnline: false }, { isOnline: false }, this.config.statesBlackList, this.config.statesIsWhiteList, device.serialNo, true);

					await this.setState(`${device.serialNo}.isOnline`, false, true);
				}
			});

			server.on('error', async (err) => {
				this.log.error(`${logPrefix} server error: ${err}`);
				await this.setConnectionStatus(false);
			});

			// Alive-Checker starten
			this.aliveTimeout = this.setTimeout(async () => {
				await this.aliveChecker();
			}, this.config.aliveCheckInterval * 1000);

		} catch (error: any) {
			this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
			await this.setConnectionStatus(false);
		}
	}

	private async messageHandler(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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
						} else {
							this.log.error(`${logPrefix} result is '${JSON.stringify(result)}'`);
							this.sendResponse(res, 400, 'Bad Request', logPrefix);
						}
					} else if (url === this.endpoints.control) {
						// receiving control request from device -> here we can answer with control commands
						// ack will only be set when the next data arrive

						await this.setDeviceConnectionStatus(serialNo, true);

						if (this.commandTasks[serialNo]) {

							res.writeHead(200, { 'Content-Type': 'text/plain' });
							res.end(`heart__beat11${this.commandTasks[serialNo].comfortLevel}${this.commandTasks[serialNo].operatingMode}\n`);

							this.log.info(`${logPrefix} command sent to device '${serialNo}' (${JSON.stringify(this.commandTasks[serialNo])})`);

							delete this.commandTasks[serialNo];
						} else {
							this.sendResponse(res, 200, 'OK', logPrefix);
						}
					} else {
						this.log.error(`${logPrefix} endpoint '${url}' is unknown!`);
						this.sendResponse(res, 200, 'OK', logPrefix);
					}
				} else {
					this.log.warn(`${logPrefix} device '${serialNo}' credential missing -> skip device`);
					this.sendResponse(res, 200, 'OK', logPrefix);
				}
			} else {
				this.log.warn(`device serial number in message missing (code: ${res.statusCode})`);
				this.sendResponse(res, 400, 'Bad Request', logPrefix);
			}
		} catch (error: any) {
			this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
			this.sendResponse(res, 400, 'Bad Request', logPrefix);
		}
	}

	private sendResponse(res: http.ServerResponse, statusCode: number, message: string, logPrefix: string): void {
		res.statusCode = statusCode;
		res.end(message);

		this.log.debug(`${logPrefix} connection to freeair 100 closed (code: ${res.statusCode}, message: ${message})`);
	}

	private async updateDevice(serialNo: string, data: Device): Promise<void> {
		const logPrefix = `[updateDevice]:  ${serialNo} - `;

		try {
			this.log.debug(`${logPrefix} ${JSON.stringify(data)}`);
			await this.myIob.createOrUpdateStates(serialNo, tree.FreeAirDevice.get(), data, data, this.config.statesBlackList, this.config.statesIsWhiteList, serialNo, true);

		} catch (error: any) {
			this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
		}
	}

	private base64UrlDecode(bValue: string): Uint8Array {
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
	async setConnectionStatus(isConnected: boolean): Promise<void> {
		const logPrefix = '[setConnectionStatus]:';

		try {
			await this.setState('info.connection', isConnected, true);
			this.connected = isConnected;
		} catch (error) {
			this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack}`);
		}
	}

	/**
	 * set isOnline state for every device
	 *
	 * @param serialNo
	 * @param isConnected
	 */
	async setDeviceConnectionStatus(serialNo: string, isConnected: boolean): Promise<void> {
		const logPrefix = '[setDeviceConnectionStatus]:';

		try {
			await this.setState(`${serialNo}.${(tree.FreeAirDevice.get().isOnline as myTreeState).id}`, isConnected, true);
		} catch (error) {
			this.log.error(`${logPrefix} error: ${error}, stack: ${error.stack} `);
		}
	}

	/**
	 Check whether the connection to FreeAir 100 exists
	*/
	private async aliveChecker(): Promise<void> {
		const logPrefix = '[aliveChecker]:';

		try {
			const isOnlineList = await this.getStatesAsync(`*.${(tree.FreeAirDevice.get().isOnline as myTreeState).id}`);

			for (const id in isOnlineList) {
				if (Date.now() - isOnlineList[id].ts >= (this.config.aliveCheckInterval) * 1000) {
					const serialNo = myHelper.getIdLastPart(myHelper.getIdWithoutLastPart(id));

					if (isOnlineList[id].val) {
						this.log.warn(`${logPrefix} '${serialNo}' seems to be offline - no data was sent from FreeAir 100 since ${this.config.aliveCheckInterval} s!`);
					}

					this.log.debug(`${logPrefix} '${serialNo}' seems to be offline - no data was sent from FreeAir 100 since ${this.config.aliveCheckInterval} s!`);

					await this.setDeviceConnectionStatus(serialNo, false);
				}

				this.clearTimeout(this.aliveTimeout);

				this.aliveTimeout = this.setTimeout(async () => {
					await this.aliveChecker();
				}, (this.config.aliveCheckInterval) * 1000);
			}

		} catch (error) {
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

export default function startAdapter(options: Partial<utils.AdapterOptions> | undefined): Freeair {
	// compact mode
	return new Freeair(options);
}