/*
 * Initializes Firebase.
 */
var admin = require('firebase-admin');
var serviceAccount = require('../../umoja-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://umoja-app.firebaseio.com",
    storageBucket: "gs://umoja-app.appspot.com"
});

module.exports = {
    admin
};
