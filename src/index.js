/*
 * Everything happens in this file.
 * Loads the CSV files from the data directory, defines all the routes, and performs the operations.
 */

import { admin } from './firebase-config';
import express from 'express';
import Papa from 'papaparse';
import fs from 'fs';
import moment from 'moment';

const app = express();

let status = "Reading...";
let userTableData;
let userMetaTableData;

fs.readFile(__dirname + '/../data/uo_users.csv', function (err, data) {
    if (err) {
        status = "Failed.";
        throw err;
    }

    userTableData = Papa.parse(data.toString(), { header: true });
    status = "OK";
});

fs.readFile(__dirname + '/../data/uo_usermeta.csv', function (err, data) {
    if (err) {
        status = "Failed.";
        throw err;
    }

    userMetaTableData = Papa.parse(data.toString(), { header: true });
    status = "OK";
});

app.get('/', (req, res) => res.json({ 'status': status }));

app.get('/get/:email', async (req, res) => {
    const list = userTableData.data.filter(d => d.user_email === req.params.email);
    if (list.length === 0) return res.status(404).json({ 'error': 'user not found' });
    const id = list[0].ID.toString();
    res.send(userProfileData(id, req.params.email));
});

app.get('/import', async (req, res) => {
    // generate a random UUID for this user
    const uid = genUid();

    let generated = [];

    let counter = 0;

    for (let i = 0; i < userTableData.data.length; i++) {
        let data = userTableData.data[i];
        const id = data.ID.toString();

        let toImportToFirebase = userAuthData(data.user_email);

        admin.auth().importUsers([toImportToFirebase], {
            hash: {
                algorithm: 'SCRYPT',
                // All the parameters below can be obtained from the Firebase Console's users section.
                // Must be provided in a byte buffer.
                key: Buffer.from('base64-secret', 'base64'),
                saltSeparator: Buffer.from('base64SaltSeparator', 'base64'),
                rounds: 8,
                memoryCost: 14
            }
        });
        let result = userProfileData(id, data.user_email, toImportToFirebase.uid);

        admin.firestore().collection('imported').doc(data.user_email).create({ 'email': data.user_email, 'login': data.user_login });

        console.log("Imported " + result.owner + " (" + data.user_email + ")");
        generated.push(toImportToFirebase.email);
        counter++;
    }


    res.json(findDuplicates(generated));
    console.log("Generated " + counter + " users");
});

app.get('/rollback', async (req, res) => {
    deleteCollection(admin.firestore(), 'users', 100);
    deleteCollection(admin.firestore(), 'families', 100);
    const data = await admin.firestore().collection('imported').get();
    data.docs.forEach(async snapshot => {
        const email = snapshot.data().email;
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().deleteUser(user.uid);
    });
    return res.status(200);
});

app.get('/count', (req, res) => {
    admin.firestore().collection('imported').get().then(snap => {
        res.json({ 'count': snap.size })
    });
});

function deleteCollection(db, collectionPath, batchSize) {
    let collectionRef = db.collection(collectionPath);
    let query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, batchSize, resolve, reject);
    });
}

function deleteQueryBatch(db, query, batchSize, resolve, reject) {
    query.get()
        .then((snapshot) => {
            // When there are no documents left, we are done
            if (snapshot.size == 0) {
                return 0;
            }

            // Delete documents in a batch
            let batch = db.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            return batch.commit().then(() => {
                return snapshot.size;
            });
        }).then((numDeleted) => {
            if (numDeleted === 0) {
                resolve();
                return;
            }

            // Recurse on the next process tick, to avoid
            // exploding the stack.
            process.nextTick(() => {
                deleteQueryBatch(db, query, batchSize, resolve, reject);
            });
        })
        .catch(reject);
}

const findDuplicates = (arr) => {
    let sorted_arr = arr.slice().sort(); // You can define the comparing function here. 
    // JS by default uses a crappy string compare.
    // (we use slice to clone the array so the
    // original array won't be modified)
    let results = [];
    for (let i = 0; i < sorted_arr.length - 1; i++) {
        if (sorted_arr[i + 1] == sorted_arr[i]) {
            results.push(sorted_arr[i]);
        }
    }
    return results;
}

var genUid = () => '_' + Math.random().toString(36).substr(2, 9);

var userAuthData = (email) => {
    return {
        uid: genUid(),
        email: email,
        // we'll have them reset their passwords anyway, so can set this to any random string
        // just reusing genUid() since it's already random
        passwordHash: Buffer.from(genUid()),
        passwordSalt: undefined
    }
};

// finds user profile from CSV
var userProfileData = (id, email, accountId) => {
    const metaData = userMetaTableData.data.filter(d => d.user_id === id.toString());
    const metaDataDict = {};
    metaData.forEach(m => metaDataDict[m.meta_key] = m.meta_value);

    // need to assemble this into a data structure that matches the Umoja ID schema
    let profileData = {
        address: '',
        address2: '',
        birthday: '',
        centerCountry: '',
        centerName: '',
        centerRegion: '',
        city: '',
        country: '',
        email: '',
        firstName: '',
        lastName: '',
        gender: '',
        profession: '',
        state: '',
        zip: ''
    };

    profileData.address = metaDataDict['billing_address_1'] || '';
    profileData.address2 = metaDataDict['billing_address_2'] || '';
    profileData.city = metaDataDict['billing_city'] || '';
    profileData.state = metaDataDict['billing_state'] || '';
    profileData.country = metaDataDict['billing_country'] || '';
    profileData.zip = metaDataDict['billing_postcode'] || '';
    profileData.birthday = metaDataDict['user_dob'] || '';
    profileData.email = email;
    profileData.gender = metaDataDict['userGender'] || '';
    profileData.firstName = metaDataDict['first_name'] || '';
    profileData.lastName = metaDataDict['last_name'] || '';

    profileData.family = assembleFamilyData(email, metaDataDict);
    profileData.owner = accountId;

    admin.firestore().collection('users').doc(accountId).create(profileData);

    return { ...profileData };
}

var assembleFamilyData = (email, metaDataDict) => {
    const familyId = genUid();

    let childIds = [];

    for (let i = 1; i <= 10; i++) {
        let firstName = metaDataDict['child' + i + '_fname'];
        let lastName = metaDataDict['child' + i + '_lname'];
        let gender = metaDataDict['child' + i + '_gender'] || '';
        let birthday = metaDataDict['child' + i + '_dob'] || '';

        if (!firstName || !lastName) {
            continue; // can't import this...
        }

        birthday = moment(birthday).format('YYYY-MM-DD'); // need it in our own format
        if (birthday === 'Invalid date') birthday = '';

        const profileId = genUid();
        let profile = { firstName, lastName, gender, birthday, family: familyId };
        childIds.push(profileId);
        admin.firestore().collection('users').doc(profileId).create(profile);

    }

    let familyData = {
        'managers': [email],
        'members': childIds.map(c => {
            return {
                id: c,
                linked: false
            };
        })
    };

    admin.firestore().collection('families').doc(familyId).create(familyData);
    return familyId;
}

app.listen(3000, () => {
    console.log("🚀 Launched Umoja Importer server on port 3000");
});
