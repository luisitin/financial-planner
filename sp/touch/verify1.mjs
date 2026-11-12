// by hand: Income, tap Ana's salary row, tap Save changes: what does the screen do?
import { households, open, state, tapText, settle, shot, sleep } from "../ux/kit.mjs";
const ROOT = "$SP/wtouch";
const H = await households(ROOT);
const s = await open({ base: "http://127.0.0.1:9320", plan: H.family(), route: "cashflow/income" });
const page = s.page;
const row = page.locator("#content li[role=button]").first();
await row.scrollIntoViewIfNeeded(); await row.tap(); await sleep(900);
let st = await state(page); console.log("after row tap: scrollY", st.scrollY, "docH", st.docH, "focus", st.focus?.name);
await shot(page, "$SP/touch/v1-a.png");
const save = page.locator("#content button", { hasText: "Save changes" });
await save.scrollIntoViewIfNeeded(); await sleep(200);
st = await state(page); console.log("before save: scrollY", st.scrollY, "docH", st.docH);
await shot(page, "$SP/touch/v1-b.png");
await save.tap(); await sleep(900);
st = await state(page); console.log("after save: scrollY", st.scrollY, "docH", st.docH, "notices", JSON.stringify(st.notices));
await shot(page, "$SP/touch/v1-c.png");
await s.close();
