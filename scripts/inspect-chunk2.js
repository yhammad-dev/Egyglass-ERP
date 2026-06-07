const fs = require("fs");
const c = fs.readFileSync(".next/server/chunks/341.js", "utf8");

// Search for HtmlContext references
let idx = 0;
let count = 0;
while ((idx = c.indexOf("HtmlContext", idx)) !== -1 && count < 10) {
  const start = Math.max(0, idx - 100);
  const end = Math.min(c.length, idx + 100);
  console.log(`--- HtmlContext #${count + 1} at ${idx} ---`);
  console.log(c.slice(start, end));
  console.log();
  idx += "HtmlContext".length;
  count++;
}

console.log("\n\n=== vendored.contexts ===");
idx = 0;
count = 0;
while ((idx = c.indexOf("vendored.contexts", idx)) !== -1 && count < 10) {
  const start = Math.max(0, idx - 40);
  const end = Math.min(c.length, idx + 120);
  console.log(`--- vendored.contexts #${count + 1} at ${idx} ---`);
  console.log(c.slice(start, end));
  console.log();
  idx += "vendored.contexts".length;
  count++;
}
