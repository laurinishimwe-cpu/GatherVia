const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

function readEnvValue(name) {
  if (!fs.existsSync(envPath)) return undefined;

  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));

  return line?.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL || readEnvValue("EXPO_PUBLIC_API_URL");

function getActiveLanAddress() {
  const interfaces = Object.values(os.networkInterfaces()).flatMap((entries) => entries ?? []);
  return interfaces.find((entry) => {
    const family = typeof entry.family === "string" ? entry.family : String(entry.family);
    return family === "IPv4" || family === "4";
  })?.address;
}

function isPrivateAddress(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "10.0.2.2" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

let configuredUrl;

try {
  configuredUrl = new URL(configuredApiUrl);
} catch {
  console.error("Set EXPO_PUBLIC_API_URL in .env to your computer's LAN URL.");
  process.exit(1);
}

const activeAddress = getActiveLanAddress();
if (!activeAddress) {
  console.error("No active LAN IPv4 address was found. Connect this computer to Wi-Fi first.");
  process.exit(1);
}

const hostname = isPrivateAddress(configuredUrl.hostname) ? activeAddress : configuredUrl.hostname;
const effectiveApiUrl = new URL(configuredUrl.toString());
if (isPrivateAddress(configuredUrl.hostname)) effectiveApiUrl.hostname = activeAddress;

console.log(`Starting Expo for a physical device at ${activeAddress}...`);
console.log(`Mobile API: ${effectiveApiUrl.origin}`);

const expoCli = path.join(projectRoot, "node_modules", "expo", "bin", "cli");
const child = spawn(process.execPath, [expoCli, "start", "--offline", "--clear"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    EXPO_PUBLIC_API_URL: effectiveApiUrl.origin,
    REACT_NATIVE_PACKAGER_HOSTNAME: hostname,
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 1));
