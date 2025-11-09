const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const EventEmitter = require('events');
// Swagger
const { swaggerOptions, swaggerSpec } = require("./config/swagger")
// Config
const logEvents = require('./logEvents');
require('dotenv').config();
// Controller
const telemetry = require("./controller/telemetry")
const login = require("./controller/login")


class Emitter extends EventEmitter { }
const myEmitter = new Emitter();
myEmitter.on('log', (msg, fileName) => logEvents(msg, fileName));

const app = express();
const PORT = process.env.PORT || 3500;


// Middleware to parse JSON body 
app.use(bodyParser.json());
// Middleware storage log
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    myEmitter.emit('log', `${req.url}\t${req.method}`, 'reqLog.txt');
    next();
});
// Swagger config
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Config route
telemetry(app);
login(app);

// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;