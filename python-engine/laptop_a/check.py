"""
Pre-flight connectivity check. Run this on the ATTACKER laptop BEFORE the demo.

It tells you in plain language whether the attack will work, and if not, which
of the three usual causes is to blame: wrong IP, firewall, or the defender
server not running.

    python -m laptop_a.check --target 192.168.1.42
    python -m laptop_a.check --target 192.168.1.42 --port 5020 --web-port 8000
"""
import argparse
import socket


def probe(host, port, timeout=4.0):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((host, port))
        return True, None
    except socket.timeout:
        return False, "timed out"
    except ConnectionRefusedError:
        return False, "connection refused"
    except OSError as e:
        return False, str(e)
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True, help="defender laptop IP address")
    ap.add_argument("--port", type=int, default=5020, help="Modbus port")
    ap.add_argument("--web-port", type=int, default=8000, help="dashboard web port")
    a = ap.parse_args()

    print("=" * 60)
    print(f"  SafeCut pre-flight check  ->  {a.target}")
    print("=" * 60)

    ok_m, err_m = probe(a.target, a.port)
    ok_w, err_w = probe(a.target, a.web_port)

    print(f"  Modbus plant  {a.target}:{a.port:<6} : "
          f"{'REACHABLE' if ok_m else 'NOT reachable (' + err_m + ')'}")
    print(f"  Dashboard web {a.target}:{a.web_port:<6} : "
          f"{'REACHABLE' if ok_w else 'NOT reachable (' + err_w + ')'}")
    print("-" * 60)

    if ok_m and ok_w:
        print("  ALL GOOD. You are ready. Launch the attack with:")
        print(f"    python -m laptop_a.attack --target {a.target} --port {a.port}")
    elif not ok_m and not ok_w:
        print("  Nothing on that IP is reachable. In order of likelihood:")
        print("   1. Wrong IP. Re-check on the defender laptop (ipconfig / ifconfig).")
        print("   2. Both laptops not on the same network. Use a phone hotspot.")
        print("   3. The defender server is not running yet. Start demo_server first.")
        print("   Quick test: ping " + a.target)
    else:
        print("  Partial reachability, so the network path is fine. This is almost")
        print("  certainly the DEFENDER'S FIREWALL blocking one port.")
        print("  On the defender laptop (PowerShell as Administrator) run:")
        print(f'   New-NetFirewallRule -DisplayName "SafeCut" -Direction Inbound '
              f'-LocalPort {a.port},{a.web_port} -Protocol TCP -Action Allow')
    print("=" * 60)


if __name__ == "__main__":
    main()
