import json
import os
import pathlib
import plistlib
import shutil
import subprocess
import sys
import tempfile
import unittest


class TicketBoardInstallTest(unittest.TestCase):
    def test_new_registry_entry_uses_the_checkout_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = pathlib.Path(temporary)
            root = base / 'checkout with 💡 and "quotes"'
            installer = root / 'tools/ticket-board/macos/install.py'
            installer.parent.mkdir(parents=True)
            shutil.copyfile(pathlib.Path(__file__).with_name('install.py'), installer)
            home = base / 'home'
            registry = home / 'Jaxs/schedules/schedules.yaml'
            registry.parent.mkdir(parents=True)
            registry.write_text('jobs:\n', encoding='utf-8')
            bin_dir = base / 'bin'
            bin_dir.mkdir()
            for name in ('node', 'plutil', 'launchctl'):
                tool = bin_dir / name
                tool.write_text('#!/bin/sh\nexit 0\n')
                tool.chmod(0o755)
            env = {**os.environ, 'HOME': str(home), 'PATH': str(bin_dir) + os.pathsep + os.environ.get('PATH', ''), 'LC_ALL': 'C', 'PYTHONUTF8': '0', 'PYTHONCOERCECLOCALE': '0'}
            subprocess.run([sys.executable, str(installer)], env=env, check=True, capture_output=True, text=True)
            self.assertIn('    owner: ' + json.dumps(str(root), ensure_ascii=False), registry.read_text(encoding='utf-8'))
            plist = home / 'Library/LaunchAgents/com.jaxs.career-lead-ticket-board.plist'
            config = plistlib.loads(plist.read_bytes())
            self.assertEqual(config['WorkingDirectory'], str(root))
            self.assertEqual(config['ProgramArguments'][-1], str(root / 'tools/ticket-board/index.ts'))



if __name__ == '__main__':
    unittest.main()
