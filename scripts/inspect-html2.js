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

// Find references to the HtmlContext variable: tU
// The HtmlContext is assigned as: var tU = /*#__PURE__*/ (0, r)(react_1.default).createContext()
// or similar.
// Let's find the assignment to tU
const idx = content.indexOf("HtmlContext") - 100;
const end = Math.min(content.length, idx + 500);
console.log("=== HtmlContext area in pages.runtime.prod.js ===");
console.log(content.slice(idx, end));
