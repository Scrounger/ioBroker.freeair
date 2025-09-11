// This file extends the AdapterConfig type from "@types/iobroker"
import { myIob } from './myIob.js'

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			port: number;
			adapterAddress: string;
			aliveCheckInterval: number;
			devices: { serialNo: string, password: string }[];
			statesIsWhiteList: boolean;
			statesBlackList: { id: string }[];
		}

		interface myAdapter extends ioBroker.Adapter {
			myIob: myIob;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export { };