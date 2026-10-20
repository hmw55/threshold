import {
  getEnvironment,
  getEnvironmentObject,
  listEnvironmentObservations,
  isEnvironmentObjectRejected,
  type EnvironmentObservation,
  type RecognitionStatus,
} from "../sessionStore.js";

export interface KnownEnvironmentObject {
  id: string;
  parentObjectId: string | null;
  name: string | null;
  category: string | null;
  description: string | null;
  location: string | null;
  recognitionStatus: RecognitionStatus;
  requiresCloserScan: boolean;
}

export interface EnvironmentKnowledgeSnapshot {
  environmentId: string;
  environmentName: string;
  objects: KnownEnvironmentObject[];
}

export function getEnvironmentKnowledgeSnapshot(
  environmentId: string,
  sessionCode: string | null = null,
): EnvironmentKnowledgeSnapshot | null {
  const environment = getEnvironment(environmentId);
  if (!environment) return null;
  const baselineObservations = listEnvironmentObservations(environmentId, null);
  const expeditionObservations = sessionCode
    ? listEnvironmentObservations(environmentId, sessionCode) : [];
  const latestObservations = new Map<string, EnvironmentObservation>();
  for (const observation of [...baselineObservations, ...expeditionObservations]) {
    latestObservations.set(observation.objectId, observation);
  }
  const visibleIds = new Set([...latestObservations.keys()].filter((id) =>
    !sessionCode || !isEnvironmentObjectRejected(id, sessionCode)));
  const objects: KnownEnvironmentObject[] = [];
  for (const observation of latestObservations.values()) {
    if (!visibleIds.has(observation.objectId)) continue;
    const object = getEnvironmentObject(observation.objectId);
    if (!object) continue;
    objects.push({
      id: object.id,
      parentObjectId: object.parentObjectId && visibleIds.has(object.parentObjectId)
        ? object.parentObjectId : null,
      name: observation.observedName,
      category: observation.observedCategory,
      description: observation.observedDescription,
      location: observation.observedLocation,
      recognitionStatus: observation.recognitionStatus,
      requiresCloserScan: observation.recognitionStatus !== "confirmed",
    });
  }
  return { environmentId: environment.id, environmentName: environment.name, objects };
}
