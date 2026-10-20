"""Real-wire mode: expose the plant over Modbus/TCP so the attacker's writes are
genuine frames on the network. Prints live temperature so a two-laptop test
visibly reacts. Tolerant of pymodbus 3.5 -> 3.14 API changes.

  python -m laptop_b.modbus_server                 # binds 0.0.0.0:502 (needs root/admin)
  python -m laptop_b.modbus_server --port 5020     # unprivileged port, no root needed
"""
import argparse
import threading
import time

from shared import config
from laptop_b.plant import CSTR, sis_control

try:
    from pymodbus.server import StartTcpServer
    from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext
    try:                                      # pymodbus >= 3.10
        from pymodbus.datastore import ModbusDeviceContext as _DevCtx
        _NEW_API = True
    except ImportError:                       # pymodbus <= 3.9
        from pymodbus.datastore import ModbusSlaveContext as _DevCtx
        _NEW_API = False
    HAVE_PYMODBUS = True
except Exception as e:
    HAVE_PYMODBUS = False
    _IMPORT_ERR = e


def _to_reg(v):
    return max(0, min(65535, int(v * config.SCALE)))


def _from_reg(v):
    return v / config.SCALE


def run_server(host="0.0.0.0", port=config.MODBUS_PORT):
    if not HAVE_PYMODBUS:
        raise RuntimeError(f"pip install pymodbus needed ({_IMPORT_ERR})")

    store = _DevCtx(hr=ModbusSequentialDataBlock(0, [0] * 100))
    if _NEW_API:
        context = ModbusServerContext(devices=store, single=True)
    else:
        context = ModbusServerContext(slaves=store, single=True)
    plant = CSTR()

    def loop():
        tick = 0
        while True:
            feed = _from_reg(store.getValues(3, config.REG_FEED, 1)[0])
            if feed > 0:
                plant.T0 = feed
            plant.step(config.SIM_DT)
            plant.Tc = sis_control(plant.T, config.T_TRIP)
            store.setValues(3, config.REG_TEMP, [_to_reg(plant.T)])
            store.setValues(3, config.REG_COOLANT, [_to_reg(plant.Tc)])
            tick += 1
            if tick % 20 == 0:
                flag = "   <-- ATTACK: feed spiked!" if feed > 360 else ""
                print(f"[plant] T = {plant.T:6.1f} K   Tc = {plant.Tc:5.1f} K{flag}",
                      flush=True)
            time.sleep(config.SIM_DT)

    threading.Thread(target=loop, daemon=True).start()
    print(f"[modbus] plant serving on {host}:{port}  (Ctrl+C to stop)")
    print("[modbus] waiting for attacker... temperature spikes when reg 10 is written\n")
    StartTcpServer(context=context, address=(host, port))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=config.MODBUS_PORT,
                    help="use 5020 to avoid needing root/admin")
    a = ap.parse_args()
    run_server(a.host, a.port)
