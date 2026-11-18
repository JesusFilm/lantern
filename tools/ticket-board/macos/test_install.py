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
    def test_installs_from_the_current_checkout_with_or_without_a_schedule_registry(self):
        source = pathlib.Path(__file__).with_name('install.py')
        for has_registry in (False, True):
            with self.subTest(has_registry=has_registry), tempfile.TemporaryDirectory() as temporary:
                base = pathlib.Path(temporary)
                root = base / 'checkout with spaces'
                installer = root / 'tools/ticket-board/macos/install.py'
                installer.parent.mkdir(parents=True)
                shutil.copyfile(source, installer)
                home = base / 'home'
                home.mkdir()
                registry = home / 'Jaxs/schedules/schedules.yaml'
                if has_registry:
                    registry.parent.mkdir(parents=True)
                    registry.write_text('jobs:\n')
                bin_dir = base / 'bin'
                bin_dir.mkdir()
                for name in ('node', 'plutil', 'launchctl'):
                    tool = bin_dir / name
                    tool.write_text('#!/bin/sh\nexit 0\n')
                    tool.chmod(0o755)
                env = {**os.environ, 'HOME': str(home), 'PATH': str(bin_dir) + os.pathsep + os.environ.get('PATH', '')}
                subprocess.run([sys.executable, str(installer)], env=env, check=True, capture_output=True, text=True)
                plist = home / 'Library/LaunchAgents/com.jaxs.career-lead-ticket-board.plist'
                config = plistlib.loads(plist.read_bytes())
                self.assertEqual(config['WorkingDirectory'], str(root))
                self.assertEqual(config['ProgramArguments'][-1], str(root / 'tools/ticket-board/index.ts'))
                if has_registry:
                    self.assertIn('    owner: ' + json.dumps(str(root)), registry.read_text())
                else:
                    self.assertFalse(registry.exists())


if __name__ == '__main__':
    unittest.main()
