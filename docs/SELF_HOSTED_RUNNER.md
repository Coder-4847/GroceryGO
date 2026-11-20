# Getting live prices: run the scraper from your own computer

Carrefour, Lulu and Amazon.ae block GitHub's cloud servers, so the automatic job
on GitHub comes back mostly empty. The same job works from an ordinary home
internet connection. You do **not** install Node or anything else: the workflow
sets that up. You only need **Google Chrome** on the computer.

You don't need to leave the computer on. Switch the runner on only while you
start a refresh, then close it.

## One-time setup (about 10 minutes)

1. Install **Google Chrome** if it isn't already there.
2. GitHub repo -> **Settings -> Actions -> Runners -> New self-hosted runner**.
   Pick your operating system and run the commands it shows, in order. The last
   command (`./run.sh` on Mac/Linux, `.\run.cmd` on Windows) starts the runner.
   When you see **"Listening for Jobs"** it is ready. Leave that window open.
3. (Recommended) **Settings -> Actions -> General** -> under "Fork pull request
   workflows from outside collaborators" choose **Require approval for all outside
   collaborators**.

## Every time you want fresh prices

1. Start the runner (`./run.sh` or `.\run.cmd` in the runner folder). Wait for
   "Listening for Jobs".
2. GitHub -> **Actions -> Scrape prices and deploy site -> Run workflow**, set
   **runner** to `self-hosted`, click the green button.
3. Leave the computer on for about 20-30 minutes. Chrome windows open and close by
   themselves; that is the scraper. The 5 parts run one after another on a single
   computer.
4. When the run turns green the site is updated. Close the runner window (Ctrl+C).

The 6-hourly automatic run keeps using GitHub's servers (and mostly keeps the
last good prices, shown as "older price", for up to 72 hours).

## Notes
- Noon is link-only: its robots.txt disallows automated search.
- Only public price data is published; nothing else from your computer leaves it.
- To remove everything later: Settings -> Actions -> Runners -> your runner ->
  Remove, and delete the runner folder.
