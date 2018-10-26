const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisURL = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisURL);

// For turning callback into promise
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');

    return this;
};

// Overwritting Mongoose's underlying exec function for redis cache strategy
mongoose.Query.prototype.exec = async function() {

    if (!this.useCache){
        return exec.apply(this, arguments);
    }
    
    //Generate key for redis from underying query context, and collection queried over
    const key = JSON.stringify(
        Object.assign({}, this.getQuery(), {
        collection: this.mongooseCollection.name
        })
    );

    //Do we have value for key in redis??
    const cacheValue = await client.hget(this.hashKey, key);

    if (cacheValue) {
        //const model = new this.model(JSON.parse(cacheValue));
        const doc = JSON.parse(cacheValue);

        const model = Array.isArray(doc)
        ? doc.map(d => new this.model(d))
        : new this.model(doc);
        return model;
    }

    const result = await exec.apply(this, arguments);
    client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 30);

    return result;

    // This function returns a Mongoose Model, not JSON, or JS Object
};

module.exports = {
    clearHash(hashKey){
        client.del(JSON.stringify(hashKey));
    }
}