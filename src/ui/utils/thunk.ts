import { ProtocolClient } from "@replayio/protocol";
import type { ThreadFront } from "protocol/thread";
import { ReplayClientInterface } from "shared/client/types";
import type {
  getCachedObject,
  getObjectThrows,
  getObjectWithPreviewHelper,
  getObjectPropertyHelper,
} from "bvaughn-architecture-demo/src/suspense/ObjectPreviews";

interface SuspenseObjectCache {
  getCachedObject: typeof getCachedObject;
  getObjectThrows: typeof getObjectThrows;
  getObjectWithPreviewHelper: typeof getObjectWithPreviewHelper;
  getObjectPropertyHelper: typeof getObjectPropertyHelper;
}

export interface ThunkExtraArgs {
  ThreadFront: typeof ThreadFront;
  replayClient: ReplayClientInterface;
  protocolClient: ProtocolClient;
  objectCache: SuspenseObjectCache;
}

export const extraThunkArgs = {} as ThunkExtraArgs;
