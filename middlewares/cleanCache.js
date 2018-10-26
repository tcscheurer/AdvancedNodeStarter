const { clearCache } = require('../services/cache');

module.exports = async (req, res, next) => {
    // Little hack to let the route handler run before dumping cache
    await next();

    clearCache(req.user.id);
};