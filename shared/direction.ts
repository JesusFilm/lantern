import type { InitiativeAppearance } from "./initiative-appearance.js";

export const maxInitiativeDescriptionLength = 500;

export interface StrategicInitiative {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  appearance?: InitiativeAppearance;
}

export interface DepartmentDirection {
  mission: string;
  missionImage?: string | null;
  initiatives: StrategicInitiative[];
  version: number;
}

export interface DirectionDraft {
  mission: string;
  missionImage?: string | null;
  initiatives: Array<Omit<StrategicInitiative, "id"> & { id?: string }>;
  version: number;
}
