import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { createServer } from "node:net";

const root = fileURLToPath(new URL("../", import.meta.url));
const devicesPath = resolve(root, "scripts/fire-tv-devices.local.json");
const propsPath = resolve(root, "apps/fire-tv/local.properties");
const envPath = resolve(root, "apps/lens/.env.local");
const apkPath = resolve(root, "apps/fire-tv/app/build/outputs/apk/debug/app-debug.apk");
const mode = process.argv.includes("--tv-only") ? "tv" : "all";
const rl = createInterface({input:stdin, output:stdout});
const children = [];
const reused = [];
const logs = new Map();
let closing = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function run(command, args, cwd=root) {
  const result = spawnSync(command,args,{cwd,stdio:"inherit"});
  if(result.error) throw new Error(`${command}: ${result.error.message}`);
  if(result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal})`);
}
function available(cmd) {
  return spawnSync("which",[cmd],{stdio:"ignore"}).status===0;
}
function upsert(file,key,value) {
  mkdirSync(dirname(file),{recursive:true});
  const old=existsSync(file)?readFileSync(file,"utf8"):"";
  const lines=old.split(/\r?\n/).filter(line=>!line.startsWith(`${key}=`));
  while(lines.length && !lines.at(-1)) lines.pop();
  writeFileSync(file,[...lines,`${key}=${value}`,""].join("\n"));
}
async function ask(message, fallback="") {
  const answer=(await rl.question(`${message}${fallback?` [${fallback}]`:""}: `)).trim();
  return answer || fallback;
}
async function yes(message, fallback=false) {
  return /^(y|yes)$/i.test(await ask(`${message} (y/n)`,fallback?"y":"n"));
}
const isWsl = existsSync("/proc/sys/fs/binfmt_misc/WSLInterop") ||
  (existsSync("/proc/version") && /microsoft|wsl/i.test(readFileSync("/proc/version", "utf8")));
function windowsLanIp() {
  if(!isWsl || !available("powershell.exe")) return "";
  const result=spawnSync("powershell.exe",["-NoProfile","-NonInteractive","-Command",
    "Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | ForEach-Object { $_.IPv4Address.IPAddress } | Select-Object -First 1"],
    {encoding:"utf8",timeout:5000});
  return result.status===0 ? (result.stdout||"").trim().split(/\s+/)[0] : "";
}
function localIp() {
  const all=Object.values(networkInterfaces()).flat().filter(Boolean);
  const ipv4=all.filter(x=>x.family==="IPv4"&&!x.internal);
  return ipv4.find(x=>/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address))?.address || ipv4[0]?.address || "";
}
function loadDevices() {
  if(!existsSync(devicesPath)) return {};
  const data=JSON.parse(readFileSync(devicesPath,"utf8"));
  if(!data || Array.isArray(data) || typeof data!=="object") throw new Error("Invalid Fire TV device JSON");
  return data;
}
async function configureDevices() {
  const devices=loadDevices();
  console.log("\nFIRE TV CONFIGURATION");
  if(Object.keys(devices).length) {
    for(const [name,dev] of Object.entries(devices)) console.log(`  ${name}: ${dev.serial || "(not configured)"} — ${dev.description || ""}`);
  }
  if(await yes("Add or update a Fire TV?",!Object.keys(devices).length)) {
    do {
      console.log("On Fire TV: Settings > My Fire TV > About > Network (IP address).");
      console.log("Enable Developer Options / ADB debugging; approve the connection prompt on TV.");
      const name=await ask("Device alias (letters, numbers, hyphen)");
      if(!/^[a-zA-Z0-9_-]+$/.test(name)) {console.log("Invalid alias.");continue;}
      const previous=devices[name]||{};
      const serial=await ask("IP or ADB serial (port 5555 added if omitted)",previous.serial||"");
      const normalized=/^\d{1,3}(?:\.\d{1,3}){3}$/.test(serial)?`${serial}:5555`:serial;
      const description=await ask("Description",previous.description||"Fire TV");
      devices[name]={serial:normalized,description};
      mkdirSync(dirname(devicesPath),{recursive:true});
      writeFileSync(devicesPath,JSON.stringify(devices,null,2)+"\n",{mode:0o600});
      console.log(`Saved ${name}.`);
    } while(await yes("Configure another TV?"));
  }
  return devices;
}
async function selectDevices(devices) {
  const entries=Object.entries(devices).filter(([,v])=>v.serial);
  if(!entries.length) return [];
  console.log("\nSelect Fire TVs to deploy (comma-separated numbers; Enter to skip):");
  entries.forEach(([name,v],i)=>console.log(` ${i+1}) ${name} — ${v.serial} — ${v.description||""}`));
  const response=await ask("Device numbers");
  if(!response) return [];
  const indices=[...new Set(response.split(",").map(x=>Number(x.trim())))];
  if(indices.some(i=>!Number.isInteger(i)||i<1||i>entries.length)) throw new Error("Invalid TV selection");
  return indices.map(i=>({name:entries[i-1][0],serial:entries[i-1][1].serial}));
}
async function deploy(selected, backendUrl) {
  if(!selected.length) return;
  for(const cmd of ["adb","java"]) if(!available(cmd)) throw new Error(`Missing ${cmd}. Install Android platform-tools and JDK 21.`);
  if(!existsSync(propsPath)) {
    console.log("\nMissing apps/fire-tv/local.properties.");
    console.log("You must configure sdk.dir with the absolute path to Android SDK.");
    const sdk=await ask("Android SDK directory");
    if(!sdk || !existsSync(sdk)) throw new Error("Android SDK path not found");
    upsert(propsPath,"sdk.dir",sdk);
  }
  upsert(propsPath,"SESSION_SERVICE_URL",backendUrl);
  console.log(`\nFire TV backend URL: ${backendUrl}`);
  for(const tv of selected) {
    if(tv.serial.includes(":")) spawnSync("adb",["connect",tv.serial],{stdio:"inherit"});
    const status=spawnSync("adb",["devices"],{encoding:"utf8"});
    if(!status.stdout?.split("\n").some(line=>line.trim()===`${tv.serial}\tdevice`)) {
      throw new Error(`${tv.name} (${tv.serial}) is not authorized. Check the TV's ADB prompt.`);
    }
  }
  console.log("\nBuilding APK once...");
  run("./gradlew",["assembleDebug"],resolve(root,"apps/fire-tv"));
  if(!existsSync(apkPath)) throw new Error("APK missing after build");
  for(const tv of selected) {
    console.log(`\nDeploying to ${tv.name}...`);
    run("adb",["-s",tv.serial,"install","-r",apkPath]);
    run("adb",["-s",tv.serial,"shell","am","force-stop","com.thresholdtv"]);
    run("adb",["-s",tv.serial,"shell","am","start","-n","com.thresholdtv/.MainActivity"]);
  }
}
async function portAvailable(port) {
  return await new Promise(resolve=>{
    const server=createServer();
    server.once("error",()=>resolve(false));
    server.listen(port,"0.0.0.0",()=>server.close(()=>resolve(true)));
  });
}
async function lensReady() {
  try {
    const r=await fetch("http://127.0.0.1:5173/",{signal:AbortSignal.timeout(1000)});
    return r.ok && (await r.text()).includes("/src/main.tsx");
  } catch {return false;}
}
async function servedLensApiUrl() {
  try {
    const response = await fetch("http://127.0.0.1:5173/src/services/apiClient.ts", {signal:AbortSignal.timeout(2000)});
    if (!response.ok) return null;
    const source = await response.text();
    const match = source.match(/"VITE_SESSION_SERVICE_URL"\s*:\s*"([^"\n]*)"/);
    return match ? match[1] : null;
  } catch { return null; }
}
async function restartStaleVite() {
  // Only stop an explicitly identified Vite listener. Never terminate an arbitrary service.
  if (!available("fuser")) throw new Error("Existing Lens has stale configuration. Install psmisc (fuser), or stop the process on port 5173 and rerun.");
  const result = spawnSync("fuser", ["-n", "tcp", "5173"], {encoding:"utf8"});
  const pids = (result.stdout || "").match(/\d+/g) || [];
  if (!pids.length) throw new Error("Unable to identify the existing Vite process on port 5173. Stop it manually and rerun.");
  const checked = [];
  for (const pid of pids) {
    const info = spawnSync("ps", ["-p", pid, "-o", "args="], {encoding:"utf8"});
    const command = (info.stdout || "").trim();
    if (!/vite/i.test(command)) throw new Error(`Port 5173 belongs to an unrecognized process (${pid}: ${command}). Stop it manually.`);
    checked.push(pid);
  }
  console.log(`Stopping stale Vite process(es): ${checked.join(", ")}`);
  for (const pid of checked) process.kill(Number(pid), "SIGTERM");
  for (let i=0; i<30; i++) {
    if (await portAvailable(5173)) return;
    await sleep(300);
  }
  throw new Error("Vite did not release port 5173. Stop it manually and rerun.");
}
async function waitLens() {
  for(let i=0;i<40;i++){if(await lensReady())return;await sleep(500);}
  throw new Error("Lens did not become ready on port 5173");
}
function launch(command,args,label,env={}) {
  const child=spawn(command,args,{cwd:root,stdio:["ignore","pipe","pipe"],env:{...process.env,...env}});
  children.push(child);
  logs.set(label, "");
  for (const stream of [child.stdout,child.stderr]) {
    stream.on("data", chunk => logs.set(label, ((logs.get(label)||"")+chunk.toString()).slice(-5000)));
  }
  child.on("error",err=>console.error(`${label}: ${err.message}`));
  child.on("exit",code=>{
    if(!closing){console.error(`${label} stopped (${code}). Recent output:\n${logs.get(label)||"(none)"}`);shutdown();}
  });
  return child;
}
function shutdown() {
  if(closing)return;
  closing=true;
  console.log("\nStopping demo processes...");
  for(const child of children) if(child.exitCode===null) child.kill("SIGTERM");
  if(reused.length) console.log(`Left existing services running: ${reused.join(", ")}`);
  rl.close();
  setTimeout(()=>process.exit(0),1000).unref();
}
process.on("SIGINT",shutdown);
process.on("SIGTERM",shutdown);
async function waitHealth() {
  for(let i=0;i<40;i++) {
    try {
      const r=await fetch("http://127.0.0.1:3001/health",{signal:AbortSignal.timeout(700)});
      if(r.ok)return;
    } catch {}
    await sleep(500);
  }
  throw new Error("Backend did not become healthy at http://127.0.0.1:3001/health");
}
async function main() {
  console.log("\nTHRESHOLD // THE LAST WITNESS // DEMO SETUP\n");
  if(!available("pnpm"))throw new Error("pnpm not found. Run: corepack enable");
  if(mode==="all" && Number(process.versions.node.split(".")[0])<22) throw new Error("Node.js 22+ required");
  const devices=await configureDevices();
  const selected=await selectDevices(devices);
  if(mode==="tv") {
    if(!selected.length) {console.log("No TVs selected.");return;}
    const existing=existsSync(propsPath)?readFileSync(propsPath,"utf8").match(/^SESSION_SERVICE_URL=(.+)$/m)?.[1]:"";
    const backend=await ask("Backend URL reachable from Fire TVs",existing||"http://192.168.1.100:3001");
    await deploy(selected,backend);
    console.log("\nFire TV deployment complete.");
    return;
  }
  console.log("\nAI PROVIDER");
  console.log("1) Offline (limited AI features)\n2) Ollama (local model must already be running)\n3) Gemini (API key required)");
  const ai=await ask("Choose AI mode","1");
  const env={};
  if(ai==="2") {
    env.THRESHOLD_AI_PROVIDER="ollama";
    env.OLLAMA_MODEL=await ask("Ollama model","gemma3:4b");
  } else if(ai==="3") {
    env.THRESHOLD_AI_PROVIDER="gemini";
    const key=process.env.GEMINI_API_KEY || await ask("Gemini API key (input visible; prefer exporting GEMINI_API_KEY beforehand)");
    if(!key)throw new Error("Gemini API key required");
    env.GEMINI_API_KEY=key;
  } else {
    env.THRESHOLD_ARCHITECT_MODE="offline";
  }
  const detected=localIp();
  const windowsIp=windowsLanIp();
  if(isWsl) {
    console.log(`\nWSL detected. WSL interface IP: ${detected||"unknown"} (usually NOT reachable from Fire TVs).`);
    if(windowsIp) console.log(`Detected Windows LAN IP: ${windowsIp}`);
    console.log("Fire TVs need a reachable address. WSL NAT may require Windows port forwarding/firewall rules;");
    console.log("WSL mirrored networking may work directly if Windows firewall allows port 3001.");
  }
  const suggested=isWsl ? windowsIp : detected;
  const ip=selected.length ? await ask("Reachable LAN IP for Fire TVs",suggested) : (suggested || detected);
  if(selected.length && !ip)throw new Error("Enter a reachable LAN IP for the selected Fire TVs");
  const backendUrl=ip?`http://${ip}:3001`:"http://127.0.0.1:3001";
  const deployChosen=selected.length ? await yes(`Deploy to ${selected.length} selected Fire TV(s)?`,true) : false;
  upsert(envPath,"VITE_SESSION_SERVICE_URL","/");
  console.log("\nChecking local services...");
  let backendRunning=false;
  try {
    const r=await fetch("http://127.0.0.1:3001/health",{signal:AbortSignal.timeout(1200)});
    const data=await r.json();
    backendRunning=r.ok && data?.service==="threshold-session" && data?.status==="ok";
  } catch {}
  if(backendRunning) {
    console.log("Existing Threshold backend detected on port 3001 — reusing it.");
    console.log("NOTE: AI provider settings above do not change an already running backend.");
    reused.push("Threshold backend (3001)");
  } else {
    if(!await portAvailable(3001)) throw new Error("Port 3001 is occupied by a different service. Stop it or configure a different port.");
    console.log("Starting backend (preserving existing local sessions)...");
    launch("pnpm",["dev:resume"],"Backend",env);
    await waitHealth();
  }
  let lensRunning = await lensReady();
  if (lensRunning) {
    const servedUrl = await servedLensApiUrl();
    if (servedUrl !== "/") {
      console.log(`Existing Lens has stale API configuration: ${servedUrl ?? "unreadable"}`);
      console.log("The demo requires same-origin API requests (VITE_SESSION_SERVICE_URL=/).");
      if (!await yes("Restart the existing Vite Lens safely?", true)) {
        throw new Error("Cannot use stale Lens. Stop Vite on port 5173 and rerun pnpm dev:demo.");
      }
      await restartStaleVite();
      lensRunning = false;
    }
  }
  if (lensRunning) {
    console.log("Existing Lens on port 5173 has correct same-origin API configuration — reusing it.");
    reused.push("Lens (5173)");
  } else {
    if(!await portAvailable(5173)) throw new Error("Port 5173 is occupied by a different service. Stop that process before continuing.");
    console.log("Starting Lens on port 5173...");
    launch("pnpm",["--filter","lens","dev","--host","0.0.0.0","--port","5173","--strictPort"],"Lens");
    await waitLens();
    if (await servedLensApiUrl() !== "/") throw new Error("New Lens did not load VITE_SESSION_SERVICE_URL=/. Check apps/lens/.env.local.");
  }
  let phoneUrl=ip?`http://${ip}:5173`:"http://127.0.0.1:5173";
  if(await yes("Use Cloudflare Quick Tunnel for HTTPS phone access?")) {
    if(!available("cloudflared")) {
      console.log("cloudflared missing. Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/");
      console.log("Continuing in LAN-only mode.");
    } else {
      console.log("Starting temporary Cloudflare tunnel for Lens + proxied API...");
      const tunnel=spawn("cloudflared",["tunnel","--url","http://127.0.0.1:5173","--no-autoupdate"],{cwd:root,stdio:["ignore","pipe","pipe"]});
      children.push(tunnel);
      const url=await new Promise(resolve=>{
        let output="";
        const timeout=setTimeout(()=>resolve(null),20000);
        const receive=data=>{
          output+=data.toString();
          const match=output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
          if(match){clearTimeout(timeout);resolve(match[0]);}
          if(output.length>15000)output=output.slice(-10000);
        };
        tunnel.stdout.on("data",receive);tunnel.stderr.on("data",receive);
        tunnel.on("error",()=>{clearTimeout(timeout);resolve(null);});
        tunnel.on("exit",()=>{clearTimeout(timeout);resolve(null);});
      });
      if(url){phoneUrl=url;console.log(`\nCLOUDFLARE URL: ${phoneUrl}\n`);}
      else {console.log("Tunnel URL not detected. Using LAN URL.");tunnel.kill();}
    }
  }
  if(deployChosen) await deploy(selected,backendUrl);
  console.log("\n========================================");
  console.log("THRESHOLD // READY");
  console.log(`Backend: http://127.0.0.1:3001/health`);
  console.log(`Phone Lens: ${phoneUrl}`);
  console.log(`Fire TV backend: ${backendUrl}`);
  console.log(`TVs selected: ${selected.map(x=>x.name).join(", ")||"none"}`);
  console.log(`Reused services: ${reused.join(", ") || "none"}`);
  console.log("Open the Lens URL on a phone. Press Ctrl+C to stop.");
  console.log("========================================\n");
  rl.close();
  await new Promise(()=>{});
}
main().catch(error=>{console.error("\nSETUP ERROR:",error.message);shutdown();process.exitCode=1;});
