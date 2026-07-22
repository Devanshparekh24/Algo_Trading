import swaggerAutogen from "swagger-autogen";

const doc = {
  info: {
    title: "Algo Trading API",
    version: "1.0.0",
    description: "API documentation for the Algo Trading Backend application",
  },
  host: "localhost:5000",
  schemes: ["http"],
};

const outputFile = "./src/config/swagger-output.json";
const endpointsFiles = ["./src/app.ts"];

// Generate the swagger documentation
swaggerAutogen()(outputFile, endpointsFiles, doc).then(() => {
  console.log("Swagger documentation generated successfully!");
});
