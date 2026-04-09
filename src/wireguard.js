const fs = require("fs");
const { execFileSync } = require("child_process");

class WireGuardManager {
  constructor(config) {
    this.config = config;
  }

  appendPeer(comment, peerSnippet) {
    const targetFile = this.config.vpn.serverConfigPath;
    const interfaceName = this.config.vpn.interfaceName;

    if (!targetFile) {
      return { ok: false, message: "Не задан VPN_SERVER_CONFIG_PATH, поэтому peer не добавлен автоматически." };
    }

    const body = fs.readFileSync(targetFile, "utf8");
    if (body.includes(peerSnippet.trim())) {
      return { ok: true, message: "Peer уже присутствует в конфигурации WireGuard." };
    }

    const nextBody = `${body.trimEnd()}\n\n# ${comment}\n${peerSnippet.trim()}\n`;
    fs.writeFileSync(targetFile, nextBody, "utf8");

    if (this.config.vpn.reloadMode === "syncconf") {
      execFileSync("wg", ["syncconf", interfaceName, targetFile], { stdio: "ignore" });
      return { ok: true, message: `Peer добавлен в ${targetFile} и применен через wg syncconf.` };
    }

    if (this.config.vpn.reloadMode === "systemctl") {
      execFileSync("systemctl", ["restart", `wg-quick@${interfaceName}`], { stdio: "ignore" });
      return { ok: true, message: `Peer добавлен в ${targetFile} и интерфейс ${interfaceName} перезапущен.` };
    }

    return { ok: true, message: `Peer добавлен в ${targetFile}. Примените конфигурацию вручную.` };
  }
}

module.exports = {
  WireGuardManager
};
