// B14. Phone and email boxes bring up the right keyboard. Contacts' Add someone (the page's own boxes), and the kit's
// one word for any page: ui.form fields of type "tel" and "email" (built by the served kit in the running app).
// usage: node B14.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap } from "./_lib.mjs";

const attrs = (loc) => loc.evaluate((e) => ({ type: e.type, inputmode: e.inputMode || e.getAttribute("inputmode") || "", autocapitalize: e.getAttribute("autocapitalize") || "", spellcheck: e.getAttribute("spellcheck") || "" }));
await run("B14-contacts", "family", "household/contacts", async (s) => {
  await swipeTap(s, s.page.locator("#content button").filter({ hasText: /^Add someone$/ }).first(), 600); await settle(s.page);
  const phone = await attrs(s.page.locator("#content form input[name=phone]").first()), email = await attrs(s.page.locator("#content form input[name=email]").first());
  say("B14-contacts", (phone.type === "tel" || phone.inputmode === "tel") && (email.type === "email" || email.inputmode === "email"), `Contacts: Phone ${JSON.stringify(phone)}, Email ${JSON.stringify(email)}`);
});
await run("B14-kit", "family", "overview/dashboard", async (s) => {
  const got = await s.page.evaluate(async () => {
    const src = [...document.querySelectorAll("script[type=module]")].map((x) => x.src).find((x) => /core\/app\.js/.test(x)) ?? `${location.origin}/core/app.js`;
    const ui = await import(new URL("./ui/dom.js", src).href);
    const f = ui.form([{ key: "phone", label: "Phone", type: "tel" }, { key: "email", label: "Email", type: "email" }], {}, () => { });
    const a = (n) => { const e = f.querySelector(`[name=${n}]`); return { type: e.type, inputmode: e.getAttribute("inputmode"), autocapitalize: e.getAttribute("autocapitalize"), spellcheck: e.getAttribute("spellcheck") }; };
    return { phone: a("phone"), email: a("email") };
  });
  say("B14-kit", got.phone.type === "tel" && got.phone.inputmode === "tel" && got.email.type === "email" && got.email.inputmode === "email" && got.email.autocapitalize === "off",
    `ui.form type "tel": ${JSON.stringify(got.phone)}; type "email": ${JSON.stringify(got.email)}`);
});
done("B14 the right keyboard");
