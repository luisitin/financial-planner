import path from "node:path";
const ROOT = process.argv[2];
const { default: registry } = await import(path.join(ROOT, "modules/registry.js"));
const out = [];
for (const r of registry) { const m = (await r.load()).default; out.push({ key: `${r.group}/${r.id}`, title: m.title, status: m.status, placeholder: !!m.placeholder, builderOnly: !!m.builderOnly, requires: m.requires || "", heavy: !!m.heavy, enabledByDefault: m.enabledByDefault }); }
const usable = out.filter((m) => m.status !== "planned" && !m.placeholder);
console.log(out.length, "modules;", usable.length, "ready;", usable.filter((m) => !m.builderOnly && !m.requires).length, "offered with no PC");
console.log(usable.filter((m) => m.builderOnly || m.requires || m.enabledByDefault === false).map((m) => `${m.key} ${m.builderOnly ? "builder" : ""} ${m.requires} ${m.enabledByDefault}`).join("\n"));
const byGroup = {}; for (const m of usable) (byGroup[m.key.split("/")[0]] ??= []).push(m.key.split("/")[1]);
for (const [g, l] of Object.entries(byGroup)) console.log(g.padEnd(14), l.length, l.join(" "));
