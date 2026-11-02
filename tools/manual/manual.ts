import type { Locator, Page } from "@playwright/test";
import type { CaptureMode, Device, Target } from "./capture.js";
import type { SuppliedCapture } from "./freshness.js";
import type { ManualWorld, Persona } from "./world.js";

export type Ids = ManualWorld["ids"];
export type Role = "Anyone" | "Member" | "Career lead" | "Signed out";

/** A screenshot taken automatically from the synthetic world. */
export interface Shot {
  /** Screenshot file stem; frames add -1, -2, … */
  id: string;
  persona: Persona | "anonymous";
  device?: Device;
  path?: string | ((ids: Ids) => string);
  /** Interactions that reach the photographed state. */
  act?: (page: Page, ids: Ids) => Promise<void>;
  /** Must be visible before the screen is photographed. */
  ready: (page: Page) => Locator;
  mode?: CaptureMode;
  /** Numbered callouts, referenced from the slide text as ①, ②, … */
  highlight?: Target[];
  caption: string;
  /** Saves data; the world is rebuilt afterwards so later shots are unaffected. */
  mutates?: boolean;
}

/** A screenshot a person takes, for steps the synthetic world cannot reach. */
export interface Supplied extends SuppliedCapture {
  caption: string;
  /** How to take the screenshot. */
  instructions: string;
}

export type Slide =
  | { kind: "intro"; title: string; lead: string; points: Array<{ title: string; text: string }> }
  | { kind: "people"; title: string; lead: string; people: Array<{ name: string; role: string; text: string }> }
  | {
      kind: "feature";
      title: string;
      roles: Role[];
      summary: string;
      tryIt: string[];
      check: string[];
      shots: Array<Shot | Supplied>;
    }
  | { kind: "checklist"; title: string; lead: string; items: Array<{ title: string; text: string }> };

export interface Chapter {
  title: string;
  summary: string;
  slides: Slide[];
}

export const isSupplied = (shot: Shot | Supplied): shot is Supplied => "file" in shot;
export const allShots = (chapters: Chapter[]) =>
  chapters.flatMap((chapter) => chapter.slides.flatMap((slide) => (slide.kind === "feature" ? slide.shots : [])));

