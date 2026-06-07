const fs = require("fs");
const path = require("path");

const target = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "compiled",
  "next-server",
  "pages.runtime.prod.js"
);

const content = fs.readFileSync(target, "utf8");

// Find var tU = (HtmlContext) definition
let idx = content.indexOf("tU=");
if (idx !== -1) {
  console.log("=== tU = HtmlContext ===");
  console.log(content.slice(idx, idx + 400));
} else {
  // Try full var pattern
  const match = content.match(/var tU=([^;]+)/);
  if (match) {
    console.log("=== tU matched ===");
    console.log(match[0].slice(0, 300));
  } else {
    console.log("No tU= found");
  }
}

// Find var tG = (useHtmlContext)
idx = content.indexOf("tG=");
if (idx !== -1) {
  console.log("\n=== tG = useHtmlContext ===");
  console.log(content.slice(idx, idx + 400));
}

// Also check pages-turbo.runtime.prod.js
const target2 = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "compiled",
  "next-server",
  "pages-turbo.runtime.prod.js"
);

const content2 = fs.readFileSync(target2, "utf8");
idx = 0;
// HtmlContext is tH here
const matches = content2.matchAll(/tH=[^;]+/g);
console.log("\n=== pages-turbo HtmlContext (tH) ===");
for (const m of matches) {
  console.log(m[0].slice(0, 300));
  break;
}
