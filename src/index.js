import ChirpStackServer from './ChirpStackServer.js';
import TheThingsNetworkServer from './TheThingsNetworkServer.js';
import * as serverTypes from './constants/serverTypes.js';


export default {
    [serverTypes.CHIRPSTACK]: ChirpStackServer,
    [serverTypes.TTN]: TheThingsNetworkServer
};
