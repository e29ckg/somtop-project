const publicFileUrl = require('./publicFileUrl');

// Existing records may contain URLs for the old API port. Keep their stored
// values intact, but return links through the current browser-facing app URL.
module.exports = (req, fileUrl) => {
    if (typeof fileUrl !== 'string') return fileUrl;

    try {
        const pathname = new URL(fileUrl, 'http://local.invalid').pathname;
        const uploadPath = pathname.match(/(?:^|\/)(uploads\/[^?#]+)$/);
        return uploadPath ? publicFileUrl(req, uploadPath[1]) : fileUrl;
    } catch (error) {
        return fileUrl;
    }
};
