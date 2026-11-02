import { checkManual } from "./freshness.js";
import { supplied } from "./content.js";

const { errors, warnings } = await checkManual({ root: process.cwd(), supplied });
for (const warning of warnings) console.warn("warning: " + warning);
for (const error of errors) console.error("error: " + error);
if (errors.length) process.exitCode = 1;
else console.log("The manual matches the current product source.");

