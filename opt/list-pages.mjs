import path from "node:path";
const root = process.argv[2];
const { default: registry } = await import(path.join(root, "modules/registry.js"));
const by = {};
const rows = [];
for (const r of registry) { const m = (await r.load()).default; by[m.status] = (by[m.status] ?? 0) + 1; rows.push({ key: `${r.group}/${r.id}`, status: m.status, placeholder: !!m.placeholder, builderOnly: !!m.builderOnly, requires: m.requires || "", heavy: !!m.heavy, enabledByDefault: m.enabledByDefault, title: m.title }); }
console.log(by, rows.length);
console.log(rows.filter(r => r.builderOnly || r.requires || r.enabledByDefault === false || r.placeholder).map(r => JSON.stringify(r)).join("\n"));
