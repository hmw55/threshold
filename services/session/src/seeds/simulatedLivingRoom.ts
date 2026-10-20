
import {
  backfillBaselineObservationIdentity,
  createEnvironment,
  createEnvironmentObject,
  createEnvironmentObservation,
  getEnvironment,
  getEnvironmentObject,
  listEnvironmentObservations,
  type EnvironmentObject,
} from "../sessionStore.js";

export const SIMULATED_LIVING_ROOM_ID =
  "simulated-living-room-v1";

const createdAt = "2026-10-01T00:00:00.000Z";

type SeedObject = Omit<
  EnvironmentObject,
  "environmentId" | "createdAt"
>;

const objects: SeedObject[] = [
  {
    id: "living-room-bookshelf",
    parentObjectId: null,
    name: "Wooden bookshelf",
    category: "furniture",
    description: "Tall wooden bookshelf against the north wall",
    location: "North wall",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-board-games",
    parentObjectId: "living-room-bookshelf",
    name: "Board game collection",
    category: "collection",
    description: "Several board game boxes with unreadable titles",
    location: "Bookshelf, middle shelf",
    recognitionStatus: "collection_only",
    requiresCloserScan: true,
  },
  {
    id: "living-room-chess-set",
    parentObjectId: "living-room-bookshelf",
    name: "Chess set",
    category: "game",
    description: "A chess set discovered during closer inspection",
    location: "Bookshelf, bottom shelf",
    recognitionStatus: "confirmed" as const,
    requiresCloserScan: false,
  },
  {
    id: "living-room-book-collection",
    parentObjectId: "living-room-bookshelf",
    name: "Book collection",
    category: "collection",
    description: "Several books with unreadable spines",
    location: "Bookshelf, top shelf",
    recognitionStatus: "collection_only",
    requiresCloserScan: true,
  },
  {
    id: "living-room-couch",
    parentObjectId: null,
    name: "Green couch",
    category: "furniture",
    description: "Three-seat green fabric couch",
    location: "West wall",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-coffee-table",
    parentObjectId: null,
    name: "Wooden coffee table",
    category: "furniture",
    description: "Rectangular coffee table in front of the couch",
    location: "Center of room",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-television",
    parentObjectId: null,
    name: "Television",
    category: "electronics",
    description: "Flat-screen television facing the couch",
    location: "East wall",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-floor-lamp",
    parentObjectId: null,
    name: "Floor lamp",
    category: "lighting",
    description: "Standing lamp beside the couch",
    location: "Southwest corner",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-armchair",
    parentObjectId: null,
    name: "Blue armchair",
    category: "furniture",
    description: "Upholstered armchair beside the bookshelf",
    location: "Northeast corner",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-side-table",
    parentObjectId: null,
    name: "Side table",
    category: "furniture",
    description: "Small round table beside the couch",
    location: "West wall",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-table-lamp",
    parentObjectId: "living-room-side-table",
    name: "Table lamp",
    category: "lighting",
    description: "Brass lamp with a cream-colored shade",
    location: "On side table",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-tv-remote",
    parentObjectId: "living-room-coffee-table",
    name: "Television remote",
    category: "electronics",
    description: "Black remote with a circular navigation pad",
    location: "On coffee table",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-mug",
    parentObjectId: "living-room-coffee-table",
    name: "Ceramic mug",
    category: "accessory",
    description: "Blue ceramic mug",
    location: "On coffee table",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-notebook",
    parentObjectId: "living-room-coffee-table",
    name: "Notebook",
    category: "accessory",
    description: "Small spiral-bound notebook",
    location: "On coffee table",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-wall-clock",
    parentObjectId: null,
    name: "Wall clock",
    category: "decor",
    description: "Round analog clock with black hands",
    location: "South wall",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-photo-frame",
    parentObjectId: "living-room-bookshelf",
    name: "Framed photograph",
    category: "decor",
    description: "Small wooden frame containing a photograph",
    location: "Bookshelf, second shelf",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-potted-plant",
    parentObjectId: null,
    name: "Potted monstera",
    category: "plant",
    description: "Large leafy plant in a terracotta pot",
    location: "Southeast corner",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
  {
    id: "living-room-blanket",
    parentObjectId: "living-room-couch",
    name: "Throw blanket",
    category: "fabric",
    description: "Cream knitted blanket draped over the couch",
    location: "On couch",
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
  },
];

// Objects visible to the Architect after the initial room scan.
// Other objects exist in ground truth but remain undiscovered.
const initialObservations = [
  ["living-room-bookshelf", "confirmed"],
  ["living-room-couch", "confirmed"],
  ["living-room-coffee-table", "confirmed"],
  ["living-room-television", "confirmed"],
  ["living-room-floor-lamp", "confirmed"],
  ["living-room-board-games", "collection_only"],
  ["living-room-book-collection", "collection_only"],
] as const;

export function seedSimulatedLivingRoom(): void {
  // Step 1: Ensure the simulated environment exists.
  if (!getEnvironment(SIMULATED_LIVING_ROOM_ID)) {
    createEnvironment({
      id: SIMULATED_LIVING_ROOM_ID,
      name: "Simulated Living Room",
      source: "simulated",
      createdAt,
    });
  }

  // Step 2: Seed all 18 ground-truth objects.
  // Parent objects are listed before their children.
  for (const object of objects) {
    if (getEnvironmentObject(object.id)) {
      continue;
    }

    createEnvironmentObject({
      ...object,
      environmentId: SIMULATED_LIVING_ROOM_ID,
      createdAt,
    });
  }

  // Step 3: Find objects already observed by the Architect.
  const existingObservations = new Set(
    listEnvironmentObservations(SIMULATED_LIVING_ROOM_ID).map(
      (observation) => observation.objectId,
    ),
  );

  // Step 4: Backfill existing baseline observations and seed missing ones.
  // Undiscovered objects remain hidden from the Architect.
  for (const [objectId, recognitionStatus] of initialObservations) {
    const object = getEnvironmentObject(objectId);

    if (!object) {
      throw new Error(`seed_object_not_found: ${objectId}`);
    }

    // Fill missing identity fields on older baseline observations.
    // Existing non-null values are preserved.
    backfillBaselineObservationIdentity(
      SIMULATED_LIVING_ROOM_ID,
      objectId,
      object.name,
      object.category,
    );

    // Do not create duplicate observations.
    if (existingObservations.has(objectId)) {
      continue;
    }

    createEnvironmentObservation({
      id: `baseline-${objectId}`,
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId,
      observedName: object.name,
      observedCategory: object.category,
      sessionCode: null,
      scanGroupId: null,
      recognitionStatus,
      observedAt: createdAt,
      observedDescription:
        recognitionStatus === "confirmed"
          ? object.description
          : "A visible collection whose individual contents have not been identified",
      observedLocation: object.location,
    });
  }
}