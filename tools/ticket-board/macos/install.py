#!/usr/bin/env python3
"""Install this checkout's ticket board as a macOS login service."""
import pathlib
import plistlib
import shutil
import subprocess
import os

root = pathlib.Path(__file__).resolve().parents[3]
node = shutil.which('node')
if not node:
    raise SystemExit('Node.js must be installed first.')
label = 'com.jaxs.career-lead-ticket-board'
home = pathlib.Path.home()
plist = home / 'Library/LaunchAgents' / f'{label}.plist'
logs = home / 'Library/Logs/career-lead-ticket-board'
registry = home / 'Jaxs/schedules/schedules.yaml'
entry = '''
  - id: career-lead-ticket-board
    what: Serve the local career lead ticket board on http://127.0.0.1:4393
    mechanism: launchd
    fires: "At login and on exit (label com.jaxs.career-lead-ticket-board, RunAtLoad + KeepAlive)"
    owner: /Users/jacobusbrink/Jaxs/projects/lantern
    verify: "launchctl print gui/$(id -u)/com.jaxs.career-lead-ticket-board; curl -f http://127.0.0.1:4393/api/tickets"
    status: active
'''
text = registry.read_text()
if '  - id: career-lead-ticket-board\n' not in text:
    registry.write_text(text.rstrip() + '\n' + entry)
logs.mkdir(parents=True, exist_ok=True)
plist.parent.mkdir(parents=True, exist_ok=True)
config = {
    'Label': label,
    'ProgramArguments': [node, '--import', 'tsx', str(root / 'tools/ticket-board/index.ts')],
    'WorkingDirectory': str(root),
    'RunAtLoad': True,
    'KeepAlive': True,
    'ThrottleInterval': 10,
    'StandardOutPath': str(logs / 'stdout.log'),
    'StandardErrorPath': str(logs / 'stderr.log'),
}
plist.write_bytes(plistlib.dumps(config))
subprocess.run(['plutil', '-lint', str(plist)], check=True)
domain = f'gui/{os.getuid()}'
subprocess.run(['launchctl', 'bootout', f'{domain}/{label}'], capture_output=True)
subprocess.run(['launchctl', 'bootstrap', domain, str(plist)], check=True)
print('Installed ticket board: http://127.0.0.1:4393')
