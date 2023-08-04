import Server from './Server.js';

import getBytesFromHex from 'jooby-codec/utils/getBytesFromHex.js';
import getBase64FromBytes from 'jooby-codec/utils/getBase64FromBytes.js';

import {HIGHEST} from './constants/ttn/schedulePriorityTypes.js';


const NS_RELAY_NAMESPACE = 'ttn';

const defaultHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
};

const getHeaders = token => ({
    ...defaultHeaders,
    Authorization: `Bearer ${token}`
});

const getDevice = async ( deviceId, {apiUrl, token, appId} ) => {
    const response = await fetch(
        new URL(`applications/${appId}/devices/${deviceId}`, apiUrl),
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

const getDevices = async ( {apiUrl, token, appId} ) => {
    const response = await fetch(
        new URL(`applications/${appId}/devices`, apiUrl),
        {
            method: 'GET',
            headers: getHeaders(token)
        }
    );

    if ( !response.ok ) {
        throw new Error('Failed to get application devices.');
    }

    return (await response.json()).end_devices;
};


const sendData = async ( deviceId, data, {nsRelayUrl} ) => {
    const response = await fetch(
        new URL(`/${NS_RELAY_NAMESPACE}/${deviceId}/messages`, nsRelayUrl),
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

const sendMessage = async ( deviceId, data, {apiUrl, token, appId} ) => {
    const options = {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({
            downlinks: [{
                // session_key_id: '',
                f_port: 1,
                // f_cnt: 0,
                frm_payload: data,
                // decoded_payload: {},
                // decoded_payload_warnings: [],
                // confirmed: false,
                // class_b_c: {},
                priority: HIGHEST
                // correlation_ids: []
            }]
        })
    };
    const response = await fetch(
        new URL(`as/applications/${appId}/devices/${deviceId}/down/push`, apiUrl),
        options
    );

    if ( !response.ok ) {
        throw new Error('Failed to send message to device.');
    }

    return response.json();
};


export default class TheThingsNetworkServer extends Server {
    constructor ( config ) {
        if ( !config.appId ) {
            // extract appId if it empty, maybe delete after discuss
            config.appId = config.appUrl.split('/').pop();
        }

        super(config);

        this.devices = {};
    }

    /**
     * @example
     * ```
     * this.#mapDevice({
     *     "ids": {
     *         "device_id": "eui-001a798816012b96",
     *         "application_ids": {
     *             "application_id": "rdc-debug"
     *         },
     *         "dev_eui": "001A798816012B96",
     *         "join_eui": "0DFC74A996E234A5"
     *     },
     *     "created_at": "2023-08-03T17:02:51.585329Z",
     *     "updated_at": "2023-08-03T17:02:51.585330Z"
     * })
     * ```
     */
    #mapDevice ( device ) {
        device.id = device.ids.device_id;
        this.devices[device.id] = device;

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
        const devices = await getDevices(this.config);

        for ( const device of devices ) {
            this.devices[device.eui] = device;
            this.#mapDevice(device);
        }

        return Object.values(this.devices);
    }

    /**
     * Send binary downlink payload to a device.
     *
     * @param {string} deviceId - device id
     * @param {string} data - binary downlink payload encoded in base64
     * @returns
     */
    async sendMessage ( deviceId, data ) {
        const base64 = getBase64FromBytes(data);

        // send to ns-relay
        await sendData(deviceId, base64, this.config);

        // send to TTN
        return sendMessage(deviceId, base64, this.config);
    }

    addListener ( deviceIdList, callback ) {
        const url = new URL(`/${NS_RELAY_NAMESPACE}/sse?deviceId=${deviceIdList.join()}`, this.config.nsRelayUrl);
        const eventSource = new EventSource(url.href);

        eventSource.onmessage = event => {
            const payload = JSON.parse(event.data);

            payload.data = getBytesFromHex(payload.data);

            callback(payload);
        };

        return eventSource;
    }
}
