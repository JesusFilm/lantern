export interface GuideSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  example?: { label: string; text: string };
  prompt?: string;
}
export interface Walkthrough {
  title: string;
  description: string;
  steps: GuideSection[];
}
export interface GuideContent {
  context: { mission?: string; departmentContribution?: string };
  objectives: Walkthrough;
  smart: Walkthrough;
  example: { title: string; introduction: string; sections: GuideSection[] };
}
