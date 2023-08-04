export default class Server {
    constructor ( config ) {
        this.config = config;
    }

    getDevices () {
        throw new Error('Method not implemented');
    }

    static getDeviceEui () {
        throw new Error('Method not implemented');
    }
}
