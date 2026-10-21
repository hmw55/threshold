import { randomUUID } from "node:crypto";
import {
  createEnvironmentObject,
  createEnvironmentObservation,
  getScanGroup,
  listEnvironmentObservations,
  listScanImages,
  transitionScanGroupStatus,
} from "../sessionStore.js";
import { readImage } from "../imageStorage.js";
import { createAiProvider } from "./createAiProvider.js";

interface VisualObject {
  name: string;
  category: string;
  description: string;
  confidence: "high" | "medium" | "low";
}

interface VisionResult {
  objects: VisualObject[];
}

function parseVisionResult(text: string): VisionResult {
  const parsed: unknown = JSON.parse(text);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("objects" in parsed) ||
    !Array.isArray(parsed.objects)
  ) {
    throw new Error("invalid_calibration_vision_response");
  }

  const objects: VisualObject[] = [];

  for (const item of parsed.objects) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.name !== "string" ||
      typeof item.category !== "string" ||
      typeof item.description !== "string" ||
      !["high", "medium", "low"].includes(item.confidence)
    ) {
      throw new Error("invalid_calibration_object");
    }

    if (
      item.name.trim().length < 2 ||
      item.name.length > 100 ||
      item.category.length > 100 ||
      item.description.length > 500
    ) {
      throw new Error("invalid_calibration_object_fields");
    }

    objects.push(item as VisualObject);
  }

  return { objects: objects.slice(0, 20) };
}

export async function analyzeCalibration(
  sessionCode: string,
  environmentId: string,
  scanGroupId: string,
): Promise<void> {
  const group = getScanGroup(scanGroupId);

  if (
    !group ||
    group.sessionCode !== sessionCode ||
    !["uploaded", "failed"].includes(group.status)
  ) {
    return;
  }

  const claimed = transitionScanGroupStatus(
    scanGroupId,
    group.status,
    "analyzing",
  );

  if (!claimed) return;

  try {
    const images = listScanImages(scanGroupId);

    if (images.length === 0) {
      throw new Error("calibration_images_missing");
    }

    const provider = createAiProvider();

    if (!provider.analyzeImage) {
      throw new Error("vision_provider_unavailable");
    }

    const existing = listEnvironmentObservations(
      environmentId,
      sessionCode,
    );

    const knownNames = new Set(
      existing
        .map((observation) =>
          observation.observedName?.trim().toLowerCase()
        )
        .filter((name): name is string => Boolean(name)),
    );

    for (const image of images) {
      const buffer = await readImage(image.storageKey);

      const result = await provider.analyzeImage(
        buffer,
        [
          "Identify distinct physical objects clearly visible in this room.",
          "Do not invent objects or infer objects outside the image.",
          "Do not use fictional, narrative, or game-world knowledge.",
          "Only report objects directly supported by visible evidence.",
          "For ambiguous objects, use medium or low confidence.",
          "Return JSON only using this schema:",
          '{"objects":[{"name":"lamp","category":"lighting",',
          '"description":"A lamp on a table",',
          '"confidence":"high"}]}',
          "Use an empty objects array if nothing is recognizable.",
        ].join(" "),
        {
          systemPrompt:
            "You are a cautious visual inventory system. " +
            "Only identify objects visibly present in the photograph. " +
            "Never fabricate objects.",
        },
      );

      const parsed = parseVisionResult(result.text);

      for (const item of parsed.objects) {
        if (item.confidence === "low") continue;

        const name = item.name.trim();
        const key = name.toLowerCase();

        if (knownNames.has(key)) continue;

        const now = new Date().toISOString();
        const objectId = randomUUID();
        const recognitionStatus =
          item.confidence === "high" ? "collection_only" : "uncertain";
        const requiresCloserScan = item.confidence === "medium";

        createEnvironmentObject({
          id: objectId,
          environmentId,
          parentObjectId: null,
          name,
          category: item.category.trim() || "physical_object",
          description: item.description.trim(),
          location: group.label,
          recognitionStatus,
          requiresCloserScan,
          createdAt: now,
        });

        createEnvironmentObservation({
          id: randomUUID(),
          environmentId,
          objectId,
          sessionCode,
          scanGroupId,
          observedName: name,
          observedCategory: item.category.trim() || "physical_object",
          observedDescription: item.description.trim(),
          observedLocation: group.label,
          recognitionStatus,
          observedAt: now,
        });

        knownNames.add(key);
      }
    }

    transitionScanGroupStatus(
      scanGroupId,
      "analyzing",
      "completed",
    );
  } catch (error) {
    console.error("Calibration vision analysis failed:", error);

    transitionScanGroupStatus(
      scanGroupId,
      "analyzing",
      "failed",
    );
  }
}
