const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const projectId = 'btl-he-thong-nhung';
const region = 'us-central1';

const serverUrl = `http://localhost:5001/${projectId}/${region}/app`;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Farm Backend API',
      version: '1.0.0',
      description: 'API documentation for Smart Farm backend using Express and Swagger',
    },
    servers: [
      {
        url: serverUrl,
        description: 'Firebase Emulator (Local)'

      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    path.join(__dirname, '\\swagger\\*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = {
  swaggerOptions,
  swaggerSpec
};
