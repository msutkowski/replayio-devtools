import React from "react";
import { useAppSelector } from "ui/setup/hooks";
import { selectors } from "ui/reducers";
import Marker from "./Marker";

export default function MessageMarker({
  message,
  isPrimaryHighlighted,
  isSecondaryHighlighted,
}: MessageMarkerProps) {
  const { executionPoint, executionPointTime, frame, pauseId, executionPointHasFrames } = message;

  const zoomRegion = useAppSelector(selectors.getZoomRegion);
  const currentTime = useAppSelector(selectors.getCurrentTime);
  const overlayWidth = useAppSelector(selectors.getTimelineDimensions).width;

  return (
    <Marker
      point={executionPoint}
      time={executionPointTime}
      hasFrames={executionPointHasFrames}
      location={frame}
      pauseId={pauseId}
      currentTime={currentTime}
      isPrimaryHighlighted={isPrimaryHighlighted}
      isSecondaryHighlighted={isSecondaryHighlighted}
      zoomRegion={zoomRegion}
      overlayWidth={overlayWidth}
    />
  );
}

type MessageMarkerProps = {
  message: any;
  isPrimaryHighlighted: boolean;
  isSecondaryHighlighted: boolean;
};
