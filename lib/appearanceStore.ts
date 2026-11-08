import { DEFAULT_APPEARANCE, KEY, isAppearance, type Appearance } from "./appearance";
import { createLocalStore } from "./localStore";

export const appearance = createLocalStore<Appearance>(KEY, DEFAULT_APPEARANCE, isAppearance);
