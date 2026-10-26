# Network: phone at home, phone away, and what to lock first

The app is served by the PC (`Start-Planner.bat` or `npm run serve`) on TCP port **8787**.
Everything below is about reaching that port from a phone. Your own machine's details (its
name, its addresses, your tailnet link) belong in `private/` (git-ignored), not in this file.

## 1. At home (LAN)

1. Start the server. It prints its addresses, e.g. `http://192.168.x.y:8787/`.
2. On the phone, on the same Wi-Fi, open that address in Safari or Chrome.
3. Add it to the home screen (Safari: Share > Add to Home Screen; Chrome: menu > Add to Home
   screen). It installs with the Planner icon and opens full-screen like an app.
4. The plan lives on the PC (`data/plan.json`). The phone shows "PC" in the status pill.

Without a token the server answers only its own pages, reached by an IP address, a one-word PC
name, or a name ending in `.local`, `.lan`, `.home.arpa`, `.internal` or `.ts.net`. If you reach
the PC by another name, list it in `server.hosts=` in `planner.properties`. Other web sites open
in a browser get "401" either way, so they cannot read the plan.

Windows Firewall must allow inbound TCP 8787. Double-click `Allow-Firewall.bat` once
(it asks for administrator approval) to add the rule "Financial Planner 8787". The rule
covers every profile, so it also works when Windows classifies the home network as "Public".
Until the rule exists the phone gets a timeout even though the server is running. To check later:
```
Get-NetFirewallRule -DisplayName "Financial Planner 8787"
```
Give the PC a fixed LAN address so the link never changes: in the router's app or admin page,
add an address reservation for the PC (usually under Network settings > Reservations or DHCP).
Do this before a port forward, because the forward points at that address.

Keep the server always on: `Install-Autostart.bat` (see section 2, "Always on").

## 2. Away from home: Tailscale (recommended; no port forward)

Tailscale beats a port forward: nothing on the router is open to the internet, the
phone-to-PC link is encrypted end to end, and the address is the same at home and away.
Install it on the PC with `winget install Tailscale.Tailscale` and pick a machine name.

1. **Sign the PC in** to your Tailscale account (`tailscale up --hostname <pc-name>`, then the
   login link in a browser). Check with `"C:\Program Files\Tailscale\tailscale.exe" status`.
2. **Phone:** install the Tailscale app, sign in with the same account, toggle on.
3. **Firewall:** not needed for the Tailscale link. The Tailscale installer adds its own
   inbound rules ("Tailscale-In", Private profile) for traffic arriving through the tunnel,
   so the phone reaches port 8787 with no Planner rule at all. `Allow-Firewall.bat` (admin
   click) is only for the plain Wi-Fi link `http://<pc-lan-ip>:8787/` with Tailscale off; it
   allows TCP 8787 from the PC's own subnet and from 100.64.0.0/10 only.
4. **Link on the phone:** `http://<pc-name>.<tailnet>.ts.net:8787/` (MagicDNS, shown by
   `tailscale status`) or `http://100.x.y.z:8787/` (`tailscale ip -4`). Enter the token once
   (System > Settings > PC server; `Show-Token.bat` prints it). Add to the home screen.
5. Tailscale is free for personal use. It must be toggled on on the phone when away; at home
   it goes direct over the Wi-Fi, so the same link is fine everywhere.
6. **Check:** open the link with Wi-Fi off; the status pill should say "PC". Note the link
   in `private/` so the next session does not have to look it up.

**Always on:** `Install-Autostart.bat` registers the Task Scheduler job
"Financial Planner server": the server starts, minimised, when you log on, and is
restarted up to five times if it dies. `Install-Autostart.bat remove` takes it out;
`tools\install-autostart.ps1 -AtStartup` (admin) makes it start at boot before any logon.
Tailscale itself is a service and starts at boot.

The other way, kept for reference: a router port forward.

Do these in order. The token comes first because once the port is open, anyone who finds
it can read the plan unless a token is required.

1. **Set a token.** `planner.properties` takes `auth.token=` (pick 16 characters in four
   groups, nothing that can be misread on a phone). `Show-Token.bat` prints it on the
   PC. Every phone or other PC enters it once in System > Settings > PC server > Access token.
   The PC's own browser and the tools never need it (`auth.trustLocal=true`: requests from
   127.0.0.1 are trusted). Changing the token: edit the line; the server re-reads the file
   on its next `/api/config` call, no restart needed.
2. **Reserve the PC's address** in the router (section 1).
3. **Open the port** in the router: on the PC's reservation, add a forward named "Planner",
   protocol TCP, **an unusual external port (e.g. 4xxxx) to internal port 8787**. The odd
   external port keeps the default-port scanners away and leaves the LAN link unchanged;
   away from home the phone uses `http://<public IP>:<external port>/`.
4. **Find your public address.** The router's app usually shows it under the network's
   details, or search "what is my IP" from a PC at home. Most home connections change it now
   and then; see "Dynamic DNS" below.
5. **Test from mobile data** (Wi-Fi off): `http://<public IP>:<external port>/`. Enter the
   token in Settings. The status pill should say "PC".
6. If it fails: the firewall rule (section 1), the server bound to `0.0.0.0`
   (`server.bind` in planner.properties), and whether your ISP gives you a real public
   address (CGNAT shows as an address starting 100.64-100.127 in the router; then a
   tunnel, below, is the only way).

**Dynamic DNS** so the link is a name, not a changing number: a free DuckDNS name updated
by a tiny scheduled script on the PC, or any DDNS the router supports. Then the phone link
is `http://yourname.duckdns.org:<external port>/`.

## 3. Safer than a raw port forward (recommended once it matters)

A port forward is plain HTTP: the token and the plan travel unencrypted across the internet.
Either of these gives an encrypted link with no open port:

* **Tailscale** (free): install on the PC and the phone; the phone opens
  `http://<pc-tailscale-name>:8787/` from anywhere, encrypted, no router changes. This is the
  best fit for a household.
* **playit.gg**: a TCP tunnel to 8787 also works without an open port.

The token stays on either way.

## 4. Reading statements with the AI

`Transactions > Statement reader` sends the file to the PC server, never anywhere else, unless
`ai.provider=openai` points the AI at an online service: then the page text or picture goes to
that service. With Ollama (the default) everything stays on the PC. `ai.visionModel` picks the
model that reads pictures; empty means the first Ollama model that can (for example qwen3.5:9b
or gemma4:12b).

## 5. What must never be exposed

`planner.properties` and `data/` are refused by the server (403) and are outside git. Do not
put the project behind a general-purpose file share. If the token ever leaks, change it in
the properties file; every device re-enters it.
