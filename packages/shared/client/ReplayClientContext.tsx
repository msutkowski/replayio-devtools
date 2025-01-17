import { createContext } from "react";
import { createReplayClientForProduction } from "shared/utils/client";

import { ReplayClientInterface } from "./types";

export type ReplayClientContextType = ReplayClientInterface;

export const replayClient = createReplayClientForProduction();
export const ReplayClientContext = createContext<ReplayClientContextType>(replayClient);
