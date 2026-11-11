import { checkManual, requiresEditionBase } from "./freshness.js";
import { supplied } from "./content.js";

const { errors, warnings } = await checkManual({ root: process.cwd(), supplied }, undefined, { requireBase: requiresEditionBase(process.env), push: process.env.GITHUB_EVENT_NAME === "push" });
for (const warning of warnings) console.warn("warning: " + warning);
for (const error of errors) console.error("error: " + error);
if (errors.length) process.exitCode = 1;
else console.log("The manual matches the current product source.");

