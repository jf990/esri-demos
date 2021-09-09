/**
 * Node.js server app used to demonstrate a server-based process for generating ArcGIS application tokens
 * and handing them out to client apps. See README for details how this app works.
 * Run this with `npm start`.
 */
const esriAppAuth = require("./auth");
const Express = require('express');
const CORS = require('cors');
const webServer = Express();
require("dotenv").config();
const port = process.env.PORT || 3080;
webServer.use(CORS());
webServer.use(Express.json());
webServer.use(Express.urlencoded({ extended: true }));

/**
 * Add some logic to the app to make sure a client calling this endpoint is authorized to do so.
 * Typical methods are to verify CORS, origin of request, and including a session_id. For example,
 * use express-session https://www.npmjs.com/package/express-session to save a session id, and
 * then make sure the client requesting the token is the same one that was assigned the matching session id.
 * @returns {boolean} True when authorized to call this endpoint.
 */
function isClientAuthorized(request) {
    // verify the correct session id is in the request.
    const nonce = request.body.nonce;
    return nonce == "1234";
};

/**
 * Define the /auth route to get a token.
 */
webServer.post('/auth', function (request, response) {
    if ( ! isClientAuthorized(request)) {
        response.send(esriAppAuth.errorResponse(403, "Unauthorized."));
        return;
    }

    const forceRefresh = (request.body.force || '0') == '1';
    esriAppAuth.getToken(forceRefresh)
    .then(function(token) {
        response.json(token);
    })
    .catch(function(error) {
        response.json(error);
    });
})
 
webServer.listen(port);
console.log("Token service is listening on port " + port);
