import type { InitiativeAppearance } from "./initiative-appearance.js";

export interface StrategicInitiative {
  id: string;
  name: string;
  archived: boolean;
  appearance?: InitiativeAppearance;
}

export interface DepartmentDirection {
  mission: string;
  initiatives: StrategicInitiative[];
  version: number;
}

export interface DirectionDraft {
  mission: string;
  initiatives: Array<Omit<StrategicInitiative, "id"> & { id?: string }>;
  version: number;
}

export interface ObjectiveAlignment {
  initiatives: Array<Pick<StrategicInitiative, "id" | "name" | "appearance">>;
  other: boolean;
}
