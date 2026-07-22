/**
 * Swagger OpenAPI 3.0 specification document for the Algo Trading API.
 */
export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Algo Trading API",
    version: "1.0.0",
    description: "API documentation for the Algo Trading Backend application",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local Development Server",
    },
  ],
  paths: {
    "/": {
      get: {
        summary: "Health Check",
        description: "Verify that the API server is up and running.",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/profile": {
      get: {
        summary: "Get User Profile",
        description: "Fetches user profile details directly from Angel One SmartAPI.",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    statusCode: { type: "integer" },
                    data: {
                      type: "object",
                      properties: {
                        clientcode: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string" },
                        mobileno: { type: "string" },
                        exchanges: {
                          type: "array",
                          items: { type: "string" },
                        },
                        products: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                    },
                    message: { type: "string" },
                    success: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/user/profile": {
      get: {
        summary: "Get User Profile (Versioned)",
        description: "Fetches user profile details via versioned router structure from Angel One SmartAPI.",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    statusCode: { type: "integer" },
                    data: {
                      type: "object",
                      properties: {
                        clientcode: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string" },
                        mobileno: { type: "string" },
                        exchanges: {
                          type: "array",
                          items: { type: "string" },
                        },
                        products: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                    },
                    message: { type: "string" },
                    success: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
