
const express = require('express');
const mysql = require('mysql');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const fhirClient = require('fhirclient');


const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());

// Enable parsing of JSON bodies
app.use(bodyParser.json());

// Create a MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Lht.3991',
    database: 'medmanage'
});

// Connect to the MySQL database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

app.post('/patient-context', (req, res) => {
    const patient = req.body;
    console.log(patient.id);

    // Create a SMART client
    const client = fhirClient(req, res);

    // Retrieve medication data from the patient
    client.patient.api.fetchAll({
        type: 'MedicationOrder', // Use 'MedicationOrder' for DSTU2
    })
    .then((medications) => {
        // Process the retrieved medication data
        console.log(medications);
        res.send('Medication data retrieved');
    })
    .catch((error) => {
        console.error('Error retrieving medication data:', error);
        res.status(500).send('Error retrieving medication data');
    });
});

