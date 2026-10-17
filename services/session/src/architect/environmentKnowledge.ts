
import {
  getEnvironment,
  getEnvironmentObject,
  listEnvironmentObservations,
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

  if (!environment) {
    return null;
  }

  // Discoveries shared by every expedition.
  const baselineObservations = listEnvironmentObservations(
    environmentId,
    null,
  );

  // Discoveries belonging only to this expedition.
  const expeditionObservations = sessionCode
    ? listEnvironmentObservations(environmentId, sessionCode)
    : [];

  // Later observations override earlier ones for the same object.
  // Expedition observations always take precedence over baseline.
  const latestObservations = new Map<
    string,
    EnvironmentObservation
  >();

  for (const observation of [
    ...baselineObservations,
    ...expeditionObservations,
  ]) {
    latestObservations.set(observation.objectId, observation);
  }

  const observedObjectIds = new Set(latestObservations.keys());

  const objects: KnownEnvironmentObject[] = [];

  for (const observation of latestObservations.values()) {
    const object = getEnvironmentObject(observation.objectId);

    if (!object) {
      continue;
    }

    objects.push({
      id: object.id,

      // Do not reveal an undiscovered parent object.
      parentObjectId:
        object.parentObjectId &&
        observedObjectIds.has(object.parentObjectId)
          ? object.parentObjectId
          : null,

      name: observation.observedName,
      category: observation.observedCategory,

      // Never expose ground-truth descriptions or locations.
      description: observation.observedDescription,
      location: observation.observedLocation,

      recognitionStatus: observation.recognitionStatus,
      requiresCloserScan:
        observation.recognitionStatus !== "confirmed",
    });
  }

  return {
    environmentId: environment.id,
    environmentName: environment.name,
    objects,
  };
}
