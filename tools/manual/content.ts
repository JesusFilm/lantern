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
const draft = (ids: { draftFocus: string }) => "/?focus=" + ids.draftFocus;
/** Long desktop pages: scroll frames cropped to the content column, so text stays legible on a slide. */
const longPage = { kind: "frames", crop: ".workspace", maxFrames: 3 } as const;
const dialog = { crop: "role=dialog", cropPadding: 0 } as const;
const confirmed = (ids: { confirmedFocus: string }) => "/?focus=" + ids.confirmedFocus;

const googleSignIn: Supplied = {
  id: "google-account-chooser",
  file: "google-account-chooser.png",
  sources: ["server/google.ts", "server/access.ts", "server/admission.ts", "server/accounts.ts"],
  caption: "Google account chooser",
  instructions: "On staging, choose Sign in with Google and capture Google's account chooser in a 1440 × 900 window.",
};
const guided = async (page: Page) => {
  await click("+ Add objective", "Guide with AI")(page);
  await page.getByLabel("Your work", { exact: true }).fill("I look after our deployment pipeline. When deployments fail, engineers often lose hours working out why.");
};
const planGoal = async (page: Page) => {
  await guided(page);
  await click("Next", "Next", "Add SMART goal")(page);
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
        lead: "The screenshots follow five fictional people in a local demonstration. QA uses their own Google accounts in the staging QA department.",
        people: [
          { name: "Aroha Ngata", role: "Member · Engineering", text: "Has a confirmed focus for the second half of 2026 and is drafting one for 2027." },
          { name: "Sam Patel", role: "Member · Engineering", text: "Has sent two versions of a focus to the career lead for review." },
          { name: "Morgan Lee", role: "Career lead · Engineering", text: "Reviews and confirms Engineering's focuses and manages the department." },
          { name: "Riley Chen", role: "Career lead · Design", text: "Leads a different department and must not see Engineering's focuses." },
          { name: "Casey Brown", role: "No department yet", text: "Has signed in but is waiting for a career lead to add them." },
        ],
      },
    ],
  },
  {
    title: "Signing in and your account",
    summary: "Lantern uses Google sign-in. An approved account then needs a career lead to add it to a department.",
    slides: [
      {
        kind: "feature",
        title: "Sign in with Google",
        roles: ["Signed out"],
        summary: "Signed-out visitors see only the welcome screen. Only approved Google accounts can sign in.",
        tryIt: ["Open the staging address in a private window.", "Choose ① **Sign in with Google**.", "Pick your test Google account and allow access."],
        check: [
          "You return to Lantern signed in, with your name in the sidebar.",
          "An account that is not approved returns to the welcome screen with “Sign-in could not be completed”.",
          "Cancelling at Google also returns with that message.",
          "Reloading keeps you signed in.",
        ],
        shots: [
          { id: "sign-in", persona: "anonymous", ready: role("link", "Sign in with Google"), highlight: ['role=link[name="Sign in with Google"]'], caption: "Welcome screen" },
          googleSignIn,
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
        summary: "Guided writing moves through **Your work → Objective → SMART goals → Check objective**. The member describes their work; the AI proposes wording and initiatives to accept or change.",
        tryIt: ["Choose **+ Add objective**, then **Guide with AI**.", "Describe your work in a sentence or two.", "Choose **Next** and review the suggestion."],
        check: [
          "AI recommendations are labelled and never selected for you.",
          "Back returns to earlier stages with your text intact.",
          "A slow reply shows a loading overlay you can cancel.",
        ],
        shots: [
          { id: "guided-work", persona: "member", path: draft, act: guided, ready: (p) => p.getByLabel("Your work", { exact: true }), caption: "Your work" },
          { id: "guided-objective", persona: "member", path: draft, act: async (page) => { await guided(page); await click("Next")(page); }, ready: (p) => p.getByText("AI recommended").first(), mode: longPage, caption: "Suggested objective" },
        ],
      },
      {
        kind: "feature",
        title: "Guide with AI: goals and final check",
        roles: ["Member"],
        summary: "For each goal the AI suggests ① actions and a target date, then drafts the goal wording to check. Nothing is saved until **Save objective**.",
        tryIt: ["At SMART goals, choose **Add SMART goal**.", "Pick or write an action and date, then **Next**.", "Edit the goal, **Add to objective**, then **Next** to the check."],
        check: [
          "Saved wording matches what you saw, including your edits.",
          "If the AI cannot reply, a message explains you can continue manually.",
          "Your text is kept when you switch to Write myself.",
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
    summary: "A member sends a saved version for review. The member and career lead discuss it in notes, and the career lead confirms and locks the agreed focus.",
    slides: [
      {
        kind: "feature",
        title: "Ask your career lead for a review",
        roles: ["Member"],
        summary: "**Review & discussion** shows the focus read-only, with a request form and the notes. Saving alone never sends a review request.",
        tryIt: ["Open a draft with a Contribution objective and at least one goal.", "Choose **Review & discussion**.", "Add an optional ① note and choose ② **Send request**."],
        check: [
          "The career lead sees the request under Review requests.",
          "A focus without a Contribution objective and goal cannot be sent.",
          "After further edits you can send the newer version.",
        ],
        shots: [{ id: "review-request", persona: "member", path: draft, act: click("Review & discussion"), ready: heading("Request review", 2), mode: longPage, highlight: ['role=textbox[name="Note to career lead · optional"]', 'role=button[name="Send request"]'], caption: "Review & discussion" }],
      },
      {
        kind: "feature",
        title: "Review requests",
        roles: ["Career lead"],
        summary: "Career leads see every review request in their department, with its status and whether there are new notes.",
        tryIt: ["Sign in as the career lead.", "Open **Review requests**.", "Choose ① **Review focus**."],
        check: [
          "Only your department's members appear.",
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
        shots: [{ id: "lead-review", persona: "lead", path: "/?page=reviews", act: click("Review focus"), ready: heading("Changes since previous request", 2), mode: longPage, highlight: ['role=heading[name="Changes since previous request"]', 'role=button[name="+ Add note"]'], caption: "Reviewing Sam's request" }],
      },
      {
        kind: "feature",
        title: "Confirm and lock a focus",
        roles: ["Career lead"],
        summary: "After the conversation, the career lead ticks ① the agreement box and ② confirms. The focus and its notes become read-only for both people.",
        tryIt: ["In a review, tick **We have discussed and agreed this focus.**", "Choose **Confirm focus**.", "Open the focus as the member."],
        check: [
          "The member sees Confirmed by the lead, with the date.",
          "No edit, add or remove actions remain for either person.",
          "Confirming an older version than the latest request is refused.",
        ],
        shots: [
          {
            id: "lead-confirm",
            persona: "lead",
            path: "/?page=reviews",
            act: async (page) => { await click("Review focus")(page); await page.getByRole("checkbox", { name: "We have discussed and agreed this focus." }).check(); },
            ready: role("button", "Confirm focus"),
            mode: { kind: "element", target: (p) => p.getByRole("button", { name: "Confirm focus" }).locator("xpath=.."), padding: 24 },
            highlight: ['role=checkbox[name="We have discussed and agreed this focus."]', 'role=button[name="Confirm focus"]'],
            caption: "Ready to confirm",
          },
          { id: "focus-confirmed", persona: "member", path: confirmed, ready: heading("Second half 2026"), mode: longPage, caption: "Confirmed, as the member sees it" },
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
        summary: "Department → People lists current members. Choosing a person shows their focuses, read-only.",
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
        summary: "People sign in first; the career lead then adds them from the list of registered users. Roles cannot be chosen here.",
        tryIt: ["Ask the new person to sign in once.", "Choose **Add user** and find them.", "Add them to the department."],
        check: [
          "The person appears under People and can open Position focuses.",
          "People in another department cannot be added.",
          "Former members cannot currently rejoin.",
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
        summary: "The first topic shows the draft → conversation → confirmation process and how to choose initiatives.",
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
        title: "Strategic initiatives and procedures",
        roles: ["Member", "Career lead"],
        summary: "Strategic initiatives lists the department's active initiatives with their current descriptions. Procedures outlines the yearly rhythm (marked Proposed).",
        tryIt: ["Open **Strategic initiatives** and choose an initiative.", "Open **Procedures** and its three steps."],
        check: ["Archived initiatives are not listed.", "A missing description shows a clear empty state.", "Procedures screens show the Proposed label."],
        shots: [
          { id: "guide-initiatives", persona: "member", path: "/?page=guide", act: click("Strategic initiatives"), ready: role("button", "Strategic initiatives"), caption: "Strategic initiatives" },
          { id: "guide-procedures", persona: "member", path: "/?page=guide", act: click("Procedures"), ready: role("button", "Procedures"), caption: "Procedures" },
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
    title: "What to test by hand",
    summary: "Automated tests cover the main journeys with synthetic accounts. These areas need a person, a real account or a real device.",
    slides: [
      {
        kind: "checklist",
        title: "Checks the automated tests cannot make",
        lead: "Please spend most of your time here. Record each result, with your device and browser, in the QA results sheet.",
        items: [
          { title: "Real Google sign-in", text: "Approved and unapproved accounts, cancelling at Google, signing in on a second device, signing out." },
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

