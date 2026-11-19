# Getting live prices: run the scraper from your own network

Carrefour, Lulu and Amazon.ae block GitHub's cloud servers (their IP ranges are
known datacenters), so the scheduled job on GitHub's own runners comes back
mostly empty. The same job works from an ordinary home or office internet
connection. You do **not** need to install Node or anything else yourself: the
workflow installs Node, and the only requirement is Google Chrome on that machine.

## One-time setup (about 10 minutes)

Use any computer that is on during the day (Windows, macOS or Linux).

1. Install **Google Chrome** on it if it isn't already.
2. On GitHub open the repo, **Settings → Actions → Runners → New self-hosted
   runner**, pick your operating system, and run the few commands it shows (they
   download the runner and register it to your repo). Leave it running (or
   install it as a service with the `svc` commands on that same page).
3. **Settings → Secrets and variables → Actions → Variables → New repository
   variable**:
   - Name: `SCRAPER_RUNNER`
   - Value: `self-hosted`
4. **Actions → Scrape prices and deploy site → Run workflow.** In about 10 minutes
   the site shows live prices. From then on it refreshes every 6 hours while the
   machine is on and the runner is online (jobs wait up to 24 hours for it).

To go back to GitHub's servers, delete the `SCRAPER_RUNNER` variable.

## Notes
- Noon is intentionally link-only: its robots.txt disallows automated search, so
  GroceryGO shows a "Search Noon" link instead of a price.
- The deployed site never contains anything from your machine except the public
  price data.
