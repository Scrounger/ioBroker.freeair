// This file extends the AdapterConfig type from "@types/iobroker"

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
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export { };