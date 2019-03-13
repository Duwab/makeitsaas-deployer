const jsonFile = require('jsonfile');
const storageDir = './store/environments';
const {Service} = require('./service');

function Environment(id) {
    this.id = id;
    this.services = [];
    this.domains = [];
    this._load();
}

Environment.prototype = {
    _load: function () {
        // load stored value if existing
        try {
            let stored = this._recover();
            this.services = stored.services.map(serviceObj => new Service(serviceObj));
        } catch(e) {
            // no saved configuration
            this._persist();
        }
    },
    _getService: function(serviceId) {
        return this.services.filter(service => service.id === serviceId)[0];
    },
    _addService: function(service) {
        if(!this._getService(service.id)) {
            this.services.push(service);
            this._persist();
        } else {
            this._updateService(service);
        }
    },
    _updateService: function(service) {
        if(this._getService(service.id)) {
            this.services = this.services.map(s => {
                if(s.id === service.id) {
                    return service;
                } else {
                    return s;
                }
            });
            this._persist();
        } else {
            this._addService(service);
        }
    },
    _setDomains: function(domains) {
        this.domains = domains;
        this._persist();
    },
    _persist: function() {
        return jsonFile.writeFileSync(`${storageDir}/${this.id}.json`, this, {spaces: 2});
    },
    _recover: function() {
        return jsonFile.readFileSync(`${storageDir}/${this.id}.json`);
    }
};

module.exports = Environment;
