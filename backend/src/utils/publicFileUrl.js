// APP_URL is the browser-facing app URL (for example http://10.37.64.1/somtop).
// Never save loopback API URLs when Apache proxies requests to Node.
module.exports = (req, filePath) => {
    const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    return `${base}/${filePath.replace(/^\/+/, '')}`;
};
