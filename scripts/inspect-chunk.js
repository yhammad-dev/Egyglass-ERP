const fs = require("fs");
const c = fs.readFileSync(".next/server/chunks/341.js", "utf8");

// Find all createContext calls and their context
let idx = 0;
let count = 0;
while ((idx = c.indexOf("createContext", idx)) !== -1 && count < 10) {
  const start = Math.max(0, idx - 60);
  const end = Math.min(c.length, idx + 60);
  console.log(`--- createContext #${count + 1} at ${idx} ---`);
  console.log(c.slice(start, end));
  console.log();
  idx += 13;
  count++;
}
