import {
  getOrCreateEnvironmentObjectRef,
} from "../sessionStore.js";

import type {
  EnvironmentKnowledgeSnapshot,
} from "./environmentKnowledge.js";

export interface ModelEnvironmentObject {
  ref: string;
  parentRef: string | null;
  name: string | null;
  category: string | null;
  description: string | null;
  location: string | null;
  recognitionStatus: "confirmed" | "collection_only" | "uncertain";
  requiresCloserScan: boolean;
}

export interface ModelEnvironment {
  name: string;
  objects: ModelEnvironmentObject[];
}

export function toModelEnvironment(
  snapshot: EnvironmentKnowledgeSnapshot,
  sessionCode: string,
): ModelEnvironment {
  const references = new Map<string, string>();

  // Allocate persistent references only for observed objects.
  for (const object of snapshot.objects) {
    references.set(
      object.id,
      getOrCreateEnvironmentObjectRef(
        sessionCode,
        object.id,
      ),
    );
  }

  return {
    name: snapshot.environmentName,
    objects: snapshot.objects.map((object) => ({
      ref: references.get(object.id)!,
      parentRef: object.parentObjectId
        ? (references.get(object.parentObjectId) ?? null)
        : null,
      name: object.name,
      category: object.category,
      description: object.description,
      location: object.location,
      recognitionStatus: object.recognitionStatus,
      requiresCloserScan: object.requiresCloserScan,
    })),
  };
}