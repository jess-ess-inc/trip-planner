#!/usr/bin/env node
// Fails if anything about the original family, or anything shaped like a secret, is about to be committed.
// The names are encoded so this file doesn't trip its own check.
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const NAMES = Buffer.from("Sm9yamUsU2VhbixTZWFueSxDb3VydG5leSxDb3VydHksQnVjaw==", "base64").toString("utf8").split(",");
const nameRe = new RegExp("\\b(" + NAMES.join("|") + ")\\b", "i");
const secretRes = [
  /sk-ant-[A-Za-z0-9_-]{10,}/,
  /\bsk-[A-Za-z0-9]{32,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

let files;
try {
  files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  console.log("check-private: not a git checkout, skipping.");
  process.exit(0);
}

const problems = [];
for (const f of files) {
  if (f === "package-lock.json") continue;
  let text;
  try {
    if (statSync(f).size > 2_000_000) continue;
    text = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (nameRe.test(line)) problems.push(`${f}:${i + 1} mentions a name from the original family trip`);
    if (secretRes.some((re) => re.test(line))) problems.push(`${f}:${i + 1} looks like it contains a secret key`);
  });
}

if (problems.length) {
  console.error("check-private found things that must not be committed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`check-private: ${files.length} files clean.`);
