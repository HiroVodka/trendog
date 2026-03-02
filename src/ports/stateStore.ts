import { AppState } from "../domain/model.js";

export interface StateStore {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
}
