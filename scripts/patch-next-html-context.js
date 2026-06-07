const fs = require("fs");
const path = require("path");

const compiledDir = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "compiled",
  "next-server"
);

const compiledFiles = fs
  .readdirSync(compiledDir)
  .filter((f) => f.startsWith("pages") && f.endsWith(".js"))
  .map((f) => path.join(compiledDir, f));

const DEFAULT = `{"docComponentsRendered":{},"__NEXT_DATA__":{"props":{},"page":"","query":{},"buildId":"","isFallback":false,"locale":"ar"},"locale":"ar","scriptLoader":[],"inAmpMode":false,"hybridAmp":false,"isDevelopment":false,"dangerousAsPath":"","buildManifest":{"ampPath":""},"ampPath":"","headTags":[],"styles":[],"head":[],"dynamicImports":[],"assetPrefix":"","canonicalBase":"","assetQueryString":"","crossOrigin":"","nextConfigOutput":"","devOnlyCacheBusterQueryString":""}`;

for (const target of compiledFiles) {
  if (!fs.existsSync(target)) continue;
  let content = fs.readFileSync(target, "utf8");
  let modified = false;

  // Replace createContext(default) with createContext(DEFAULT)
  // for the HtmlContext (which uses the `)(default)` pattern - indirect call)
  for (const oldDefault of ["void 0", "{}", "undefined"]) {
    const pattern = `createContext)(${oldDefault})`;
    if (content.includes(pattern)) {
      content = content.split(pattern).join(`createContext)(${DEFAULT})`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(target, content, "utf8");
    console.log("Patched:", path.basename(target));
  } else {
    console.log("No change needed:", path.basename(target));
  }
}
