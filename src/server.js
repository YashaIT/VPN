const config = require("./config");
const { createApp } = require("./app");

const { app } = createApp({ config });

app.listen(config.appPort, () => {
  console.log(`VPN service running on port ${config.appPort}`);
});
