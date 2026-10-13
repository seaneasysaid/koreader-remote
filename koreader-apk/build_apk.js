// Full APK build: extract tools -> install SDK pkgs -> compile -> dex -> link -> sign.
// Run after run_downloads.js completes. Node + unzip only (no external deps).
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync, spawnSync, execSync } = require('child_process');

const ROOT = "D:\\DSworkspace\\koreader-apk";
const B = path.join(ROOT, "build");
const P = path.join(ROOT, "project");
const OUT = path.join(ROOT, "out");
const JDK_ZIP = path.join(B, "jdk17.zip");
const CMD_ZIP = path.join(B, "cmdtools.zip");
const JDK = path.join(B, "jdk");
const ANDROID_SDK = path.join(B, "android-sdk");
const KEYTOOL = path.join(JDK, "bin", "keytool.exe");
const JAVAC = path.join(JDK, "bin", "javac.exe");
const JAR = path.join(JDK, "bin", "jar.exe");

function log(...a) { console.log(...a); }
function fail(m) { console.error("BUILD FAILED: " + m); process.exit(1); }
function run(cmd, args, opts) {
  log("+ " + cmd + " " + args.join(" "));
  // Sandbox blocks stdio:'pipe' for spawnSync (EPERM); must use 'inherit'.
  const r = spawnSync(cmd, args, Object.assign({ stdio: 'inherit' }, opts || {}));
  if (r.error) fail(cmd + ": " + r.error.message);
  if (r.status !== 0) fail(cmd + " exited " + r.status);
  return r;
}
function unzip(zip, dest) {
  // Node 22+ has fs.cp but no unzip; use PowerShell's Expand-Archive via spawnSync.
  log("unzip " + zip + " -> " + dest);
  const r = spawnSync("powershell", ["-NoProfile", "-Command", "Expand-Archive -Force -Path '" + zip + "' -DestinationPath '" + dest + "'"], { stdio: 'inherit' });
  if (r.status !== 0) fail("Expand-Archive " + zip);
}
function copyDirLocal(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, e.name), t = path.join(to, e.name);
    if (e.isDirectory()) copyDirLocal(f, t); else fs.copyFileSync(f, t);
  }
}

// ---- 1. extract JDK ----
if (!fs.existsSync(JAVAC)) {
  if (!fs.existsSync(JDK_ZIP)) fail("jdk17.zip missing");
  unzip(JDK_ZIP, B);
  // find the extracted jdk-17.* folder
  const inner = fs.readdirSync(B).find(d => /^jdk-17/.test(d));
  if (!inner) fail("jdk-17 dir not found after extract");
  fs.renameSync(path.join(B, inner), JDK);
  log("JDK ready: " + JAVAC);
} else log("JDK already present");
// JDK on PATH (sdkmanager is a .bat that needs java on PATH)
process.env.PATH = JDK + "\\bin;" + process.env.PATH;

// ---- 2. extract Android cmdline-tools ----
const SDKMGR = path.join(ANDROID_SDK, "cmdline-tools", "latest", "bin", "sdkmanager.bat");
if (!fs.existsSync(SDKMGR)) {
  if (!fs.existsSync(CMD_ZIP)) fail("cmdtools.zip missing");
  const tmp = path.join(B, "cmdtools_extract");
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  unzip(CMD_ZIP, tmp);
  // zip contains a top-level "cmdline-tools/" dir -> must live under cmdline-tools/latest
  const src = path.join(tmp, "cmdline-tools");
  const dst = path.join(ANDROID_SDK, "cmdline-tools", "latest");
  fs.mkdirSync(dst, { recursive: true });
  copyDirLocal(src, dst);
  fs.rmSync(tmp, { recursive: true, force: true });
  log("cmdline-tools ready: " + SDKMGR);
} else log("cmdline-tools already present");

// ---- 3. install SDK packages via sdkmanager ----
const env = Object.assign({}, process.env, { JAVA_HOME: JDK, ANDROID_HOME: ANDROID_SDK, ANDROID_SDK_ROOT: ANDROID_SDK });
const yes = path.join(B, "yes.txt"); fs.writeFileSync(yes, "y\n");
function sdk(args) {
  const r = spawnSync(SDKMGR, args, { stdio: 'inherit', env, input: fs.readFileSync(yes) });
  if (r.status !== 0) fail("sdkmanager " + args.join(" ") + " -> " + r.status);
}
if (!fs.existsSync(path.join(ANDROID_SDK, "platforms", "android-34"))) sdk(["platforms;android-34"]);
else log("platform android-34 present");
if (!fs.existsSync(path.join(ANDROID_SDK, "build-tools", "34.0.0"))) sdk(["build-tools;34.0.0"]);
else log("build-tools 34.0.0 present");

const AAPT2 = path.join(ANDROID_SDK, "build-tools", "34.0.0", "aapt2.exe");
const D8 = path.join(ANDROID_SDK, "build-tools", "34.0.0", "d8.bat");
const ZIPALIGN = path.join(ANDROID_SDK, "build-tools", "34.0.0", "zipalign.exe");
const APKSIGNER = path.join(ANDROID_SDK, "build-tools", "34.0.0", "apksigner.bat");
const ANDROID_JAR = path.join(ANDROID_SDK, "platforms", "android-34", "android.jar");
if (!fs.existsSync(AAPT2)) fail("aapt2 not found");

// ---- 4. compile Java -> class ----
const JAVA_SRC = path.join(P, "app", "src", "main", "java", "com", "koreader", "remote", "MainActivity.java");
const CLASSES = path.join(B, "classes"); fs.mkdirSync(CLASSES, { recursive: true });
run(JAVAC, ["-encoding", "UTF-8", "-source", "17", "-target", "17", "-cp", ANDROID_JAR, "-d", CLASSES, JAVA_SRC], { env });

// ---- 5. d8 class -> dex (d8 writes classes.dex directly into an output directory) ----
const DEX_DIR = path.join(B, "dex");
if (fs.existsSync(DEX_DIR)) fs.rmSync(DEX_DIR, { recursive: true, force: true });
fs.mkdirSync(DEX_DIR, { recursive: true });
function collectClassFiles(dir) {
  let res = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) res = res.concat(collectClassFiles(fp));
    else if (e.name.endsWith('.class')) res.push(fp);
  }
  return res;
}
const CLASS_FILES = collectClassFiles(CLASSES);
run("cmd", ["/c", D8, "--min-api", "24", "--output", DEX_DIR].concat(CLASS_FILES), { env });
const DEX = path.join(DEX_DIR, "classes.dex");
if (!fs.existsSync(DEX)) fail("classes.dex not produced by d8");

// ---- 6. aapt2 compile + link resources ----
const RES = path.join(P, "app", "src", "main", "res");
const MANIFEST = path.join(P, "app", "src", "main", "AndroidManifest.xml");
const FLAT = path.join(B, "res.flat"); fs.mkdirSync(FLAT, { recursive: true });
// compile each resource file individually (aapt2 --dir into a dir is broken in this build)
function compileDir(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) compileDir(fp);
    else if (/\.(xml|png|jpg|webp|9\.png)$/i.test(e.name)) {
      run(AAPT2, ["compile", "-o", FLAT, fp], { env });
    }
  }
}
compileDir(RES);
const UNSIGNED = path.join(OUT, "koreader-remote-unsigned.apk");
const R_TXT = path.join(B, "R.txt");
const FLATS = fs.readdirSync(FLAT).filter(f => f.endsWith('.flat')).map(f => path.join(FLAT, f));
run(AAPT2, ["link", "-o", UNSIGNED, "--manifest", MANIFEST, "-I", ANDROID_JAR,
  "--min-sdk-version", "24", "--target-sdk-version", "34", "--version-code", "1", "--version-name", "1.0.0",
  "--auto-add-overlay", "--java", path.join(B, "gen"), "--output-text-symbols", R_TXT]
  .concat(FLATS.map(f => ["-R", f]).flat()), { env });

// ---- 7. assemble APK zip: dex + assets + resources.arsc + res + AndroidManifest.xml ----
// aapt2 link already produced resources.arsc + res/ + AndroidManifest.xml inside UNSIGNED.
// We repack cleanly (JDK 17 has no jar.exe): copy those entries + add classes.dex + assets.
const STAGED = path.join(B, "staged");
if (fs.existsSync(STAGED)) fs.rmSync(STAGED, { recursive: true, force: true });
fs.mkdirSync(STAGED, { recursive: true });
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, e.name), t = path.join(to, e.name);
    if (e.isDirectory()) copyDir(f, t); else fs.copyFileSync(f, t);
  }
}
// extract the aapt2-linked APK contents into staged/
function unzipFile(zipPath, outDir) {
  const z = fs.readFileSync(zipPath);
  const zlib = require('zlib');
  let i = 0; const entries = [];
  while (i + 4 <= z.length && z.readUInt32LE(i) === 0x04034b50) {
    const method = z.readUInt16LE(i + 8);
    const compSize = z.readUInt32LE(i + 18);
    const nameLen = z.readUInt16LE(i + 26);
    const extraLen = z.readUInt16LE(i + 28);
    const name = z.toString('utf8', i + 30, i + 30 + nameLen);
    const dataStart = i + 30 + nameLen + extraLen;
    entries.push({ name, method, dataStart, compSize });
    i = dataStart + compSize;
    if (z.readUInt16LE(i + 6) & 0x08) { // data descriptor present
      while (i + 4 <= z.length && z.readUInt32LE(i) !== 0x08074b50) i += 1;
      i += 16;
    }
  }
  for (const e of entries) {
    if (e.name.endsWith('/')) continue;
    const raw = z.subarray(e.dataStart, e.dataStart + e.compSize);
    const out = e.method === 0 ? raw : zlib.inflateRawSync(raw);
    const tp = path.join(outDir, e.name);
    fs.mkdirSync(path.dirname(tp), { recursive: true });
    fs.writeFileSync(tp, out);
  }
}
// Keep aapt2's APK (resources.arsc is stored uncompressed there — required for API 30+),
// and only UPDATE it by appending classes.dex + assets with jar's update mode.
// Build a staging dir with the exact in-APK layout so entries get correct relative paths.
const ADD = path.join(B, "add");
if (fs.existsSync(ADD)) fs.rmSync(ADD, { recursive: true, force: true });
fs.mkdirSync(ADD, { recursive: true });
fs.copyFileSync(DEX, path.join(ADD, "classes.dex"));
copyDir(path.join(P, "app", "assets"), path.join(ADD, "assets"));
// update-mode: append classes.dex (root) + assets/* into the existing UNSIGNED (aapt2 output)
run(JAR, ["uf", UNSIGNED, "-C", ADD, "."], { env });
log("APK updated with dex + assets: " + UNSIGNED);

// ---- 8. zipalign ----
const ALIGNED = path.join(OUT, "koreader-remote-aligned.apk");
if (fs.existsSync(ALIGNED)) fs.unlinkSync(ALIGNED);
run(ZIPALIGN, ["-f", "4", UNSIGNED, ALIGNED], { env });

// ---- 9. sign with debug keystore ----
const KS = path.join(B, "debug.keystore");
if (!fs.existsSync(KS)) {
  run(KEYTOOL, ["-genkeypair", "-v", "-keystore", KS, "-storepass", "android", "-keypass", "android",
    "-alias", "androiddebugkey", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
    "-dname", "CN=KOReader Remote, OU=Dev, O=KOReader, L=Local, S=Local, C=CN"], { env });
}
const SIGNED = path.join(OUT, "koreader-remote.apk");
if (fs.existsSync(SIGNED)) fs.unlinkSync(SIGNED);
run("cmd", ["/c", APKSIGNER, "sign", "--ks", KS, "--ks-pass", "pass:android", "--ks-key-alias", "androiddebugkey",
  "--key-pass", "pass:android", "--out", SIGNED, ALIGNED], { env });
run("cmd", ["/c", APKSIGNER, "verify", "--verbose", SIGNED], { env });

log("\n=== APK BUILT ===");
log("  " + SIGNED + "  " + (fs.statSync(SIGNED).size / 1048576).toFixed(2) + " MB");
