#!/usr/bin/env python3
"""Drive an interactive TUI (claude / codex) through a pseudo-terminal.

Usage: ptydrive.py <steps.json> <raw-log> -- <command> [args...]

steps.json is a list of steps:
  {"wait": 5}                         sleep N seconds while draining output
  {"send": "text"}                    type text (no newline)
  {"key": "enter" | "esc" | "ctrl-c" | "tab" | "down"}
  {"expect": "regex", "timeout": 60}  wait until the (ANSI-stripped) screen tail matches
  {"expect_file": "path", "pattern": "regex", "timeout": 120}  wait until a file contains pattern
  {"forbid": "regex"}                 from now on, kill the child and stop as soon as the screen matches
                                      (guards against typing into unexpected dialogs, e.g. updaters)
The child is killed after the last step.
"""
import json
import os
import pty
import re
import select
import signal
import sys
import time

KEYS = {"enter": "\r", "esc": "\x1b", "ctrl-c": "\x03", "tab": "\t", "down": "\x1b[B"}
ANSI = re.compile(rb"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-Za-z]|\x1b[=>]")


def main():
    steps_path, log_path = sys.argv[1], sys.argv[2]
    cmd = sys.argv[sys.argv.index("--") + 1 :]
    steps = json.load(open(steps_path))
    pid, fd = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        os.environ.setdefault("COLUMNS", "160")
        os.environ.setdefault("LINES", "50")
        os.execvp(cmd[0], cmd)
    import fcntl, struct, termios

    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 50, 160, 0, 0))
    log = open(log_path, "wb")
    buf = bytearray()
    forbid = [None]

    class Forbidden(Exception):
        pass

    def drain(seconds):
        end = time.time() + seconds
        while True:
            left = end - time.time()
            if left <= 0:
                return
            r, _, _ = select.select([fd], [], [], min(left, 0.2))
            if r:
                try:
                    data = os.read(fd, 65536)
                except OSError:
                    return
                if not data:
                    return
                log.write(data)
                log.flush()
                buf.extend(data)
                del buf[: max(0, len(buf) - 200000)]
                if forbid[0] and forbid[0].search(screen()):
                    raise Forbidden(forbid[0].pattern)

    def screen():
        return ANSI.sub(b"", bytes(buf[-20000:])).decode("utf-8", "replace")

    def mark(text):
        log.write(f"\n<<<DRIVER {time.strftime('%H:%M:%S')} {text}>>>\n".encode())
        log.flush()

    try:
        run_steps(steps, drain, screen, mark, fd, forbid)
    except Forbidden as exc:
        mark("FORBIDDEN screen matched " + str(exc) + "; aborting")
        log.close()
        os.kill(pid, signal.SIGKILL)
        sys.exit(3)
    try:
        os.kill(pid, signal.SIGTERM)
        drain(1)
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    log.close()


def run_steps(steps, drain, screen, mark, fd, forbid):
    for step in steps:
        mark(json.dumps(step))
        if "forbid" in step:
            forbid[0] = re.compile(step["forbid"])
            drain(0.1)
        elif "wait" in step:
            drain(step["wait"])
        elif "send" in step:
            for ch in step["send"]:
                os.write(fd, ch.encode())
                drain(0.01)
        elif "key" in step:
            os.write(fd, KEYS[step["key"]].encode())
            drain(0.3)
        elif "expect" in step:
            deadline = time.time() + step.get("timeout", 60)
            while time.time() < deadline and not re.search(step["expect"], screen()):
                drain(0.5)
            mark("expect " + ("OK" if re.search(step["expect"], screen()) else "TIMEOUT"))
        elif "expect_file" in step:
            deadline = time.time() + step.get("timeout", 120)
            pattern = re.compile(step["pattern"])
            def hit():
                try:
                    return bool(pattern.search(open(step["expect_file"]).read()))
                except OSError:
                    return False
            while time.time() < deadline and not hit():
                drain(0.5)
            mark("expect_file " + ("OK" if hit() else "TIMEOUT"))


if __name__ == "__main__":
    main()
