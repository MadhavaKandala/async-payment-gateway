const crypto = require('crypto');

const generateId = (prefix) => {
    return `${prefix}${crypto.randomBytes(8).toString('hex')}`; // 16 chars hex
};

module.exports = {
    generateId,
};
