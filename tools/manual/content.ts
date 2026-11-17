import type { Locator, Page } from "@playwright/test";
import { allShots, isSupplied, type Chapter, type Shot, type Supplied } from "./manual.js";

/**
 * The QA manual. Each feature slide states what the feature does, how to try it
 * and what to check, followed by the scenes that photograph it. ① ② … in the
 * text refer to the numbered callouts drawn from each shot's highlight list.
 * Keep text short: generation fails when a slide's text does not fit.
 */
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).first();
const click = (...names: string[]) => async (page: Page) => {
  for (const name of names) await button(page, name).click();
};
const heading = (name: string, level = 1) => (page: Page): Locator => page.getByRole("heading", { name, exact: true, level }).first();
const role = (kind: "button" | "link" | "checkbox" | "textbox" | "radio" | "group" | "region", name: string) => (page: Page) =>
  page.getByRole(kind, { name, exact: true }).first();
const openReview = (title: string) => async (page: Page) => {
  await page.locator("section.cp-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).getByRole("button", { name: "Review focus", exact: true }).click();
};
const samsReview = openReview("Sam Patel · Sam's 2027 focus");
const ownReview = openReview("Your review request · Morgan's first half 2027");
const draft = (ids: { draftFocus: string }) => "/?focus=" + ids.draftFocus;
/** Long desktop pages: scroll frames cropped to the content column, so text stays legible on a slide. */
const longPage = { kind: "frames", crop: ".workspace", maxFrames: 3 } as const;
const dialog = { crop: "role=dialog", cropPadding: 0 } as const;
const confirmed = (ids: { confirmedFocus: string }) => "/?focus=" + ids.confirmedFocus;

const jesusFilmSignIn: Supplied = {
  id: "jesusfilm-sign-in",
  file: "jesusfilm-sign-in.png",
  sources: ["server/jesusfilm.ts", "server/access.ts", "server/admission.ts", "server/accounts.ts"],
  caption: "Jesus Film Auth sign-in",
  instructions: "Open staging signed out and capture Jesus Film Auth’s sign-in screen in a 1440 × 900 window.",
};
const guided = async (page: Page) => {
  await click("+ Add objective", "Guide with AI")(page);
  await page.getByRole("radio", { name: "Contribution", exact: true }).check();
  await page.getByLabel("Your work", { exact: true }).fill("I look after our deployment pipeline. When deployments fail, engineers often lose hours working out why.");
};
const planGoal = async (page: Page) => {
  await guided(page);
  await click("Next")(page);
  await page.getByRole("checkbox", { name: "Other — none of these apply", exact: true }).check();
  await click("Next", "Add SMART goal")(page);
  await page.getByRole("radio", { name: "Publish runbooks for the three most common causes" }).check();
};

export const chapters: Chapter[] = [
  {
    title: "Before you start",
    summary: "Lantern helps each team member prepare a **position focus** — a short, dated plan of objectives and SMART goals — and agree it with their career lead.",
    slides: [
      {
        kind: "intro",
        title: "How to use this manual",
        lead: "Each feature has one slide: what it does, how to try it, and what to check. Work through the chapters in order the first time; later, use the edition number to see what changed.",
        points: [
          { title: "Try it", text: "Steps to reach the screen yourself on staging. Numbers such as ① match the highlighted controls in the screenshots." },
          { title: "Check", text: "Behavior to confirm. Each check is a pass or fail; report a failure as a GitHub issue." },
          { title: "Screenshots", text: "Generated automatically from the application source on a fixed desktop (1440 × 900) and phone (390 × 844) profile." },
          { title: "Synthetic data", text: "Every name, email and focus in this manual is fictional. Use only test data on staging." },
          { title: "Two roles", text: "**Members** write their own focuses. **Career leads** review, confirm and manage their department. You need an account in each role." },
          { title: "Editions", text: "The manual is regenerated whenever the product changes. The latest edition is attached to the newest GitHub release." },
        ],
      },
      {
        kind: "people",
        title: "The people in the screenshots",
        lead: "The screenshots use fictional people in a local demonstration. QA uses their own Jesus Film accounts in the staging QA department.",
        people: [
          { name: "Aroha Ngata", role: "Member · Engineering", text: "Has a confirmed focus for the second half of 2026 and is drafting one for 2027." },
          { name: "Sam Patel", role: "Member · Engineering", text: "Has sent two versions of a focus to the career lead for review." },
          { name: "Morgan Lee", role: "Career lead · Engineering", text: "Reviews Engineering’s focuses, has a separate own review request, and manages the department." },
          { name: "Riley Chen", role: "Career lead · Design", text: "Leads a different department and must not see Engineering's focuses." },
          { name: "Casey Brown", role: "No department yet", text: "Has signed in but is waiting for a career lead to add them." },
        ],
      },
    ],
  },
  {
    title: "Signing in and your account",
    summary: "Lantern uses Jesus Film sign-in. An approved account then needs a career lead to add it to a department.",
    slides: [
      {
        kind: "feature",
        title: "Sign in with Jesus Film",
        roles: ["Signed out"],
        summary: "Signed-out visitors go straight to Jesus Film Auth before Lantern loads, with a fresh login prompt. Only approved accounts can sign in.",
        tryIt: ["Open the staging address in a private window.", "The server sends you straight to Jesus Film Auth, without a Lantern loading screen.", "Sign in to your test Jesus Film account."],
        check: [
          "Returning users keep their original department, role and focuses.",
          "An account that is not approved returns to the retry screen with “Sign-in could not be completed”.",
          "Cancelling at Jesus Film Auth also returns with that message.",
          "Reloading keeps you signed in.",
        ],
        shots: [
          { id: "sign-in", persona: "anonymous", path: "/?signInError=1", ready: role("link", "Sign in with Jesus Film"), highlight: ['role=link[name="Sign in with Jesus Film"]'], caption: "Retry after failed or cancelled sign-in" },
          jesusFilmSignIn,
        ],
      },
      {
        kind: "feature",
        title: "Waiting to join a department",
        roles: ["Anyone"],
        summary: "A newly signed-in account has no department, so it cannot write focuses until a career lead adds it.",
        tryIt: ["Sign in with an approved account that has no department.", "Ask the career lead to add you (see Department → Add user).", "Choose ① **Check access**."],
        check: [
          "The screen explains that the career lead must add you.",
          "After you are added, Check access opens Position focuses without signing in again.",
          "No department data is visible before you are added.",
        ],
        shots: [{ id: "account-pending", persona: "newcomer", ready: heading("Your account is ready"), highlight: ['role=button[name="Check access"]'], caption: "Signed in, no department" }],
      },
      {
        kind: "feature",
        title: "Sidebar navigation",
        roles: ["Member", "Career lead"],
        summary: "The Lantern mark and icons identify the main destinations. Navigation flag: sidebar-collapse; hidden in production until released.",
        tryIt: ["Choose **Collapse sidebar** above your profile at the bottom.", "Use an icon to open Guide or Account; hover for its name.", "Reload, then choose ① **Expand sidebar**."],
        check: ["Desktop icons stay fixed while labels fade, and sit centred in the collapsed rail. Phones use a top-right menu button.", "The choice survives navigation and reload in this browser.", "The phone menu slides in; select a destination or close it with × or Escape.", "Members see only their permitted destinations; career leads also see reviews and Department."],
        shots: [
          { id: "sidebar-collapsed", persona: "lead", act: async (p) => { await click("Collapse sidebar")(p); await p.reload(); }, ready: role("button", "Expand sidebar"), highlight: ['role=button[name="Expand sidebar"]'], caption: "Collapsed desktop navigation" },
          { id: "phone-sidebar-collapsed", persona: "lead", device: "phone", act: click("Open menu"), ready: role("button", "Close menu"), highlight: ['role=button[name="Close menu"]'], caption: "Sliding phone navigation" },
        ],
      },
      {
        kind: "feature",
        title: "Your account",
        roles: ["Member", "Career lead"],
        summary: "Account shows your profile. You can change the display name others see, and sign out.",
        tryIt: ["Open **Account** in the sidebar.", "Choose ① **Edit name**, change it and save.", "Choose ② **Sign out**."],
        check: [
          "The new name appears in the sidebar and survives a reload.",
          "Your career lead sees the new name in Department → People.",
          "After signing out, Back does not show your data.",
        ],
        shots: [
          { id: "account", persona: "member", path: "/?page=account", ready: heading("Account"), highlight: ['role=button[name="Edit name"]', 'role=button[name="Sign out"]'], caption: "Profile" },
          { id: "account-edit-name", persona: "member", path: "/?page=account", act: click("Edit name"), ready: (p) => p.getByLabel("Display name").first(), caption: "Editing the display name" },
        ],
      },
      {
        kind: "feature",
        title: "Appearance",
        roles: ["Member", "Career lead"],
        summary: "Choose Light, Dark or System in Account. System follows your device's color setting.",
        tryIt: ["Open **Account**.", "Choose ① **Light**, **Dark** or **System** under Appearance.", "Reload the page."],
        check: ["The chosen mode is remembered in this browser.", "System follows changes to the device setting.", "Clearing browser storage resets the choice to System."],
        shots: [{ id: "account-appearance", persona: "member", path: "/?page=account", ready: heading("Appearance", 2), highlight: ['role=group[name="Style mode"]'], caption: "Appearance settings" }],
      },
    ],
  },
  {
    title: "Writing a position focus",
    summary: "Members create dated focuses, add objectives and SMART goals, and link each objective to the department's strategic initiatives.",
    slides: [
      {
        kind: "feature",
        title: "Your position focuses",
        roles: ["Member"],
        summary: "The home screen shows the department's mission and every focus you have written, newest period first.",
        tryIt: ["Sign in as a member.", "Read the ① mission card.", "Choose ② **Open** on a focus."],
        check: [
          "The mission matches Department → Mission & initiatives.",
          "Focuses are listed by period, newest first.",
          "A member with no focuses sees a first-focus prompt linking to the Guide.",
        ],
        shots: [{ id: "focus-list", persona: "member", ready: heading("Position focuses"), highlight: ['role=region[name="Our mission"]', 'role=button[name="Open"] >> nth=0'], caption: "Home" }],
      },
      {
        kind: "feature",
        title: "Start a new focus",
        roles: ["Member"],
        summary: "A focus needs a title and a period. Everything else can be added later; empty and partial drafts are valid.",
        tryIt: ["Choose **New position focus**.", "Enter a title and the start and end dates.", "Choose **Save changes**."],
        check: [
          "The new focus opens as a Draft and appears in the list.",
          "An end date before the start date cannot be saved.",
          "Cancel closes the dialog without creating a focus.",
        ],
        shots: [
          {
            id: "focus-new",
            persona: "member",
            act: async (page) => {
              await click("New position focus")(page);
              await page.getByLabel("Document title").fill("Second half 2027");
              await page.getByLabel("Period starts").fill("2027-07-01");
              await page.getByLabel("Period ends").fill("2027-12-31");
            },
            ready: role("button", "Save changes"),
            caption: "New focus dialog",
          },
        ],
      },
      {
        kind: "feature",
        title: "Reading a focus",
        roles: ["Member"],
        summary: "A focus opens in a compact reading view. Each objective shows its type, initiatives and numbered SMART goals.",
        tryIt: ["Open a draft focus.", "Use ① **Edit title & dates** to change the period.", "Use ② **+ Add objective**, or the actions on each objective and goal."],
        check: [
          "Contribution, Personal development and Leadership labels match what was saved.",
          "Initiative badges show the configured icon and color.",
          "Remove asks before deleting an objective or goal.",
        ],
        shots: [{ id: "focus-draft", persona: "member", path: draft, ready: heading("First half 2027"), mode: longPage, highlight: ['role=button[name="Edit title & dates"]', 'role=button[name="+ Add objective"]'], caption: "Draft focus" }],
      },
      {
        kind: "feature",
        title: "Add an objective",
        roles: ["Member"],
        summary: "Each new objective starts with a choice: write it yourself, or let AI guide you through it. You can switch methods without losing text.",
        tryIt: ["Open a draft and choose **+ Add objective**.", "Choose ① **Write myself** or ② **Guide with AI**."],
        check: [
          "Both methods edit the same objective; switching keeps your text.",
          "Cancel returns to the focus without changes.",
          "Guide with AI is offered only when the AI service is available.",
        ],
        shots: [{ id: "objective-choice", persona: "member", path: draft, act: click("+ Add objective"), ready: heading("Add objective"), highlight: ['role=button[name="Write myself"]', 'role=button[name="Guide with AI"] >> nth=0'], caption: "Choosing a method" }],
      },
      {
        kind: "feature",
        title: "Write an objective yourself",
        roles: ["Member"],
        summary: "The objective page holds the objective, its ① type, its ② strategic initiatives and its SMART goals. **Save objective** saves them together.",
        tryIt: ["Choose **Edit objective** on an objective.", "Change the text, type and initiatives.", "Edit, add or remove SMART goals, then **Save objective**."],
        check: [
          "Saving without an initiative or Other shows “Select an initiative or Other”.",
          "Choosing Other clears the named initiatives.",
          "Other objectives in the focus are unchanged after saving.",
          "Leaving with unsaved changes asks for confirmation.",
        ],
        shots: [{ id: "objective-manual", persona: "member", path: draft, act: click("Edit objective"), ready: heading("Edit objective"), mode: longPage, highlight: ['role=group[name="Objective type"]', 'role=group[name="Strategic initiatives"]'], caption: "Edit objective" }],
      },
      {
        kind: "feature",
        title: "Quick SMART goal edits",
        roles: ["Member"],
        summary: "Each goal has its own **Edit** and **Remove** actions for small changes, shown with the objective for context.",
        tryIt: ["Choose **Edit** beside a SMART goal.", "Change the wording and choose **Save changes**."],
        check: [
          "Only that goal changes; the objective and other goals stay the same.",
          "A failed save keeps your text in the dialog.",
          "Cancel discards the change.",
        ],
        shots: [{ id: "goal-edit", persona: "member", path: draft, act: async (page) => { await page.locator(".read-goal").first().getByRole("button", { name: "Edit", exact: true }).click(); }, ready: heading("Edit SMART goal", 2), caption: "Edit SMART goal" }],
      },
      {
        kind: "feature",
        title: "Guide with AI: from your work to an objective",
        roles: ["Member"],
        summary: "Choose an objective type, then describe your work. **coach-redesign** is hidden in production until released; **coach** must also be available.",
        tryIt: ["Choose **+ Add objective**, then **Guide with AI**.", "Choose a type or Not sure; describe your work and role.", "Review the suggestion; choose an initiative or Other."],
        check: [
          "Recommendations offer a switch; your type stays selected.",
          "Next requires an initiative or Other; choosing either clears the error.",
          "Concerns stay visible; refine the draft or edit it yourself.",
        ],
        shots: [
          { id: "guided-work", persona: "member", path: draft, act: guided, ready: (p) => p.getByLabel("Your work", { exact: true }), caption: "Your work" },
          { id: "guided-objective", persona: "member", path: draft, act: async (page) => { await guided(page); await click("Next", "Next")(page); }, ready: (p) => p.getByRole("alert"), mode: longPage, caption: "Choose an initiative or Other" },
        ],
      },
      {
        kind: "feature",
        title: "Guide with AI: goals and final check",
        roles: ["Member"],
        summary: "**coach-redesign** suggests goal ideas immediately. Check the finished draft before saving. Hidden in production until released; requires **coach**.",
        tryIt: ["At SMART goals, select an idea or **Add SMART goal**.", "Pick or write an action and date, then **Next**.", "Edit the goal, **Add to objective**, then **Next** to the check."],
        check: [
          "Dates outside the focus period are rejected.",
          "Check shows your objective and goals without changing wording.",
          "No goals warns but permits saving; failure keeps your writing.",
        ],
        shots: [
          { id: "guided-goals", persona: "member", path: draft, act: planGoal, ready: heading("Plan a SMART goal", 2), highlight: ['role=group[name="Choose an action"]'], caption: "Planning a goal" },
          {
            id: "guided-check",
            persona: "member",
            path: draft,
            act: async (page) => { await planGoal(page); await click("Next", "Add to objective", "Next")(page); },
            ready: heading("Check objective"),
            caption: "Check objective",
          },
        ],
      },
    ],
  },
  {
    title: "Review and agreement",
    summary: "Everyone requests review of the current saved version before confirmation, including career leads. Offline agreement still requires these steps. Notes are optional; a lead can confirm immediately or later.",
    slides: [
      {
        kind: "feature",
        title: "Ask your career lead for a review",
        roles: ["Member"],
        summary: "**Review & discussion** shows the focus read-only, with a request form and the notes. Saving alone never sends a review request.",
        tryIt: ["Open a draft with a Contribution objective and at least one goal.", "Choose **Review & discussion**.", "Add an optional ① note and choose ② **Send request**."],
        check: [
          "The career lead sees the request under Review requests.",
          "Sending disables note entry; a failed send retains the note for retry.",
          "A request without a note succeeds and leaves an editable draft.",
          "After edits, send the newer saved version before confirmation.",
        ],
        shots: [{ id: "review-request", persona: "member", path: draft, act: click("Review & discussion"), ready: heading("Request review", 2), mode: longPage, highlight: ['role=textbox[name="Note to career lead · optional"]', 'role=button[name="Send request"]'], caption: "Review & discussion" }],
      },
      {
        kind: "feature",
        title: "When a review request is unavailable",
        roles: ["Member", "Career lead"],
        summary: "Notes remain optional. Note and Send share one disabled state and an accessible reason.",
        tryIt: ["As each role, open review for blank, development-only and no-goal drafts.", "Save a Contribution with a SMART goal; reopen review."],
        check: ["Reason is beside Send; above it on phones.", "Saving enables both without sending.", "Sending, stale, requested and locked states explain why both are disabled.", "With retained text, open **Copy unsent note** and select/copy using the keyboard."],
        shots: [
          { id: "request-missing-contribution", persona: "member", path: (ids) => "/?focus=" + ids.missingContributionFocus, act: click("Review & discussion"), ready: heading("Request review", 2), mode: { kind: "element", target: ".cp-request", padding: 16 }, caption: "Member: missing Contribution objective" },
          { id: "request-missing-goal", persona: "lead", device: "phone", path: (ids) => "/?focus=" + ids.incompleteFocus, act: click("Review & discussion"), ready: heading("Request review", 2), mode: { kind: "element", target: ".cp-request", padding: 0 }, caption: "Own focus: Contribution needs a goal" },
          {
            id: "request-readiness-recovered", persona: "member", path: (ids) => "/?focus=" + ids.missingContributionFocus, mutates: true,
            act: async (page) => {
              await click("Edit objective")(page);
              await page.getByRole("radio", { name: "Contribution", exact: true }).check();
              await click("Save objective", "Review & discussion")(page);
            },
            ready: (page) => page.locator('.cp-request button:not([disabled])').filter({ hasText: "Send request" }),
            mode: { kind: "element", target: ".cp-request", padding: 16 }, caption: "Saved Contribution and goal: ready, note optional",
          },
        ],
      },
      {
        kind: "feature",
        title: "Review requests",
        roles: ["Career lead"],
        summary: "Career leads see department review requests, including their own, with status and new notes.",
        tryIt: ["Sign in as the career lead.", "Open **Review requests**.", "Choose ① **Review focus**."],
        check: [
          "Only your department appears, including your own requested focus.",
          "“New notes” clears once you have read them.",
          "Confirmed focuses show as Confirmed.",
        ],
        shots: [{ id: "lead-reviews", persona: "lead", path: "/?page=reviews", ready: heading("Review requests"), highlight: ['role=button[name="Review focus"] >> nth=0'], caption: "Review requests" }],
      },
      {
        kind: "feature",
        title: "Review what changed and discuss",
        roles: ["Career lead", "Member"],
        summary: "The review shows the submitted snapshot, ① what changed since the previous request, and the notes. Both people can add notes and delete their own.",
        tryIt: ["Open a request that has been sent twice.", "Read the highlighted changes.", "Choose ② **+ Add note**, write a note and send it."],
        check: [
          "Insertions and deletions match the two versions.",
          "Notes cannot be edited, only deleted by their author.",
          "The member sees the lead's note under Review & discussion.",
        ],
        shots: [{ id: "lead-review", persona: "lead", path: "/?page=reviews", act: samsReview, ready: heading("Changes since previous request", 2), mode: longPage, highlight: ['role=heading[name="Changes since previous request"]', 'role=button[name="+ Add note"]'], caption: "Reviewing Sam's request" }],
      },
      {
        kind: "feature",
        title: "Confirm and lock a focus",
        roles: ["Career lead"],
        summary: "After agreement, tick ① and ② confirm the current requested version. Offline agreement still needs a request. Content and discussion lock.",
        tryIt: ["Open a request and tick the agreement box.", "Choose **Confirm focus**.", "Reload as the member."],
        check: [
          "The confirmer and date persist.",
          "Content and discussion stay locked for leads too.",
          "Stale or concurrent attempts leave a usable draft.",
          "Older confirmations need no retroactive request.",
        ],
        shots: [
          {
            id: "lead-confirm",
            persona: "lead",
            path: "/?page=reviews",
            act: async (page) => { await samsReview(page); await page.getByRole("checkbox", { name: "We have discussed and agreed this focus." }).check(); },
            ready: role("button", "Confirm focus"),
            mode: { kind: "element", target: (p) => p.getByRole("button", { name: "Confirm focus" }).locator("xpath=.."), padding: 24 },
            highlight: ['role=checkbox[name="We have discussed and agreed this focus."]', 'role=button[name="Confirm focus"]'],
            caption: "Ready to confirm",
          },
          { id: "focus-confirmed", persona: "member", path: confirmed, ready: heading("Second half 2026"), mode: longPage, caption: "Confirmed, as the member sees it" },
        ],
      },
      {
        kind: "feature",
        title: "When confirmation is unavailable",
        roles: ["Member", "Career lead"],
        summary: "Save partial drafts freely. Confirmation needs a Contribution objective with a SMART goal and a review request matching the latest saved version.",
        tryIt: ["Try blank, no-goal and development-only drafts.", "View an unrequested draft as its career lead.", "Edit a requested focus without sending changes.", "Add missing content and send the latest version."],
        check: ["No unusable confirmation action or dialog is offered.", "Inline reasons say Contribution and work on phones.", "Sending the latest version restores eligibility.", "Direct ineligible attempts preserve the draft."],
        shots: [
          { id: "confirm-incomplete", persona: "lead", path: (ids) => "/?focus=" + ids.incompleteFocus, ready: heading("Morgan's unfinished draft"), caption: "Contribution objective needs a SMART goal" },
          { id: "confirm-unrequested", persona: "lead", device: "phone", path: (ids) => `/?page=department&member=${ids.member}&memberFocus=${ids.draftFocus}`, ready: heading("First half 2027"), caption: "Request the saved version first" },
          { id: "confirm-unsent", persona: "lead", path: (ids) => `/?page=department&member=${ids.peer}&memberFocus=${ids.staleReviewFocus}`, ready: heading("Changes not yet sent"), caption: "Send the latest saved changes" },
        ],
      },
      {
        kind: "feature",
        title: "Review and confirm your own focus",
        roles: ["Career lead"],
        summary: "Request review, then self-confirm immediately or later. Senior/manager discussion is optional; no second account, note or wait is required.",
        tryIt: ["Request your saved focus without a note.", "Open your focus in **Review requests**.", "Review and tick the self-review box.", "Confirm and reload; check your name and date."],
        check: ["Requesting leaves an editable draft.", "Request, ① note and lock copy fit self-review.", "After edits, send the latest version again.", "Members cannot self-confirm or read others’ requests."],
        shots: [
          { id: "own-review-request", persona: "lead", device: "phone", path: (ids) => "/?focus=" + ids.leadOwnRequestedFocus, act: click("Review & discussion"), ready: heading("Request review", 2), mode: { kind: "element", target: ".cp-request", padding: 0 }, highlight: ['role=textbox[name="Review note · optional"]'], caption: "Your own review request; a note is optional" },
          { id: "own-review-confirm", persona: "lead", path: "/?page=reviews", act: async (page) => { await ownReview(page); await page.getByRole("checkbox", { name: "I have reviewed this focus and am ready to confirm it.", exact: true }).check(); }, ready: role("button", "Confirm focus"), mode: { kind: "element", target: ".cp-confirm", padding: 24 }, caption: "Self-review before confirmation" },
        ],
      },
      {
        kind: "feature",
        title: "Record progress on a confirmed focus",
        roles: ["Member", "Career lead"],
        summary: "Members track statuses and notes for objectives and goals. Career leads can read them. Flag: focus-progress; hidden in production until released.",
        tryIt: ["Open a confirmed focus and select **Progress & notes**.", "Select **Add note** or **Edit progress** for an item.", "Choose a status, write a note, then save.", "Return to **Focus** to read the agreed wording."],
        check: ["Notes stay with their objective or goal.", "Status and note save or clear together.", "Leads read, not edit. Failed edits keep text.", "Phones can page or swipe objectives."],
        shots: [
          {id:"progress-activity",persona:"member",path:confirmed,act:click("Progress & notes"),ready:role("button","Progress & notes"),mode:longPage,caption:"Progress grouped by objective"},
          {id:"progress-edit",persona:"member",path:confirmed,act:click("Progress & notes","Edit progress"),ready:(p)=>p.getByRole("dialog"),mode:{kind:"viewport",...dialog},caption:"Edit status and note together"},
          {id:"phone-progress",persona:"member",device:"phone",path:confirmed,act:click("Progress & notes"),ready:(p)=>p.getByLabel("Read progress objectives"),caption:"Phone objective navigation"},
        ],
      },
      {
        kind: "feature",
        title: "Confirm from a position focus",
        roles: ["Career lead"],
        summary: "A lead can confirm only the current requested version with a Contribution objective and SMART goal. The dialog identifies whose focus will lock; no unlock is available.",
        tryIt: ["Open a current requested focus from Department.", "Choose **Confirm and lock**, then **Cancel**.", "Repeat with your own requested focus.", "Use fresh examples to complete each lock and reload."],
        check: [
          "Another member's dialog names that member.",
          "Your own wording does not imply two reviewers.",
          "Cancel preserves the draft; a completed lock survives reload.",
          "Confirmation retains the correct owner, confirmer and time.",
        ],
        shots: [
          {
            id: "member-confirm-dialog",
            persona: "lead",
            path: (ids) => `/?page=department&member=${ids.peer}&memberFocus=${ids.reviewFocus}`,
            act: click("Confirm and lock"),
            ready: (p) => p.getByRole("dialog"),
            mode: { kind: "viewport", ...dialog },
            caption: "Another member's focus",
          },
          {
            id: "own-confirm-dialog",
            persona: "lead",
            path: (ids) => "/?focus=" + ids.leadOwnRequestedFocus,
            act: click("Confirm and lock"),
            ready: (p) => p.getByRole("dialog"),
            mode: { kind: "viewport", ...dialog },
            caption: "Your own current requested focus",
          },
        ],
      },
    ],
  },
  {
    title: "Running a department",
    summary: "Career leads manage who is in their department, set its mission and strategic initiatives, and read members' focuses.",
    slides: [
      {
        kind: "feature",
        title: "People and their focuses",
        roles: ["Career lead"],
        summary: "Department → People lists current members in Name, Email and Role columns. Choosing a person shows their focuses, read-only.",
        tryIt: ["Open **Department**.", "Choose a member's ① name.", "Open one of their focuses."],
        check: [
          "Only current members of your department are listed.",
          "A lead from another department cannot open these focuses, even by URL.",
          "Members do not see the Department page.",
        ],
        shots: [
          { id: "department-people", persona: "lead", path: "/?page=department", ready: heading("Department"), highlight: ['role=button[name="Aroha Ngata"]'], caption: "People" },
          { id: "department-member", persona: "lead", path: "/?page=department", act: click("Aroha Ngata"), ready: heading("Aroha Ngata’s position focuses"), caption: "A member's focuses" },
        ],
      },
      {
        kind: "feature",
        title: "Add a registered user",
        roles: ["Career lead"],
        summary: "People sign in first; the career lead then adds them from registered users, listed by email, membership and availability. Roles cannot be chosen here.",
        tryIt: ["Ask the new person to sign in once.", "Choose **Add user** and find them.", "Add them to the department."],
        check: [
          "The person appears under People and can open Position focuses.",
          "People in another department cannot be added.",
          "Former members cannot currently rejoin.",
          "Account repair required means an administrator must resolve the duplicate before it can be added.",
        ],
        shots: [{ id: "department-add", persona: "lead", path: "/?page=department", act: click("Add user"), ready: heading("Add a registered user", 2), mode: longPage, caption: "Add user" }],
      },
      {
        kind: "feature",
        title: "Mission and strategic initiatives",
        roles: ["Career lead"],
        summary: "The mission appears on every member's home screen. Initiatives are what members link objectives to. Changes apply only after **Save changes**.",
        tryIt: ["Open **Department → Mission & initiatives**.", "Edit the ① mission and watch the preview.", "Add, edit, archive or restore an ② initiative, then save."],
        check: [
          "A blank mission hides the banner for members.",
          "Archived initiatives disappear from new choices; saved objectives keep them.",
          "Saving after someone else saved shows a conflict instead of overwriting.",
        ],
        shots: [{ id: "department-direction", persona: "lead", path: "/?page=department&departmentTab=direction", ready: heading("Strategic initiatives", 2), mode: longPage, highlight: ['role=textbox[name="Organizational mission"]', 'role=button[name="Add initiative"]'], caption: "Mission & initiatives" }],
      },
      {
        kind: "feature",
        title: "Edit an initiative",
        roles: ["Career lead"],
        summary: "Each initiative has a name, an optional description of up to 500 characters, and an icon and color from a preset palette.",
        tryIt: ["Choose **Edit** on an initiative.", "Change the description, icon or color.", "Close the dialog, then **Save changes**."],
        check: [
          "The Guide shows the new description.",
          "Badges on new objectives use the new icon and color.",
          "Confirmed focuses keep the names and appearance they were saved with.",
        ],
        shots: [{ id: "initiative-edit", persona: "lead", path: "/?page=department&departmentTab=direction", act: async (page) => { await page.getByRole("button", { name: /^Edit Love What We Build/ }).first().click(); }, ready: (p) => p.getByRole("dialog").first(), mode: { kind: "frames", ...dialog }, caption: "Edit initiative" }],
      },
      {
        kind: "feature",
        title: "Change the mission image",
        roles: ["Career lead"],
        summary: "The mission card can show the default illustration, an uploaded PNG, JPEG or WebP, or no image.",
        tryIt: ["Choose **Change image** on the preview.", "Upload an image under 10 MB, restore the default, or remove it.", "Choose **Save changes**."],
        check: [
          "The whole image shows, without cropping or stretching.",
          "Cancel discards a pending image.",
          "Very large or non-image files are refused with a message.",
        ],
        shots: [{ id: "mission-image", persona: "lead", path: "/?page=department&departmentTab=direction", act: click("Change image"), ready: (p) => p.getByRole("dialog").first(), mode: { kind: "viewport", ...dialog }, caption: "Change image" }],
      },
    ],
  },
  {
    title: "The Guide",
    summary: "The Guide explains the process and good writing, with examples and the department's strategic initiatives. It is optional reading for members.",
    slides: [
      {
        kind: "feature",
        title: "Start here",
        roles: ["Member", "Career lead"],
        summary: "The first topic shows the draft → request review → agreement → confirmation process and how to choose initiatives.",
        tryIt: ["Open **Guide** in the sidebar.", "Read **Start here**.", "Move between topics with the topic buttons."],
        check: ["Each topic opens without reloading the page.", "The first-focus prompt on Position focuses opens this topic.", "Text is readable at 200% browser zoom."],
        shots: [{ id: "guide-start", persona: "member", path: "/?page=guide", ready: heading("Your first position focus"), mode: longPage, caption: "Start here" }],
      },
      {
        kind: "feature",
        title: "Writing lessons and examples",
        roles: ["Member"],
        summary: "Objectives and SMART goals each have a lesson with common problems. Example offers a simple and an engineering focus.",
        tryIt: ["Open **Objectives**, then **SMART goals**.", "Open **Example** and switch between the two examples."],
        check: ["Lesson steps move forward and back.", "Example badges use the team's initiative icons and colors."],
        shots: [
          { id: "guide-objectives", persona: "member", path: "/?page=guide", act: click("Objectives"), ready: role("button", "Objectives"), caption: "Objectives lesson" },
          { id: "guide-example", persona: "member", path: "/?page=guide", act: click("Example"), ready: role("button", "Example"), caption: "Example" },
        ],
      },
      {
        kind: "feature",
        title: "Strategic initiatives",
        roles: ["Member", "Career lead"],
        summary: "Strategic initiatives lists the department’s active initiatives with their current descriptions.",
        tryIt: ["Open **Strategic initiatives** and choose an initiative."],
        check: ["Archived initiatives are not listed.", "A missing description shows a clear empty state."],
        shots: [
          { id: "guide-initiatives", persona: "member", path: "/?page=guide", act: click("Strategic initiatives"), ready: role("button", "Strategic initiatives"), caption: "Strategic initiatives" },
        ],
      },
      {
        kind: "feature",
        title: "Two cycles, preserved history",
        roles: ["Member", "Career lead"],
        summary: "Each cycle has confirmation, a mid-cycle check-in and an end-cycle review. Then deliberately create a new focus with carryovers and/or new goals; the previous focus stays locked.",
        tryIt: ["Open **Procedures → The year**.", "Read **Agree a focus**, including offline and self-review.", "Read **Make a change** on desktop and phone."],
        check: ["Both cycles show check-in, end review and a new focus.", "Agreement still requires a current-version request.", "Mid-cycle changes and lock recovery await a decision after all first submissions (Dec 2026–Jan 2027).", "No unlock, automatic carryover or cycle tooling is promised."],
        shots: [
          { id: "guide-year", persona: "member", path: "/?page=guide", act: click("Procedures", "The year"), ready: heading("The year", 2), mode: { kind: "element", target: ".procedure-year", padding: 16 }, caption: "Two full cycles per year" },
          { id: "guide-agree", persona: "lead", path: "/?page=guide", act: click("Procedures", "Agree a focus"), ready: (p) => p.getByRole("list", { name: "Agree a focus", exact: true }), mode: { kind: "element", target: ".procedure-flow-panel", padding: 16 }, caption: "Request before confirmation" },
          { id: "guide-procedures", persona: "member", device: "phone", path: "/?page=guide", act: click("Procedures", "Make a change"), ready: heading("Confirmed focuses stay locked.", 2), mode: { kind: "element", target: ".procedure-flow-panel", padding: 16 }, caption: "Confirmed history stays locked" },
        ],
      },
    ],
  },
  {
    title: "Phones",
    summary: "Lantern supports phones from 320 px wide. Phone layouts put the member's current task first and show one objective at a time.",
    slides: [
      {
        kind: "feature",
        title: "Reading a focus on a phone",
        roles: ["Member"],
        summary: "On a phone, objectives are read one at a time. Swipe, the objective picker, or **Previous / Next** move between them.",
        tryIt: ["Open a focus with several objectives on a phone.", "Swipe left and right, then use Previous / Next.", "Rotate the phone."],
        check: ["The current objective number matches the picker.", "Buttons are never hidden behind the bottom bar.", "Rotating keeps your place and any unsaved input."],
        shots: [{ id: "phone-focus", persona: "member", device: "phone", path: draft, ready: heading("First half 2027"), mode: { kind: "frames" }, caption: "Draft focus" }],
      },
      {
        kind: "feature",
        title: "Writing on a phone",
        roles: ["Member"],
        summary: "Objective writing scrolls as one page on a phone, with Save and Cancel always reachable.",
        tryIt: ["Choose **Edit objective** on a phone.", "Type with the on-screen keyboard.", "Save the objective."],
        check: ["The keyboard does not cover the field you are typing in.", "Save and Cancel stay reachable.", "Date pickers use the phone's native picker."],
        shots: [{ id: "phone-objective", persona: "member", device: "phone", path: draft, act: click("Edit objective"), ready: heading("Edit objective"), mode: { kind: "frames", maxFrames: 5 }, caption: "Edit objective" }],
      },
    ],
  },
  {
    title: "Feature flag operations",
    summary: "The configured owner can inspect the current environment's flag states after signing in.",
    slides: [{
      kind: "feature",
      title: "Inspect feature flags",
      roles: ["Configured owner"],
      summary: "The read-only page lists each registered feature as off, preview or on. Preview email addresses are not shown.",
      tryIt: ["Sign in as the configured owner with active department membership.", "Open **/ops/feature-flags** in this environment."],
      check: ["Registered flags show their current states.", "A different member or signed-out visitor cannot open the page.", "Railway remains the place to change a flag."],
      shots: [{ id: "feature-flags-owner", persona: "lead", path: "/ops/feature-flags", ready: heading("Feature flags"), mode: { kind: "element", target: "main", padding: 16 }, caption: "Owner-only flag states" }],
    }],
  },
  {
    title: "What to test by hand",
    summary: "Automated tests cover the main journeys with synthetic accounts. These areas need a person, a real account or a real device.",
    slides: [
      {
        kind: "checklist",
        title: "Checks the automated tests cannot make",
        lead: "Please spend most of your time here. Record each result, with your device and browser, in the QA results sheet.",
        items: [
          { title: "Real Jesus Film sign-in", text: "Approved and unapproved accounts, cancelling at Jesus Film Auth, signing in on a second device, signing out." },
          { title: "Joining a department", text: "A brand-new account signs in, the career lead adds it, and Check access opens the workspace." },
          { title: "AI guidance with the real model", text: "Useful suggestions, slow replies, cancelling, and the message when the AI cannot reply." },
          { title: "Real phones", text: "iOS and Android keyboards, date pickers, rotation, browser bars and enlarged text." },
          { title: "Zoom and text size", text: "Desktop browser zoom to 200% and enlarged system text on every main screen." },
          { title: "Two tabs, one focus", text: "Edit the same focus in two tabs; the second save must be refused without losing your text." },
        ],
      },
      {
        kind: "checklist",
        title: "Reporting a problem",
        lead: "Open an issue at github.com/JesusFilm/lantern/issues with enough detail for someone else to repeat it.",
        items: [
          { title: "What you did", text: "Numbered steps from a known screen, as in the Try it lists." },
          { title: "Expected and actual", text: "Quote the Check item that failed, and what happened instead." },
          { title: "Who and where", text: "Your role and test account, device, browser and screen size." },
          { title: "Manual reference", text: "The manual edition and page number." },
          { title: "Evidence", text: "A screenshot or short recording, with only test data visible." },
          { title: "Severity", text: "Blocks team drafting, has a workaround, or cosmetic." },
        ],
      },
    ],
  },
];

export const supplied: Supplied[] = allShots(chapters).filter(isSupplied);
export const shots: Shot[] = allShots(chapters).filter((s): s is Shot => !isSupplied(s));

