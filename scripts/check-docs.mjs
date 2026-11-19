#!/usr/bin/env node
// Keeps docs in step with the code. Rules: docs/versioning.md#was-die-ci-prüft
// Usage: node scripts/check-docs.mjs [--base <git-ref>]
// With --base (CI on pull requests) it also checks what the branch changed.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args[baseIndex + 1] : null;
const skipChangelog = process.env.SKIP_CHANGELOG === "true";

const errors = [];
const read = (path) => readFileSync(path, "utf8");
const git = (...a) => execFileSync("git", a, { encoding: "utf8" });

// 1. package.json version matches the newest released version in CHANGELOG.md
const pkg = JSON.parse(read("package.json"));
const changelog = read("CHANGELOG.md");
const released = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
if (!changelog.includes("## [Unreleased]")) {
  errors.push("CHANGELOG.md braucht den Abschnitt `## [Unreleased]`.");
}
if (released !== pkg.version) {
  errors.push(
    `Version passt nicht: package.json hat ${pkg.version}, CHANGELOG.md zuletzt ${released ?? "keine"}. Version nur im Release-PR erhöhen (docs/versioning.md#release).`,
  );
}

// 2. every table from the migrations appears in docs/architecture.md
const architecture = read("docs/architecture.md");
const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
const tables = new Set();
const dropped = new Set();
for (const file of migrations) {
  const sql = read(`supabase/migrations/${file}`);
  for (const m of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/gi)) tables.add(m[1]);
  for (const m of sql.matchAll(/drop table (?:if exists )?public\.([a-z_]+)/gi)) dropped.add(m[1]);
}
for (const table of tables) {
  if (!dropped.has(table) && !new RegExp(`\\b${table}\\b`).test(architecture)) {
    errors.push(`Tabelle \`${table}\` fehlt im Datenmodell in docs/architecture.md.`);
  }
}

// 3. every ADR is listed in docs/adr/README.md
const adrIndex = read("docs/adr/README.md");
for (const file of readdirSync("docs/adr")) {
  if (/^\d{3}-.+\.md$/.test(file) && !adrIndex.includes(`(${file})`)) {
    errors.push(`ADR ${file} fehlt in der Übersicht docs/adr/README.md.`);
  }
}

// 4. branch checks against the base (pull requests only)
if (base) {
  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  const touchesApp = changed.some((f) =>
    /^(app|components|lib|supabase|prompts)\/|^proxy\.ts$|^package\.json$/.test(f),
  );
  if (touchesApp && !changed.includes("CHANGELOG.md") && !skipChangelog) {
    errors.push(
      "Der PR ändert App-Code, aber nicht CHANGELOG.md. Eintrag unter `## [Unreleased]` ergänzen oder Label `kein-changelog` setzen.",
    );
  }

  if (changed.includes("package.json") && !changed.includes("docs/tech-stack.md")) {
    let before = {};
    try {
      before = JSON.parse(git("show", `${base}:package.json`));
    } catch {
      // package.json did not exist on the base
    }
    const deps = (p) => ({ ...p.dependencies, ...p.devDependencies });
    const major = (v) => String(v ?? "").match(/\d+/)?.[0];
    const old = deps(before);
    const now = deps(pkg);
    const stackChanges = [
      ...Object.keys(now).filter((d) => !(d in old)).map((d) => `${d} neu`),
      ...Object.keys(old).filter((d) => !(d in now)).map((d) => `${d} entfernt`),
      ...Object.keys(now)
        .filter((d) => d in old && major(old[d]) !== major(now[d]))
        .map((d) => `${d} ${old[d]} → ${now[d]}`),
    ];
    if (stackChanges.length > 0) {
      errors.push(
        `Abhängigkeiten geändert (${stackChanges.join(", ")}), aber docs/tech-stack.md nicht. Zeile im Änderungsprotokoll ergänzen.`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Doku-Prüfung fehlgeschlagen:\n");
  for (const e of errors) console.error(`- ${e}`);
  console.error("\nWas wohin gehört: docs/README.md#was-muss-ich-anpassen");
  process.exit(1);
}
console.log(`Doku-Prüfung ok (Version ${pkg.version}, ${tables.size} Tabellen, ${migrations.length} Migrationen).`);
