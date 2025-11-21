/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const functions = require('firebase-functions');
const logger = require("firebase-functions/logger");
const path = require('path'); 
const app = require("./app")

setGlobalOptions({ maxInstances: 10 });


exports.app = functions.https.onRequest(app);
