import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition: swaggerJSDoc.SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Quill API',
    version: '1.0.0',
    description: 'API documentation for Quill — posts, comments, feed, auth, and more.',
  },
  servers: [
    { url: 'http://localhost:4000', description: 'Local dev' },
    { url: 'https://api.quill.app', description: 'Production' },
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
};

export const swaggerSpec = swaggerJSDoc({
  swaggerDefinition,
  // Points at every domain's route file — JSDoc comments there become the spec
  apis: ['./src/domains/**/*.routes.ts'],
});