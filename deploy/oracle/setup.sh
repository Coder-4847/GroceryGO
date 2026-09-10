#!/usr/bin/env bash
# Run once on a fresh Oracle Cloud Ubuntu 22.04/24.04 VM (ARM or x86).
#   curl -fsSL https://raw.githubusercontent.com/Coder-4847/GroceryGO/main/deploy/oracle/setup.sh | bash
# or: git clone the repo, then `bash deploy/oracle/setup.sh`
set -euo pipefail

echo "==> Opening ports 80 and 443 in the VM firewall"
# Oracle's Ubuntu images ship an iptables rule that drops almost everything.
# Insert ACCEPT rules just before the final REJECT.
if command -v iptables >/dev/null; then
  sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
  sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save 2>/dev/null || {
    sudo mkdir -p /etc/iptables
    sudo iptables-save | sudo tee /etc/iptables/rules.v4 >/dev/null
  }
fi

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Cloning / updating the repo"
if [ ! -d "$HOME/GroceryGO" ]; then
  git clone https://github.com/Coder-4847/GroceryGO.git "$HOME/GroceryGO"
else
  git -C "$HOME/GroceryGO" pull --ff-only
fi

cd "$HOME/GroceryGO/deploy/oracle"
[ -f .env ] || cp .env.example .env

cat <<'NEXT'

==> Almost done. Now:

  1. Edit the domain:      nano ~/GroceryGO/deploy/oracle/.env
  2. Log out and back in   (so your user picks up the 'docker' group)
  3. Start it:             cd ~/GroceryGO/deploy/oracle && docker compose up -d --build
  4. Watch it come up:     docker compose logs -f

Also make sure you've:
  - added an Ingress rule for TCP 80 and 443 in your VCN's Security List / NSG
  - pointed your DuckDNS domain at this VM's public IP

NEXT
