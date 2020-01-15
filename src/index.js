import { admin } from './firebase-config';
import express from 'express';
import { uuid } from 'uuidv4';

const app = express();

app.get('/', (req, res) => res.json({ 'status': 'OK' }));

app.listen(3000, () => {
    console.log("🚀 Launched Umoja Importer server on port 3000");
});
