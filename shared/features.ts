/**
 * Features that ship hidden behind a flag. Add a name together with the code it
 * guards, and remove both once the feature has been released to everyone.
 * See docs/development/feature-flags.md.
 *
 * coach is a standing switch: it stays registered so the goal coach, which
 * calls paid external models, can be turned off or limited to a preview.
 */
export const featureNames: readonly string[] = ["coach", "sidebar-collapse", "focus-progress"];
