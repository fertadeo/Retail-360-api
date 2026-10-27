/** PM2 opcional — el provisioner también puede usar `npm start`. */
module.exports = {
  apps: [
    {
      name: "template-retail-api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
