import Server from './Server.js';

import getBytesFromHex from 'jooby-codec/utils/getBytesFromHex.js';
import getBase64FromBytes from 'jooby-codec/utils/getBase64FromBytes.js';


const RESULT_LIMIT = 100;

// unique id for each device for sendMessage
const downlinkCounters = new Map();

const defaultHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
};


const getTenants = async ( {apiUrl, token} ) => {
    const url = new URL(`tenants?limit=${RESULT_LIMIT}`, apiUrl);
    const options = {
        method: 'GET',
        headers: {
            ...defaultHeaders,
            'Grpc-Metadata-Authorization': `Bearer ${token}`
        }
    };
    const response = await fetch(url.href, options);

    if ( !response.ok ) {
        throw new Error('Failed to get user tenants.');
    }

    return (await response.json()).result;
};


const getApplications = async ( tenantId, {apiUrl, token} ) => {
    const url = new URL(`applications?limit=${RESULT_LIMIT}&tenantId=${tenantId}`, apiUrl);
    const options = {
        method: 'GET',
        headers: {
            ...defaultHeaders,
            'Grpc-Metadata-Authorization': `Bearer ${token}`
        }
    };
    const response = await fetch(url.href, options);

    if ( !response.ok ) {
        throw new Error('Failed to get tenant applications.');
    }

    return (await response.json()).result;
};


const getDevices = async ( applicationId, {apiUrl, token} ) => {
    const url = new URL(`${apiUrl}devices?limit=${RESULT_LIMIT}&applicationId=${applicationId}`, apiUrl);
    const options = {
        method: 'GET',
        headers: {
            ...defaultHeaders,
            'Grpc-Metadata-Authorization': `Bearer ${token}`
        }
    };
    const response = await fetch(url.href, options);

    if ( !response.ok ) {
        throw new Error('Failed to get application devices.');
    }

    return (await response.json()).result;
};


const getDevice = async ( eui, {apiUrl, token} ) => {
    const url = new URL(`devices/${eui}`, apiUrl);
    const options = {
        method: 'GET',
        headers: {
            ...defaultHeaders,
            'Grpc-Metadata-Authorization': `Bearer ${token}`
        }
    };
    const response = await fetch(url.href, options);

    if ( !response.ok ) {
        throw new Error('Failed to get device info.');
    }

    return response.json();
};


const sendData = async ( eui, data, {nsRelayUrl} ) => {
    const url = new URL(`/chirpstack/${eui}/messages`, nsRelayUrl);
    const options = {
        method: 'POST',
        headers: {
            ...defaultHeaders
        },
        body: JSON.stringify({data})
    };
    const response = await fetch(url.href, options);

    if ( !response.ok ) {
        throw new Error('Failed to send device payload.');
    }

    return response.json();
};

const sendMessage = async ( eui, data, {apiUrl, token} ) => {
    const url = new URL(`devices/${eui}/queue`, apiUrl);
    let downlinkCounter = downlinkCounters.get(eui) || 1000;
    const options = {
        method: 'POST',
        headers: {
            ...defaultHeaders,
            'Grpc-Metadata-Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            queueItem: {
                data,
                fPort: 1,
                fCntDown: downlinkCounter++
            }
        })
    };
    const response = await fetch(url.href, options);

    downlinkCounters.set(eui, downlinkCounter);

    if ( !response.ok ) {
        throw new Error('Failed to send message to device.');
    }

    return response.json();
};


export default class ChirpStackServer extends Server {
    constructor ( config ) {
        super(config);

        this.tenants = {};
        this.applications = {};
        this.devices = {};
    }

    #mapDevice ( device, {application, tenant} ) {
        device.id = device.devEui;

        if ( !application ) {
            const cachedDevice = this.devices[device.id];

            if ( cachedDevice ) {
                application = cachedDevice.application;
                tenant = cachedDevice.tenant;
            }
        }

        this.devices[device.id] = device;
        device.application = application;
        device.tenant = tenant;

        return device;
    }

    /**
     * Get the given device info.
     */
    async getDevice ( eui ) {
        const device = await getDevice(eui, this.config);

        return this.#mapDevice(device);
    }

    /**
     * Get all available devices info.
     */
    async getDevices () {
        const tenants = await getTenants(this.config);

        for ( const tenant of tenants ) {
            const applications = await getApplications(tenant.id, this.config);

            this.tenants[tenant.id] = tenant;

            for ( const application of applications ) {
                const devices = await getDevices(application.id, this.config);

                application.tenant = tenant;
                this.applications[application.id] = application;

                for ( const device of devices ) {
                    device.application = application;
                    this.#mapDevice(device, {application, tenant});
                }
            }
        }

        return Object.values(this.devices);
    }

    /**
     * Send binary downlink payload to a device.
     *
     * @param {array} eui - device unique address list
     * @param {Uint8Array} data - binary downlink payload
     * @returns
     */
    async sendMessage ( eui, data ) {
        const base64 = getBase64FromBytes(data);

        // send to ns-relay
        await sendData(eui, base64, this.config);

        // send to chirpstack
        return sendMessage(eui, base64, this.config);
    }

    addListener ( euiList, callback ) {
        const euiString = euiList.join();
        const url = new URL(`/chirpstack/sse?eui=${euiString}`, this.config.nsRelayUrl);
        const eventSource = new EventSource(url.href);

        eventSource.onmessage = event => {
            const payload = JSON.parse(event.data);

            payload.data = getBytesFromHex(payload.data);

            callback(payload);
        };

        return eventSource;
    }
}
