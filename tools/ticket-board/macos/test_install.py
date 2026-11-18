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

    def test_reinstall_updates_the_existing_registry_entry_without_changing_other_entries(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = pathlib.Path(temporary)
            root = base / 'checkout with "quotes"'
            installer = root / 'tools/ticket-board/macos/install.py'
            installer.parent.mkdir(parents=True)
            shutil.copyfile(pathlib.Path(__file__).with_name('install.py'), installer)
            home = base / 'home'
            registry = home / 'Jaxs/schedules/schedules.yaml'
            registry.parent.mkdir(parents=True)
            registry.write_text('jobs:\n  - id: career-lead-ticket-board\n    owner: "/old/checkout"\n    note: keep this\n  - id: another-job\n    owner: "/other/checkout"\n')
            bin_dir = base / 'bin'
            bin_dir.mkdir()
            for name in ('node', 'plutil', 'launchctl'):
                tool = bin_dir / name
                tool.write_text('#!/bin/sh\nexit 0\n')
                tool.chmod(0o755)
            env = {**os.environ, 'HOME': str(home), 'PATH': str(bin_dir) + os.pathsep + os.environ.get('PATH', '')}
            for _ in range(2):
                subprocess.run([sys.executable, str(installer)], env=env, check=True, capture_output=True, text=True)
            text = registry.read_text()
            self.assertEqual(text.count('  - id: career-lead-ticket-board\n'), 1)
            self.assertIn('    owner: ' + json.dumps(str(root)) + '\n    note: keep this\n', text)
            self.assertIn('  - id: another-job\n    owner: "/other/checkout"\n', text)
            plist = home / 'Library/LaunchAgents/com.jaxs.career-lead-ticket-board.plist'
            self.assertEqual(plistlib.loads(plist.read_bytes())['WorkingDirectory'], str(root))

    def test_duplicate_registry_entries_fail_without_modifying_the_registry_or_installing_a_service(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = pathlib.Path(temporary)
            root = base / 'checkout'
            installer = root / 'tools/ticket-board/macos/install.py'
            installer.parent.mkdir(parents=True)
            shutil.copyfile(pathlib.Path(__file__).with_name('install.py'), installer)
            home = base / 'home'
            registry = home / 'Jaxs/schedules/schedules.yaml'
            registry.parent.mkdir(parents=True)
            original = 'jobs:\n  - id: career-lead-ticket-board\n    owner: old\n  - id: career-lead-ticket-board\n    owner: other\n'
            registry.write_text(original)
            bin_dir = base / 'bin'
            bin_dir.mkdir()
            node = bin_dir / 'node'
            node.write_text('#!/bin/sh\nexit 0\n')
            node.chmod(0o755)
            env = {**os.environ, 'HOME': str(home), 'PATH': str(bin_dir) + os.pathsep + os.environ.get('PATH', '')}
            result = subprocess.run([sys.executable, str(installer)], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(registry.read_text(), original)
            self.assertFalse((home / 'Library/LaunchAgents/com.jaxs.career-lead-ticket-board.plist').exists())


if __name__ == '__main__':
    unittest.main()
