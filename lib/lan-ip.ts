import os from "node:os";

// Virtual / non-LAN adapters that show up in `ipconfig` but are NOT reachable
// from another laptop. Picking one of these is the #1 cause of "can't connect".
const VIRTUAL = /(cloudflare|warp|zscaler|wireguard|nordlynx|openvpn|anyconnect|forticlient|vethernet|wsl|hyper-v|virtualbox|vmware|vmnet|docker|loopback|bluetooth|tailscale|zerotier|vpn|tap|tun|npcap|vbox|utun|bridge|br-)/i;

export interface LanAddress { name: string; address: string; likely: boolean }

export function lanAddresses(): LanAddress[] {
  const out: LanAddress[] = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (a.address.startsWith("169.254.")) continue; // no DHCP lease
      const virtual = VIRTUAL.test(name);
      out.push({ name, address: a.address, likely: !virtual });
    }
  }
  // Real adapters first, Wi-Fi first among them.
  return out.sort((x, y) => {
    if (x.likely !== y.likely) return x.likely ? -1 : 1;
    const xw = /wi-?fi|wlan|wireless/i.test(x.name) ? 0 : 1;
    const yw = /wi-?fi|wlan|wireless/i.test(y.name) ? 0 : 1;
    return xw - yw;
  });
}
