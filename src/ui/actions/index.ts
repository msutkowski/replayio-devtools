import { Action, Store, ThunkAction, AnyAction } from "@reduxjs/toolkit";

import type { AppStore } from "ui/setup/store";

import * as appActions from "./app";
import * as timelineActions from "./timeline";
import * as sessionActions from "./session";
import * as commentsActions from "./comments";
import * as layoutActions from "./layout";
import * as reactDevToolsActions from "./reactDevTools";
import { ThunkExtraArgs } from "ui/utils/thunk";
import { UIState } from "ui/state";
import { ReactDevToolsAction } from "./reactDevTools";
import debuggerActions from "devtools/client/debugger/src/actions";
import { QuickOpenActions } from "devtools/client/debugger/src/actions/quick-open";
import { NetworkAction } from "./network";
import { LayoutAction } from "./layout";

export type UIAction = LayoutAction | NetworkAction | ReactDevToolsAction | QuickOpenActions;

export type UIThunkAction<TReturn = void> = ThunkAction<
  TReturn,
  UIState,
  ThunkExtraArgs,
  AnyAction
>;

export type UIStore = AppStore;

const { initialAppState, ...actualAppActions } = appActions;

export const actions = {
  ...actualAppActions,
  ...commentsActions,
  ...debuggerActions,
  ...layoutActions,
  ...reactDevToolsActions,
  ...sessionActions,
  ...timelineActions,
};
