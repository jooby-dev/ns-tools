import Server from './Server.js';

import getBytesFromHex from 'jooby-codec/utils/getBytesFromHex.js';
import getBase64FromBytes from 'jooby-codec/utils/getBase64FromBytes.js';


const RESULT_LIMIT = 100;
const NS_RELAY_NAMESPACE = 'chirpstack';
const DEVICE_EUI_PROPERTY_NAME = 'devEui';

// unique id for each device for sendMessage
const downlinkCounters = new Map();

const defaultHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
};

const getHeaders = token => ({
    ...defaultHeaders,
    'Grpc-Metadata-Authorization': `Bearer ${token}`
});


const getTenants = async ( {apiUrl, token} ) => {
    const response = await fetch(
        new URL(`tenants?limit=${RESULT_LIMIT}`, apiUrl),
        {
            method: 'GET',
            headers: getHeaders(token)
        }
    );

    if ( !response.ok ) {
        throw new Error('Failed to get user tenants.');
    }

    return (await response.json()).result;
};


const getApplications = async ( tenantId, {apiUrl, token} ) => {
    const response = await fetch(
        new URL(`applications?limit=${RESULT_LIMIT}&tenantId=${tenantId}`, apiUrl),
        {
            method: 'GET',
            headers: getHeaders(token)
        }
    );

    if ( !response.ok ) {
        throw new Error('Failed to get tenant applications.');
    }

    return (await response.json()).result;
};


const getDevices = async ( applicationId, {apiUrl, token} ) => {
    const response = await fetch(
        new URL(`devices?limit=${RESULT_LIMIT}&applicationId=${applicationId}`, apiUrl),
        {
            method: 'GET',
            headers: getHeaders(token)
        }
    );

    if ( !response.ok ) {
        throw new Error('Failed to get application devices.');
    }

    return (await response.json()).result;
};


const getDevice = async ( eui, {apiUrl, token} ) => {
    const response = await fetch(
        new URL(`devices/${eui}`, apiUrl),
        {
            method: 'GET',
            headers: getHeaders(token)
        }
    );

    if ( !response.ok ) {
        throw new Error('Failed to get device info.');
    }

    return response.json();
};


const sendData = async ( eui, data, {nsRelayUrl} ) => {
    const response = await fetch(
        new URL(`/${NS_RELAY_NAMESPACE}/${eui}/messages`, nsRelayUrl),
        {
            method: 'POST',
            headers: {
                ...defaultHeaders
            },
            body: JSON.stringify({data})
        }
    );

    if ( !response.ok ) {
        throw new Error('Failed to send device payload.');
    }

    return response.json();
};

const sendMessage = async ( eui, data, {apiUrl, token} ) => {
    let downlinkCounter = downlinkCounters.get(eui) || 1000;
    const options = {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({
            queueItem: {
                data,
                fPort: 1,
                fCntDown: downlinkCounter++
            }
        })
    };
    const response = await fetch(new URL(`devices/${eui}/queue`, apiUrl), options);

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

    static getDeviceEui ( device ) {
        return device[DEVICE_EUI_PROPERTY_NAME];
    }

    #mapDevice ( device, options = {} ) {
        device.id = device[DEVICE_EUI_PROPERTY_NAME];
        const cachedDevice = this.devices[device.id];
        const {application, tenant} = options;

        this.devices[device.id] = device;
        device.application = application || cachedDevice?.application;
        device.tenant = tenant || cachedDevice?.tenant;

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
        const url = new URL(`/${NS_RELAY_NAMESPACE}/sse?eui=${euiString}`, this.config.nsRelayUrl);
        const eventSource = new EventSource(url.href);

        eventSource.onmessage = event => {
            const payload = JSON.parse(event.data);

            if ( payload.data ) {
                payload.data = getBytesFromHex(payload.data);
            }

            callback(payload);
        };

        return eventSource;
    }
}
