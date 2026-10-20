import {readFileSync} from 'node:fs';
import {loadProductionSettings,writeProductionSettings} from './settings.mjs';

// Secret input arrives through the private command environment, never arguments.
try {
 const [action,...extra]=process.argv.slice(2);
 if(extra.length)throw new Error();
 if(action==='load') {
  const values=loadProductionSettings(process.env.RESUME_DIR);
  // Emit only after full validation. The wizard reads data, never shell code.
  process.stdout.write(Object.entries(values).map(([key,value])=>`${key}=${value}\n`).join(''));
 } else if(action==='write') {
  const directory=writeProductionSettings({settings:process.env,ca:readFileSync(process.env.SETUP_CA)});
  process.stdout.write(`${directory}\n`);
 } else throw new Error();
} catch {
 console.error('Private production settings failed validation; no retained settings changed.');
 process.exitCode=1;
}
