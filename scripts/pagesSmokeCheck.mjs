import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ATTR_REF_RE = /\b(?:src|href)=["']([^"']+)["']/gi;
const EXTERNAL_REF_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i;
const REQUIRED_DIST_FILES = [
  ".nojekyll",
  "manifest.webmanifest",
  "sw.js",
  "three.min.js",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
];

export function collectLocalRefs(html) {
  const refs = new Set();
  for (const match of html.matchAll(ATTR_REF_RE)) {
    const ref = String(match[1] || "").trim();
    if (!ref || EXTERNAL_REF_RE.test(ref)) continue;
    refs.add(ref);
  }
  return [...refs];
}

function resolveInside(root, localRef) {
  const clean = String(localRef).split(/[?#]/, 1)[0].replace(/^\.\//, "");
  if (!clean) return null;
  if (clean.startsWith("/")) {
    throw new Error(`absolute root asset reference is not project-page safe: ${localRef}`);
  }
  const fullPath = resolve(root, clean);
  const rel = relative(root, fullPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`asset reference escapes dist: ${localRef}`);
  }
  return fullPath;
}

export function checkDist(distDir = "dist") {
  const root = resolve(distDir);
  const indexPath = resolve(root, "index.html");
  const errors = [];

  if (!existsSync(indexPath)) {
    throw new Error(`missing ${indexPath}`);
  }

  const html = readFileSync(indexPath, "utf8");
  if (!/<div\s+id=["']root["']\s*>\s*<\/div>/i.test(html)) {
    errors.push("index.html is missing an empty #root mount node");
  }
  if (!/<script\b[^>]*type=["']module["'][^>]*src=["']\.\/assets\//i.test(html)) {
    errors.push("index.html must load the built module from ./assets for project-page safety");
  }

  for (const ref of collectLocalRefs(html)) {
    try {
      const fullPath = resolveInside(root, ref);
      if (fullPath && !existsSync(fullPath)) {
        errors.push(`missing referenced asset: ${ref}`);
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  for (const name of REQUIRED_DIST_FILES) {
    const fullPath = resolve(root, name);
    if (!existsSync(fullPath)) {
      errors.push(`missing required dist file: ${name}`);
      continue;
    }
    if (!statSync(fullPath).isFile()) {
      errors.push(`required dist path is not a file: ${name}`);
    }
  }

  if (errors.length) {
    throw new Error(`Pages smoke check failed:\n- ${errors.join("\n- ")}`);
  }

  return { root, refs: collectLocalRefs(html) };
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  const distDir = process.argv[2] || "dist";
  const result = checkDist(distDir);
  console.log(`Pages smoke check passed for ${result.root}`);
}
