#!/usr/bin/env python3
"""Install this checkout's ticket board as a macOS login service."""
import pathlib
import plistlib
import json
import re
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
entry = f'''
  - id: career-lead-ticket-board
    what: Serve the local career lead ticket board on http://127.0.0.1:4393
    mechanism: launchd
    fires: "At login and on exit (label com.jaxs.career-lead-ticket-board, RunAtLoad + KeepAlive)"
    owner: {json.dumps(str(root))}
    verify: "launchctl print gui/$(id -u)/com.jaxs.career-lead-ticket-board; curl -f http://127.0.0.1:4393/api/tickets"
    status: active
'''
if registry.is_file():
    text = registry.read_text()
    matches = list(re.finditer(r'(?m)^  - id: career-lead-ticket-board[ \t]*(?:\#.*)?(?:\n|$)', text))
    if len(matches) > 1:
        raise SystemExit('The schedules registry contains duplicate ticket-board entries.')
    if not matches:
        registry.write_text(text.rstrip() + '\n' + entry)
    else:
        match = matches[0]
        following = re.search(r'(?m)^(?:  - |[^ \t\n#])', text[match.end():])
        end = match.end() + following.start() if following else len(text)
        block = text[match.end():end]
        owners = list(re.finditer(r'(?m)^    owner:[^\n]*(?:\n|$)', block))
        if len(owners) > 1:
            raise SystemExit('The ticket-board registry entry contains duplicate owners.')
        owner = '    owner: ' + json.dumps(str(root)) + '\n'
        if owners:
            found = owners[0]
            if re.match(r'    owner:[ \t]*[|>]', found.group()):
                raise SystemExit('The ticket-board registry owner must be a single-line value.')
            block = block[:found.start()] + owner + block[found.end():]
        else:
            block = owner + block
        separator = '' if match.group().endswith('\n') else '\n'
        registry.write_text(text[:match.end()] + separator + block + text[end:])
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
