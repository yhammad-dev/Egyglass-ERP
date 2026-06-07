const fs = require("fs");
const c = fs.readFileSync(".next/server/chunks/341.js", "utf8");

// Find the function x definition - it should be after "function x"
const match = c.match(/function x\([a-z]\)\{[^}]+\}/);
if (match) {
  console.log(match[0].slice(0, 2000));
} else {
  // Try a broader search
  const idx = c.indexOf("function x(");
  if (idx !== -1) {
    console.log(c.slice(idx, Math.min(c.length, idx + 3000)));
  }
}
