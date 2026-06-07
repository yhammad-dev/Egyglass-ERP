const fs = require("fs");
const c = fs.readFileSync(".next/server/chunks/341.js", "utf8");

// Find module 3885 definition (it's in chunk 341)
// Webpack modules look like: 3885:(a,b,c)=>{...}
const regex = /3885:\([a-z]+,[a-z]+,[a-z]+\)=>\{/g;
let match;
while ((match = regex.exec(c)) !== null) {
  const start = match.index;
  // Extract a reasonable chunk
  const end = Math.min(c.length, start + 5000);
  console.log("=== Module 3885 ===");
  console.log(c.slice(start, end));
}
