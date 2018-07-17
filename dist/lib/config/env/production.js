'use strict';

module.exports = {

  env: 'production',

  envFolder: 'public',

  db: {
    database: 'codeboard'
  },

  mongo: {
    uri: 'mongodb://127.0.0.1/admin'
  },

  codeboard: {
    // because we use https in production, we also need to use wss
    wsHostname: 'wss://codeboard.gast.it.uc3m.es:9000'
  },

  mantra : {
    ip: 'codeboard.gast.it.uc3m.es',
    url: 'http://codeboard.gast.it.uc3m.es',
    port: 9090
  },

  kali: {
    url: 'http://codeboard.gast.it.uc3m.es',
    port: 7070
  },

  tara: {
    url: 'http://codeboard.gast.it.uc3m.es',
    port: 9090
  }

};
