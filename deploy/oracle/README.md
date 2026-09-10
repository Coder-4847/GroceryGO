# Host the GroceryGO backend on Oracle Cloud (Always Free)

Oracle's **Always Free** tier gives you a small VM that never expires and is
never billed (they take a card for identity verification only). It has enough
RAM/CPU to run the headed browser properly — searches land in ~15–30 s instead
of Render's ~90 s, and it doesn't sleep.

You'll end up with the backend at `https://<yourname>.duckdns.org`, and you point
the GitHub Pages frontend at that.

Rough time: **30–40 minutes**, most of it waiting.

---

## 1. Create the Oracle Cloud account

1. Go to <https://www.oracle.com/cloud/free/> → **Start for free**.
2. Sign up. You must give a card; Always Free resources are **not** charged.
   Pick a **Home Region** close to you (you can't change it later) — e.g.
   *Germany Central (Frankfurt)* or *UAE (Dubai/Abu Dhabi)* if offered.
3. Wait for the account to finish provisioning (email confirmation).

---

## 2. Create the VM

Console → hamburger menu → **Compute → Instances → Create instance**.

- **Name:** `grocerygo`
- **Image:** Canonical **Ubuntu 22.04** (or 24.04)
- **Shape:** click **Change shape**:
  - Best: **Ampere (Arm)** → `VM.Standard.A1.Flex`, set **2 OCPU / 12 GB**
    (well within the free limit of 4 OCPU / 24 GB).
  - If you get *"Out of host capacity"* (common for Arm), use
    **`VM.Standard.E2.1.Micro`** (AMD, 1 OCPU / 1 GB) instead — still works,
    just a bit slower. Try the Arm shape again another time; capacity frees up.
- **SSH keys:** choose **Generate a key pair for me** and **download both** the
  private and public keys. Keep the private key safe.
- Leave networking as default (it creates a VCN with a public subnet).
- **Create.** Wait ~1 minute for it to reach *Running*, then note the
  **Public IP address**.

---

## 3. Open ports 80 and 443 (two places)

**a) The cloud firewall (Security List):**

Instance page → **Virtual cloud network** link → **Security Lists** → the default
one → **Add Ingress Rules**, add two:

| Source CIDR | IP Protocol | Destination Port |
| ----------- | ----------- | ---------------- |
| `0.0.0.0/0` | TCP         | `80`             |
| `0.0.0.0/0` | TCP         | `443`            |

**b) The VM's own firewall** — handled by `setup.sh` in step 5.

---

## 4. Get a free domain (DuckDNS)

HTTPS needs a hostname, not a bare IP. DuckDNS is free and takes 2 minutes.

1. <https://www.duckdns.org> → sign in (GitHub/Google).
2. Pick a subdomain, e.g. `grocerygo` → you get `grocerygo.duckdns.org`.
3. In the **current ip** box put your VM's **Public IP** → **update ip**.

---

## 5. Connect to the VM and run setup

From your PC (PowerShell or a terminal), using the private key you downloaded:

```bash
ssh -i path/to/private-key.key ubuntu@YOUR_VM_PUBLIC_IP
```

(Say `yes` to the fingerprint prompt. On Windows you may need
`icacls path\to\key.key /inheritance:r /grant:r "%USERNAME%:R"` first if SSH
complains the key is too open.)

Once logged in:

```bash
curl -fsSL https://raw.githubusercontent.com/Coder-4847/GroceryGO/main/deploy/oracle/setup.sh | bash
```

This opens the VM firewall, installs Docker, and clones the repo. When it
finishes:

```bash
nano ~/GroceryGO/deploy/oracle/.env      # set DOMAIN=grocerygo.duckdns.org, save (Ctrl+O, Enter, Ctrl+X)
exit                                     # log out so Docker group membership applies
```

SSH back in, then:

```bash
cd ~/GroceryGO/deploy/oracle
docker compose up -d --build             # first build ~5-10 min
docker compose logs -f                   # watch; Ctrl+C to stop watching
```

You're looking for `GroceryGO API listening` from `api`, and Caddy reporting a
certificate obtained for your domain.

**Test it:**

```bash
curl https://grocerygo.duckdns.org/health          # from the VM or your PC
```

Should return `{"ok":true,...}`. (The first HTTPS request may take a few seconds
while Caddy fetches the certificate.)

---

## 6. Point the frontend at it

1. GitHub → repo → **Settings → Secrets and variables → Actions → Variables** →
   edit **`API_BASE`** → `https://grocerygo.duckdns.org`
2. **Actions** tab → **Deploy frontend to GitHub Pages** → **Run workflow**.
3. Open `https://coder-4847.github.io/GroceryGO/` and search something.

Done. You can now delete the Render service.

---

## Maintenance

**Deploy new code** (after you push to `main`):

```bash
ssh -i key.key ubuntu@YOUR_VM_IP
bash ~/GroceryGO/deploy/oracle/update.sh
```

**Keep DuckDNS current** — Oracle public IPs are stable while the instance
exists, so you normally don't need to. If it ever changes, re-run the DuckDNS
update, or add their cron one-liner (see duckdns.org → "install").

**Logs / restart:**

```bash
cd ~/GroceryGO/deploy/oracle
docker compose logs -f api
docker compose restart api
docker compose down        # stop everything
```

**Costs:** none. Always Free covers 1 AMD micro VM *and* the Arm allowance,
plus 10 TB/month egress. This app uses a tiny fraction.

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `ssh` times out | Security List ingress for TCP 22 missing, or wrong IP. Port 22 is open by default; check the IP. |
| `curl https://…/health` hangs | Ports 80/443 not open — recheck step 3a, and `sudo iptables -L INPUT -n \| grep -E '80\|443'` on the VM. |
| Caddy log: `no certificate` / ACME failing | DNS not pointing at the VM yet (wait for DuckDNS to propagate), or port 80 blocked (Let's Encrypt needs it). |
| Searches all "unavailable" | `docker compose logs api` — look for `Xvfb` errors or OOM. On the 1 GB micro shape, set `SCRAPER_CONCURRENCY: "2"` in `docker-compose.yml` and `docker compose up -d`. |
| `docker: permission denied` | You didn't log out/in after `setup.sh`. Do that, or run `newgrp docker`. |
