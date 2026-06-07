const fs = require("fs");
const path = require("path");

const dir = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "compiled",
  "next-server"
);

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), "utf8");
  if (
    content.includes("HtmlContext") ||
    content.includes("html-context")
  ) {
    console.log("\n=== " + file + " ===");
    const idx = content.indexOf("HtmlContext");
    console.log(content.slice(Math.max(0, idx - 200), idx + 300));
    console.log();
  }
}
