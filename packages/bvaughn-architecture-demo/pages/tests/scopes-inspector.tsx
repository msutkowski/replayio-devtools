import Inspector from "@bvaughn/components/inspector";
import ScopesInspector from "@bvaughn/components/inspector/ScopesInspector";
import Loader from "@bvaughn/components/Loader";
import { getObjectWithPreview } from "@bvaughn/src/suspense/ObjectPreviews";
import { evaluate, getPauseForExecutionPoint } from "@bvaughn/src/suspense/PauseCache";
import { getClosestPointForTime } from "@bvaughn/src/suspense/PointsCache";
import { Suspense, useContext } from "react";
import { ReplayClientContext } from "shared/client/ReplayClientContext";

import styles from "./styles.module.css";
import createTest from "./utils/createTest";

const DEFAULT_RECORDING_ID = "9fd8381f-05e6-40c2-8b4f-59e40c2c3886";

function Scopes() {
  return (
    <div className={styles.Grid1Column}>
      <div className={styles.HorizontalContainer}>
        <Suspense fallback={<Loader />}>
          <Suspender />
        </Suspense>
      </div>
    </div>
  );
}

function Suspender() {
  const replayClient = useContext(ReplayClientContext);

  const point = getClosestPointForTime(replayClient, 1000);
  const { pauseId } = getPauseForExecutionPoint(replayClient, point);

  // This code is roughly approximating the shape of data from the Scopes panel.

  const { returned: globalValue } = evaluate(replayClient, pauseId, null, "globalValues");
  const { returned: windowValue } = evaluate(replayClient, pauseId, null, "window");

  const globalClientValue = getObjectWithPreview(replayClient, pauseId, globalValue?.object!, true);

  const fakeScopeProperties = [
    { name: "<this>", object: windowValue!.object },
    ...globalClientValue!.preview!.properties!.sort((a, b) => a.name.localeCompare(b.name)),
  ];

  const fakeWindowScope = {
    name: "Window",
    object: windowValue!.object!,
  };

  return (
    <div className={styles.ScopesPanel}>
      <ScopesInspector name="Block" pauseId={pauseId} protocolValues={fakeScopeProperties} />
      <Inspector context="default" pauseId={pauseId} protocolValue={fakeWindowScope} />
    </div>
  );
}

export default createTest(Scopes, DEFAULT_RECORDING_ID);
