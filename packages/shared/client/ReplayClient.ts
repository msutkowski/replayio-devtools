import {
  ContentType,
  createPauseResult,
  ExecutionPoint,
  EventHandlerType,
  FrameId,
  loadedRegions as LoadedRegions,
  Location,
  Message,
  newSource as Source,
  ObjectId,
  ObjectPreviewLevel,
  PauseData,
  PauseId,
  PointDescription,
  TimeRange,
  TimeStampedPoint,
  TimeStampedPointRange,
  RecordingId,
  Result as EvaluationResult,
  SearchSourceContentsMatch,
  searchSourceContentsMatches,
  SessionId,
  SourceId,
} from "@replayio/protocol";
import uniqueId from "lodash/uniqueId";
import analysisManager, { AnalysisParams } from "protocol/analysisManager";
// eslint-disable-next-line no-restricted-imports
import { client, initSocket } from "protocol/socket";
import { ThreadFront } from "protocol/thread";
import { compareNumericStrings } from "protocol/utils";

import { ColumnHits, LineHits, ReplayClientEvents, ReplayClientInterface } from "./types";

// TODO How should the client handle concurrent requests?
// Should we force serialization?
// Should we cancel in-flight requests and start new ones?

type WaitUntilLoadedCallbacks = () => boolean;

export class ReplayClient implements ReplayClientInterface {
  private _dispatchURL: string;
  private _eventHandlers: Map<ReplayClientEvents, Function[]> = new Map();
  private _loadedRegions: LoadedRegions | null = null;
  private _recordingId: RecordingId | null = null;
  private _sessionId: SessionId | null = null;
  private _threadFront: typeof ThreadFront;

  constructor(dispatchURL: string, threadFront: typeof ThreadFront) {
    this._dispatchURL = dispatchURL;
    this._threadFront = threadFront;

    threadFront.listenForLoadChanges(this._onLoadChanges);

    analysisManager.init();
  }

  private getSessionIdThrows(): SessionId {
    const sessionId = this._sessionId;
    if (sessionId === null) {
      throw Error("Invalid session");
    }
    return sessionId;
  }

  // Configures the client to use an already initialized session iD.
  // This method should be used for apps that use the protocol package directly.
  // Apps that only communicate with the Replay protocol through this client should use the initialize method instead.
  configure(sessionId: string): void {
    this._sessionId = sessionId;
  }

  get loadedRegions(): LoadedRegions | null {
    return this._loadedRegions;
  }

  addEventListener(type: ReplayClientEvents, handler: Function): void {
    if (!this._eventHandlers.has(type)) {
      this._eventHandlers.set(type, []);
    }

    const handlers = this._eventHandlers.get(type)!;
    handlers.push(handler);
  }

  async createPause(executionPoint: ExecutionPoint): Promise<createPauseResult> {
    const sessionId = this.getSessionIdThrows();
    const response = await client.Session.createPause({ point: executionPoint }, sessionId);

    return response;
  }

  async evaluateExpression(
    pauseId: PauseId,
    expression: string,
    frameId: FrameId | null
  ): Promise<EvaluationResult> {
    const sessionId = this.getSessionIdThrows();

    if (frameId === null) {
      const response = await client.Pause.evaluateInGlobal(
        {
          expression,
          pure: false,
        },
        sessionId,
        pauseId
      );
      return response.result;
    } else {
      const response = await client.Pause.evaluateInFrame(
        {
          frameId,
          expression,
          pure: false,
          useOriginalScopes: true,
        },
        sessionId,
        pauseId
      );
      return response.result;
    }
  }

  // Initializes the WebSocket and remote session.
  // This method should be used for apps that only communicate with the Replay protocol through this client.
  // Apps that use the protocol package directly should use the configure method instead.
  async initialize(recordingId: RecordingId, accessToken: string | null): Promise<SessionId> {
    this._recordingId = recordingId;

    const socket = initSocket(this._dispatchURL);
    await waitForOpenConnection(socket!);

    if (accessToken != null) {
      await client.Authentication.setAccessToken({ accessToken });
    }

    const { sessionId } = await client.Recording.createSession({ recordingId });

    this._sessionId = sessionId;
    this._threadFront.setSessionId(sessionId);

    return sessionId;
  }

  async findMessages(focusRange: TimeStampedPointRange | null): Promise<{
    messages: Message[];
    overflow: boolean;
  }> {
    const sessionId = this.getSessionIdThrows();

    if (focusRange !== null) {
      const response = await client.Console.findMessagesInRange(
        { range: { begin: focusRange.begin.point, end: focusRange.end.point } },
        sessionId
      );

      // Messages aren't guaranteed to arrive sorted, but unsorted messages aren't that useful to work with.
      // So sort them before returning.
      const sortedMessages = response.messages.sort((messageA: Message, messageB: Message) => {
        const pointA = messageA.point.point;
        const pointB = messageB.point.point;
        return compareNumericStrings(pointA, pointB);
      });

      return {
        messages: sortedMessages,
        overflow: response.overflow == true,
      };
    } else {
      const sortedMessages: Message[] = [];

      // TODO This won't work if there are every overlapping requests.
      // Do we need to implement some kind of locking mechanism to ensure only one read is going at a time?
      client.Console.addNewMessageListener(({ message }) => {
        const newMessagePoint = message.point.point;

        // Messages may arrive out of order so let's sort them as we get them.
        let lowIndex = 0;
        let highIndex = sortedMessages.length;
        while (lowIndex < highIndex) {
          let middleIndex = (lowIndex + highIndex) >>> 1;
          const message = sortedMessages[middleIndex];

          if (compareNumericStrings(message.point.point, newMessagePoint)) {
            lowIndex = middleIndex + 1;
          } else {
            highIndex = middleIndex;
          }
        }

        const insertAtIndex = lowIndex;

        sortedMessages.splice(insertAtIndex, 0, message);
      });

      const response = await client.Console.findMessages({}, sessionId);

      client.Console.removeNewMessageListener();

      return {
        messages: sortedMessages,
        overflow: response.overflow == true,
      };
    }
  }

  async findSources(): Promise<Source[]> {
    const sources: Source[] = [];

    await this._threadFront.findSources((source: Source) => {
      sources.push(source);
    });

    return sources;
  }

  async getAllFrames(pauseId: PauseId): Promise<PauseData> {
    const sessionId = this.getSessionIdThrows();
    const { data } = await client.Pause.getAllFrames({}, sessionId, pauseId);
    return data;
  }

  async getEventCountForType(eventType: EventHandlerType): Promise<number> {
    const sessionId = this.getSessionIdThrows();
    const { count } = await client.Debugger.getEventHandlerCount({ eventType }, sessionId);
    return count;
  }

  async getHitPointsForLocation(
    focusRange: TimeStampedPointRange | null,
    location: Location,
    condition: string | null
  ): Promise<PointDescription[]> {
    const collectedPointDescriptions: PointDescription[] = [];

    // The backend doesn't support filtering hit points by condition, so we fall back to running analysis.
    // This is less efficient so we only do it if we have a condition.
    // We should delete this once the backend supports filtering (see BAC-2103).
    if (condition) {
      const mapper = `
        const { point, time } = input;
        const { frame: frameId } = sendCommand("Pause.getTopFrame");
    
        const { result: conditionResult } = sendCommand(
          "Pause.evaluateInFrame",
          { frameId, expression: ${JSON.stringify(condition)}, useOriginalScopes: true }
        );
    
        let result;
        if (conditionResult.returned) {
          const { returned } = conditionResult;
          if ("value" in returned && !returned.value) {
            result = 0;
          } else if (!Object.keys(returned).length) {
            // Undefined.
            result = 0;
          } else {
            result = 1;
          }
        } else {
          result = 1;
        }
    
        return [
          {
            key: point,
            value: {
              match: result,
              point,
              time,
            },
          },
        ];
      `;

      await analysisManager.runAnalysis(
        {
          effectful: false,
          locations: [{ location }],
          mapper,
          range: focusRange
            ? { begin: focusRange.begin.point, end: focusRange.end.point }
            : undefined,
        },
        {
          onAnalysisError: (errorMessage: string) => {
            throw Error(errorMessage);
          },
          onAnalysisResult: results => {
            results.forEach(({ value }) => {
              if (value.match) {
                collectedPointDescriptions.push({
                  point: value.point,
                  time: value.time,
                });
              }
            });
          },
        }
      );
    } else {
      await analysisManager.runAnalysis(
        {
          effectful: false,
          locations: [{ location }],
          mapper: "",
          range: focusRange
            ? { begin: focusRange.begin.point, end: focusRange.end.point }
            : undefined,
        },
        {
          onAnalysisError: (errorMessage: string) => {
            throw Error(errorMessage);
          },
          onAnalysisPoints: (pointDescriptions: PointDescription[]) => {
            collectedPointDescriptions.push(...pointDescriptions);
          },
        }
      );
    }

    return collectedPointDescriptions;
  }

  async getObjectWithPreview(
    objectId: ObjectId,
    pauseId: PauseId,
    level?: ObjectPreviewLevel
  ): Promise<PauseData> {
    const sessionId = this.getSessionIdThrows();
    const { data } = await client.Pause.getObjectPreview(
      { level, object: objectId },
      sessionId,
      pauseId || undefined
    );
    return data;
  }

  async getPointNearTime(time: number): Promise<TimeStampedPoint> {
    const sessionId = this.getSessionIdThrows();
    const { point } = await client.Session.getPointNearTime({ time: time }, sessionId);
    return point;
  }

  getRecordingId(): RecordingId | null {
    return this._recordingId;
  }

  async getSessionEndpoint(sessionId: SessionId): Promise<TimeStampedPoint> {
    const { endpoint } = await client.Session.getEndpoint({}, sessionId);
    return endpoint;
  }

  getSessionId(): SessionId | null {
    return this._sessionId;
  }

  async getSourceContents(
    sourceId: SourceId
  ): Promise<{ contents: string; contentType: ContentType }> {
    return this._threadFront.getSourceContents(sourceId);
  }

  async getSourceHitCounts(sourceId: SourceId): Promise<Map<number, LineHits>> {
    const sessionId = this.getSessionIdThrows();
    const { lineLocations } = await client.Debugger.getPossibleBreakpoints(
      {
        sourceId,
      },
      sessionId
    );

    const { hits: protocolHitCounts } = await client.Debugger.getHitCounts(
      {
        sourceId,
        locations: lineLocations,
        maxHits: 250,
      },
      sessionId
    );

    const hitCounts: Map<number, LineHits> = new Map();

    protocolHitCounts.forEach(({ hits, location }) => {
      const previous = hitCounts.get(location.line) || {
        columnHits: [],
        hits: 0,
      };

      const columnHits: ColumnHits = {
        hits: hits,
        location: location,
      };

      hitCounts.set(location.line, {
        columnHits: [...previous.columnHits, columnHits],
        hits: previous.hits + hits,
      });
    });

    return hitCounts;
  }

  async loadRegion(range: TimeRange, duration: number): Promise<void> {
    const sessionId = this.getSessionIdThrows();

    client.Session.unloadRegion({ region: { begin: 0, end: range.begin } }, sessionId);
    client.Session.unloadRegion({ region: { begin: range.end, end: duration } }, sessionId);

    await client.Session.loadRegion({ region: { begin: range.begin, end: range.end } }, sessionId);
  }

  removeEventListener(type: ReplayClientEvents, handler: Function): void {
    if (this._eventHandlers.has(type)) {
      const handlers = this._eventHandlers.get(type)!;
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Matches can be streamed in over time, so we need to support a callback that can receive them incrementally
   */
  async searchSources(
    {
      query,
      sourceIds,
    }: {
      query: string;
      sourceIds?: string[];
    },
    onMatches: (matches: SearchSourceContentsMatch[]) => void
  ): Promise<void> {
    const sessionId = this.getSessionIdThrows();
    const thisSearchUniqueId = uniqueId("search-");

    const matchesListener = ({ searchId, matches }: searchSourceContentsMatches) => {
      if (searchId === thisSearchUniqueId) {
        onMatches(matches);
      }
    };

    client.Debugger.addSearchSourceContentsMatchesListener(matchesListener);
    try {
      await client.Debugger.searchSourceContents(
        { searchId: thisSearchUniqueId, sourceIds, query },
        sessionId
      );
    } finally {
      client.Debugger.removeSearchSourceContentsMatchesListener(matchesListener);
    }
  }

  async runAnalysis<Result>(analysisParams: AnalysisParams): Promise<Result[]> {
    return new Promise<Result[]>(async (resolve, reject) => {
      const results: Result[] = [];
      let resultReceived = false;

      try {
        await analysisManager.runAnalysis(analysisParams, {
          onAnalysisError: (errorMessage: string) => {
            reject(errorMessage);
          },
          onAnalysisResult: analysisEntries => {
            resultReceived = true;
            results.push(...analysisEntries.map(entry => entry.value));
          },
        });

        if (resultReceived) {
          resolve(results);
        } else {
          // No result was returned.
          // This might happen when e.g. exceptions are being queried for a recording with no exceptions.
          resolve([]);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  _onLoadChanges = (loadedRegions: LoadedRegions) => {
    this._loadedRegions = loadedRegions;

    const handlers = this._eventHandlers.get("loadedRegionsChange");
    if (handlers) {
      handlers.forEach(handler => handler());
    }
  };
}

function waitForOpenConnection(
  socket: WebSocket,
  maxDurationMs = 2500,
  intervalMs = 100
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const startTime = performance.now();
    const intervalId = setInterval(() => {
      if (performance.now() - startTime > maxDurationMs) {
        clearInterval(intervalId);
        reject(new Error("Timed out"));
      } else if (socket.readyState === socket.OPEN) {
        clearInterval(intervalId);
        resolve();
      }
    }, intervalMs);
  });
}
