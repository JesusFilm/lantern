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
const guideExisting = async (page: Page) => {
  await page.locator(".read-section").first().getByRole("button", { name: "Guide with AI", exact: true }).click();
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
          "The retry screen offers sign-in, without an Account navigation item.",
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
        tryIt: ["Open **Account** in the sidebar.", "Edit ① **Display name** directly; wait for it to save.", "Choose ② **Sign out**."],
        check: [
          "The new name appears in the sidebar and survives a reload.",
          "Your career lead sees the new name in Department → People.",
          "After signing out, Back does not show your data.",
        ],
        shots: [
          { id: "account", persona: "member", path: "/?page=account", ready: heading("Account"), highlight: ['role=textbox[name="Display name"]', 'role=button[name="Sign out"]'], caption: "Profile" },
          { id: "account-edit-name", persona: "member", path: "/?page=account", act: async (p) => { await p.getByLabel("Display name", {exact:true}).focus(); }, ready: (p) => p.getByLabel("Display name").first(), caption: "Editing the display name" },
        ],
      },
      {
        kind: "feature",
        title: "Appearance",
        roles: ["Member", "Career lead"],
        summary: "Choose Light, Dark or System in Account. System follows your device's color setting.",
        tryIt: ["Open **Account**.", "Choose ① **Light**, **Dark** or **System** under Appearance.", "Reload the page."],
        check: ["The chosen mode is remembered in this browser.", "System follows changes to the device setting.", "Clearing browser storage resets the choice to System."],
        shots: [{ id: "account-appearance", persona: "member", path: "/?page=account", ready: role("group", "Appearance"), highlight: ['role=group[name="Appearance"]'], caption: "Appearance settings" }],
      },
    ],
  },
  {
    title: "Weekly goals and team updates",
    summary: "Plan weekly work, record a daily update and read the team's dated snapshots. My week and My team are available to every active member. Optional controls have separate flags.",
    slides: [
      {kind:"feature",title:"My week",roles:["Member"],summary:"Updates opens first. Today’s update heading sits above the message card. Updates and weekly goals save automatically. Available to every active member.",
        tryIt:["Hover or tap the help icon beside **Today’s update**.","Set each goal’s status in **Today’s update**.","Open **Goals** beside the date to manage goals.","Pause for autosave, then reload."],
        check:["Goals, order, details and updates survive reload.","Update box starts at two lines and grows as you type.","Goals are due at week end; failed saves retain input."],
        shots:[{id:"weekly-plan",persona:"member",path:"/?page=week&week=2026-11-02",ready:(p)=>p.getByText("Publish the release recovery guide",{exact:true}).first(),mode:{kind:"viewport",crop:".workspace"},caption:"Weekly goals and daily update"}]},
      {kind:"feature",title:"Start a new daily update",roles:["Member"],summary:"Each goal keeps its latest status within the week. Each new day starts with a fresh message, including when the tab stays open overnight.",
        tryIt:["Mark one goal Done and another On track.","Open My week on the following day.","Use Goals to reopen a completed goal if needed."],
        check:["All four statuses carry forward until changed.","Earlier Done goals stay out of Today’s update.","Completed goals remain in Goals and original history.","Yesterday’s message is not copied into today."],
        shots:[{id:"weekly-next-day",persona:"member",path:"/?page=week&week=2026-11-02",act:async(p)=>{await p.clock.setFixedTime(new Date("2026-11-03T10:00:00+13:00"));await p.reload();},ready:(p)=>p.getByRole("region",{name:"Daily update",exact:true}).getByText("Tuesday, 3 Nov",{exact:true}),mode:{kind:"viewport",crop:".workspace"},caption:"A fresh message, carried status and no earlier completed goals"}]},
      {kind:"feature",title:"Recover an unfinished daily update",roles:["Member"],summary:"Midnight starts a fresh message while retaining any unfinished or failed update under its original date.",
        tryIt:["Leave an edit unsaved as the day changes.","Find **Unsaved previous updates** below the view.","Retry saving the original date’s update."],
        check:["The retained message and statuses stay readable.","A failed retry retains the draft and its error.","Retry saves the original day, preserving today’s text.","Leaving warns before discarding retained edits."],
        shots:[{id:"weekly-retained-update",persona:"member",path:"/?page=week&week=2026-11-02",act:async(p)=>{
          await p.clock.pauseAt(new Date("2026-11-02T23:59:59.700+13:00"));
          await p.getByRole("textbox",{name:"Daily update",exact:true}).fill("Final notes from Monday: the recovery guide is ready for review.");
          await p.getByRole("group",{name:"Status for Publish the release recovery guide",exact:true}).getByRole("radio",{name:"Blocked",exact:true}).check();
          await p.clock.setFixedTime(new Date("2026-11-03T10:00:00+13:00"));
          await p.evaluate(() => window.dispatchEvent(new Event("focus")));
          await p.getByRole("region",{name:"Unsaved previous updates",exact:true}).waitFor({state:"visible"});
          await p.clock.resume();
        },ready:(p)=>p.getByRole("region",{name:"Unsaved previous updates",exact:true}),mode:{kind:"element",target:'role=region[name="Unsaved previous updates"]',padding:8},caption:"Recover an unfinished update under its original date"}]},
      {kind:"feature",title:"Manage weekly goals",roles:["Member"],summary:"Updates and Goals sit beside the date. Use Goals to manage weekly work; switching tabs retains drafts and background saving continues.",
        tryIt:["Select **Goals** beside the date.","Add or rename goals; drag active goals to reorder.","Use the three dots for links, details and deletion.","Change a status here; compare it in **Updates**."],
        check:["Completed goals appear last and cannot be reordered.","Arrow keys switch tabs; drafts stay intact.","Titles and statuses retain failed edits for retry.","Save details applies; Cancel discards detail edits."],
        shots:[{id:"weekly-goal-management",persona:"member",path:"/?page=week&week=2026-11-02",act:async(p)=>{await p.getByRole("tab",{name:"Goals",exact:true}).click();},ready:(p)=>p.getByRole("tabpanel",{name:"Goals",exact:true}),caption:"Manage work on the Goals tab"}]},
      {kind:"feature",title:"Read previous daily updates",roles:["Member"],summary:"Previous updates sits below today’s entry in Updates. Open a date to read its saved message and goal-status snapshot.",
        tryIt:["Open a week with saved daily updates.","Scroll to **Previous updates**.","Open and close a dated entry."],
        check:["Newest days come first.","Past messages and goal snapshots stay unchanged.","Today’s message remains editable at the top."],
        shots:[{id:"weekly-history",persona:"member",path:"/?page=week&week=2026-10-26",mutates:true,
          act:async(p)=>{
            const origin=new URL(p.url()).origin, path="/api/weeks/2026-10-26";
            const response=await p.request.post(origin+path+"/plans",{headers:{Origin:origin},data:{version:0,goals:[{text:"Prepare the team demo",links:[]}]}});
            if(!response.ok()) throw new Error("Could not seed weekly history plan");
            const record=await response.json(),plan=record.plans.at(-1);
            for(const [date,body,status] of [["2026-10-29","Outlined the demo and agreed what feedback we need. Next I’ll prepare the walkthrough.","on-track"],["2026-10-30","The walkthrough is ready for review. I need a teammate to check the mobile flow.","done"]]){
              const saved=await p.request.post(origin+path+"/updates",{headers:{Origin:origin},data:{date,body,planVersion:plan.version,goalStatuses:[{goalId:plan.goals[0].id,status}]}});
              if(!saved.ok()) throw new Error("Could not seed daily history update");
            }
            await p.reload();await p.locator("details.week-day-entry").first().locator("summary").click();
          },ready:(p)=>p.getByRole("heading",{name:"Previous updates",exact:true}),mode:{kind:"viewport",crop:".workspace"},caption:"Read the last two saved daily updates"}]},
      {kind:"feature",title:"Plan ahead",roles:["Member"],summary:"Enter each week’s goals by hand, including recurring work. Goals do not repeat automatically.",
        tryIt:["Use Next week to plan ahead.","Open **Goals** and enter a goal.","Open the help icon beside **Weekly goals**.","Pause, then reload to check autosave."],
        check:["New weeks start empty; there is no copy control.","Goals persist in their own week.","Future weeks have no daily status editing."],
        shots:[{id:"weekly-empty-phone",persona:"member",device:"phone",path:"/?page=week&week=2026-11-09",act:async(p)=>{await p.getByRole("tab",{name:"Goals",exact:true}).click();},ready:role("textbox","Weekly goal 1"),caption:"Plan ahead with unselected statuses"}]},
      {kind:"feature",title:"Choose weekly goal visibility",roles:["Member","Career lead"],summary:"Flag: weekly-goal-privacy. Team is the default; daily updates always go to the team and TV.",
        tryIt:["Open **Goals**; click the visibility icon.","Choose Team, Me and my career lead, or Only me.","Reload; compare My team as a peer and lead.","Keep private details out of daily update text."],
        check:["Private titles, details, links and statuses stay hidden.","TV shows only team goals, even with a lead's token.","Historical snapshots respect later restrictions."],
        shots:[{id:"weekly-privacy",persona:"member",path:"/?page=week&week=2026-11-02",act:async(p)=>{await p.getByRole("tab",{name:"Goals",exact:true}).click();await p.getByRole("button",{name:"Visibility for goal 1: Team",exact:true}).click();},ready:(p)=>p.getByRole("menu",{name:"Visibility for goal 1",exact:true}),caption:"Choose who can read a weekly goal"}]},
      {kind:"feature",title:"Link weekly work to focus progress",roles:["Member"],summary:"Flag: weekly-focus-links. Confirmed objectives and SMART goals can be targets; drafts link to the whole focus.",
        tryIt:["Goals → Add link → Position focus; pick a target.","Open the focus and read Linked weekly work.","Review suggested progress; Cancel, then Save."],
        check:["On track → In progress; At risk/Blocked → Needs attention.","Done suggests Achieved; only Save changes progress.","Whole-focus links show work without a target suggestion."],
        shots:[{id:"weekly-link-target",persona:"member",path:"/?page=week&week=2026-11-02",act:async(p)=>{await p.getByRole("tab",{name:"Goals",exact:true}).click();await p.getByRole("button",{name:"Actions for goal 1",exact:true}).click();await p.getByRole("menuitem",{name:"Add link",exact:true}).click();await p.getByRole("button",{name:/Second half 2026/}).click();await p.getByLabel("Link to",{exact:true}).selectOption("goal:0:0");},ready:(p)=>p.getByLabel("Link to",{exact:true}),caption:"Choose a confirmed objective or SMART goal"},
          {id:"weekly-linked-work",persona:"member",path:confirmed,mutates:true,act:async(p,ids)=>{
            const call=async(path:string,method="GET",body?:unknown)=>{const response=await p.request.fetch(new URL(path,p.url()).href,{method,headers:{Origin:new URL(p.url()).origin},data:body});if(!response.ok())throw new Error(`Linked work fixture failed: ${response.status()}`);return response.json();};
            const focus=await call(`/api/focuses/${ids.confirmedFocus}`);
            const plan=await call("/api/weeks/2026-11-23/plans","POST",{version:0,goals:[{text:"Review the release recovery guide",links:[{kind:"focus",focusId:ids.confirmedFocus,target:{version:focus.version,section:0,goal:0}}]}]});
            await call("/api/weeks/2026-11-23/updates","POST",{date:"2026-11-23",body:"The guide is ready for review.",planVersion:plan.plans[0].version,goalStatuses:[{goalId:plan.plans[0].goals[0].id,status:"on-track"}]});
            await p.reload();
          },ready:(p)=>p.getByText("Review the release recovery guide",{exact:true}),mode:{kind:"element",target:'role=region[name="Linked weekly work"]'},caption:"Linked weekly work and suggested progress"}]},
      {kind:"feature",title:"My team",roles:["Member","Career lead"],summary:"Read active teammates' dated updates and their saved goal statuses. Available to every active member.",
        tryIt:["Open **My team**.","Move to an earlier date, then return to Today.","Compare the saved update and goal statuses."],
        check:["Only active teammates in your department appear.","Goals and statuses respect Team / Lead / Only me.","A failed request offers Retry."],
        shots:[{id:"team-updates",persona:"member",path:"/?page=team&date=2026-11-02",ready:(p)=>p.getByRole("heading",{name:"My team",exact:true}),mode:{kind:"viewport",crop:".workspace"},caption:"Dated team updates"}]},
      {kind:"feature",title:"Team API access",roles:["Member","Career lead"],summary:"Issue a read-only integration token for your department. Flag: team-api; hidden in production until released.",
        tryIt:["Open **Account → Team API access**.","Name and create a token; copy its one-time value privately.","Use it from the integration backend, then revoke it."],
        check:["Reload hides the full token; its name remains listed.","Revocation, expiry and ended membership stop access.","The token cannot edit data or read another department."],
        shots:[{id:"team-api-access",persona:"member",path:"/?page=account",ready:(p)=>p.getByRole("region",{name:"Team API access",exact:true}),mode:{kind:"element",target:"role=region[name=\"Team API access\"]"},caption:"Read-only integration tokens"}]},
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
        title: "Personal development and Leadership",
        roles: ["Member", "Career lead"],
        summary: "Development objectives are optional. Personal means your own growth, not private goals. Growth in work time should support your career, even beyond immediate work tasks.",
        tryIt: ["Edit an objective and open **About Personal development**.", "Read **About Leadership** and **Guide → Start here**."],
        check: ["Your career lead sees saved drafts, including both development types.", "The lead provides input and agrees development goals.", "Request review sends the whole focus for agreement and confirmation."],
        shots: [{ id: "objective-development-help", persona: "member", path: draft, act: click("Edit objective", "About Personal development", "About Leadership"), ready: role("button", "About Personal development"), mode: { kind: "element", target: ".objective-types", padding: 16 }, caption: "Development type help in the objective editor" }],
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
          "Not sure selects the recommendation, or asks you to choose.",
          "Update objective is primary; Clear details is spaced apart.",
          "Next requires an initiative or Other; edits make checks stale.",
          "Personal development counts your growth, without invented team benefits.",
        ],
        shots: [
          { id: "guided-work", persona: "member", path: draft, act: async (page) => { await guided(page); await click("Next", "Back")(page); }, ready: role("button", "Try again"), caption: "Return to your work to try again" },
          { id: "guided-objective", persona: "member", path: draft, act: async (page) => { await guided(page); await click("Next", "Help me address this")(page); await page.getByLabel("Details for the coach").fill("Engineers can find the cause of a failed deployment faster."); }, ready: (p) => p.getByText("Update objective or clear these details before continuing or saving."), mode: longPage, caption: "Pending coach details" },
        ],
      },
      {
        kind: "feature",
        title: "Guide with AI: objective type wording",
        roles: ["Member"],
        summary: "The coach uses the same objective type names as the editor. This path requires **coach** and **coach-redesign**.",
        tryIt: ["Choose **Guide with AI** and select Contribution.", "Describe work that develops a skill, then choose **Next**.", "Read the coach's question and feedback."],
        check: [
          "The coach says Contribution, Personal development or Leadership.",
          "It says Objective type when referring to the selected type.",
          "You can still choose a different type on the Objective step.",
        ],
        shots: [{ id: "guided-type-language", persona: "member", path: draft, act: async (page) => { await click("+ Add objective", "Guide with AI")(page); await page.getByRole("radio", { name: "Contribution", exact: true }).check(); await page.getByLabel("Your work", { exact: true }).fill("I want to improve my Playwright testing skills."); await click("Next")(page); }, ready: heading("Objective type is currently Contribution. I recommend Personal development. Which testing skills do you want to build?", 2), caption: "A question about objective type" }],
      },
      {
        kind: "feature",
        title: "Guide with AI: improve an existing objective",
        roles: ["Member"],
        summary: "Use **Guide with AI** on an existing objective. This path requires **coach** and **coach-redesign**.",
        tryIt: ["On a draft, choose **Guide with AI** beside an objective.", "Choose **Improve objective** and answer any question.", "Review the wording and use **Help me address this** for further details."],
        check: [
          "The answer can update the objective; checks match the wording shown.",
          "If the coach cannot improve it, it says so and keeps the editable wording.",
          "Feedback can be answered; Back keeps the earlier answer.",
        ],
        shots: [
          { id: "guided-existing-question", persona: "member", path: draft, act: async (page) => { await guideExisting(page); await click("Improve objective")(page); }, ready: (p) => p.getByLabel("Your answer"), mode: { kind: "viewport", crop: ".workspace" }, caption: "Answer a question about an existing objective" },
          { id: "guided-existing-feedback", persona: "member", path: draft, act: async (page) => { await guideExisting(page); await click("Improve objective")(page); await page.locator(".cp-coach-wait").waitFor({ state: "hidden" }); await page.getByLabel("Your answer").fill("I am not sure yet."); await click("Next")(page); }, ready: (p) => p.getByText("The coach could not improve this objective yet.", { exact: false }), mode: { kind: "element", target: 'role=region[name="AI coach feedback"]' }, caption: "Feedback when the objective could not be improved" },
        ],
      },
      {
        kind: "feature",
        title: "Guide with AI: goals and final check",
        roles: ["Member"],
        summary: "**coach-redesign** suggests goal ideas immediately. Check the finished draft before saving. Hidden in production until released; requires **coach**.",
        tryIt: ["At SMART goals, select an idea or **Add SMART goal**.", "Pick or write an action and date, then **Next**.", "Edit the goal, **Add to objective**, then **Next** to the check."],
        check: [
          "Target dates must be today or later, within the focus period.",
          "Answer \"not sure\" about evidence: you still get an editable goal.",
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
        summary: "Saved drafts, including Personal development and Leadership, are visible to your career lead. **Review & discussion** sends the whole focus; saving alone never requests review.",
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
        title: "Send changes for review",
        roles: ["Member", "Career lead"],
        summary: "After you change a requested focus, the draft explains how to send the latest saved version again.",
        tryIt: ["Request review, then edit and save the focus.", "Choose **Review & discussion**, then **Send changes for review**."],
        check: ["Changes not sent and the resend guidance appear on the draft.", "Sending the latest version clears the guidance and restores confirmation eligibility."],
        shots: [{ id: "owner-unsent-review", persona: "peer", path: (ids) => "/?focus=" + ids.staleReviewFocus, ready: heading("Changes not yet sent"), mode: { kind: "element", target: ".focus-review-actions", padding: 16 }, caption: "Send the latest saved version" }],
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
        summary: "Career leads see department review requests and unread counts. **review-activity** is hidden in production until released.",
        tryIt: ["Sign in as the career lead.", "Open **Review requests**.", "Choose ① **Review focus**."],
        check: [
          "New activity appears above previously viewed requests.",
          "Count stays visible when the sidebar is collapsed.",
          "Only your department appears, including your own requested focus.",
          "Opening a review clears its New marker and notes.",
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
        summary: "Members track statuses and notes for objectives and goals. Career leads can read them. Flag: focus-progress.",
        tryIt: ["Open a confirmed focus and select **Progress & notes**.", "Select **Add note** or **Edit progress** for an item.", "Choose a status, write a note, then save.", "Return to **Focus** to read the agreed wording."],
        check: ["Status and note save or clear together.", "Lost replies retry safely and reload progress.", "Cancel does not send an unsent edit.", "Conflicts keep edits; leads read only; phones page or swipe."],
        shots: [
          {id:"progress-activity",persona:"member",path:confirmed,act:click("Progress & notes"),ready:role("button","Progress & notes"),mode:longPage,caption:"Progress grouped by objective"},
          {id:"progress-edit",persona:"member",path:confirmed,act:click("Progress & notes","Edit progress"),ready:(p)=>p.getByRole("dialog"),mode:{kind:"viewport",...dialog},caption:"Edit status and note together"},
          {id:"phone-progress",persona:"member",device:"phone",path:confirmed,act:click("Progress & notes"),ready:(p)=>p.getByLabel("Read progress objectives"),caption:"Phone objective navigation"},
        ],
      },
      {
        kind: "feature",
        title: "Read progress from a review request",
        roles: ["Career lead"],
        summary: "Confirmed requests show the member's current progress alongside the locked review discussion.",
        tryIt: ["Open **Review requests** and review a confirmed focus.", "Check status badges in **Focus**.", "Choose ① **Progress & notes** to read the member's notes."],
        check: ["Statuses and notes match the Department view.", "The lead cannot edit another member's progress.", "Earlier draft snapshots do not show current statuses."],
        shots: [{ id: "lead-review-progress", persona: "lead", path: "/?page=reviews", act: async (page) => { await openReview("Aroha Ngata · Second half 2026")(page); await click("Progress & notes")(page); }, ready: (page) => page.getByText("The runbook draft is ready for the team's feedback.", { exact: true }), mode: { kind: "viewport", crop: ".workspace" }, highlight: ['role=button[name="Progress & notes"]'], caption: "Progress in a confirmed request" }],
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
        summary: "The first topic explains the process, initiative choices, draft visibility and why the career lead agrees development goals pursued in work time.",
        tryIt: ["Open **Guide** in the sidebar.", "Read **Start here**.", "Move between topics with the topic buttons."],
        check: ["Personal means your own growth, not private goals.", "Saved development drafts are visible; review sends the whole focus.", "The first-focus prompt opens this topic; text is readable at 200% zoom."],
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
        tryIt: ["Open **Procedures → The year**.", "Open **Agree a focus** on desktop and phone."],
        check: ["Both cycles show check-in, end review and a new focus.", "The agreement flow explains repeat review, self-review and offline agreement.", "The year diagram has a padded border and no extra paragraph.", "There is no separate Make a change section."],
        shots: [
          { id: "guide-year", persona: "member", path: "/?page=guide", act: click("Procedures", "The year"), ready: heading("The year", 2), mode: { kind: "element", target: ".procedure-year", padding: 16 }, caption: "Two full cycles per year" },
          { id: "guide-agree", persona: "lead", path: "/?page=guide", act: click("Procedures", "Agree a focus"), ready: (p) => p.getByRole("list", { name: "Agree a focus", exact: true }), mode: { kind: "element", target: ".procedure-flow-panel", padding: 16 }, caption: "Request before confirmation" },
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

