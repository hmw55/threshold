
import { describe, expect, it } from "vitest";
import {
  advanceFieldAfterDisplacement,
  startFieldExpedition,
  initializeFieldDisplacement,
  fieldDisplacementView,
  FieldState,
  fieldView,
  submitDisplacementAction,
  submitFieldObservation,
  resolveDisplacementInvestigation,
  type FieldRecord,
} from "../src/game/fieldExpedition.js";

const players = [
  { id: "player-a", name: "Alex" },
  { id: "player-b", name: "Blake" },
  { id: "player-c", name: "Casey" },
];

const objects = [
  { id: "lamp", name: "Lamp", location: "Living room" },
  { id: "book", name: "Book", location: "Living room" },
  { id: "vase", name: "Vase", location: "Hallway" },
];

function setup() {
  return initializeFieldDisplacement(
    startFieldExpedition("TEST42", 1000),
    objects,
    players,
  );
}

function makeRecord(
  playerId: string,
  objectId: string,
  action: FieldRecord["action"] = "observe",
): FieldRecord {
  return {
    id: `${playerId}-${objectId}`,
    stage: "exchange",
    playerId,
    objectId,
    objectName: objects.find(o => o.id === objectId)?.name ?? "Unknown",
    observation: "I observed the object's current position.",
    imageKey: "test-evidence.jpg",
    createdAt: 2000,
    action,
    detail: null,
  };
}

describe("Displacement encounter", () => {
  it("assigns different players to act and investigate", () => {
    const state = setup();
    expect(state.displacement).not.toBeNull();
    expect(state.displacement?.actorId)
      .not.toBe(state.displacement?.investigatorId);
  });

  it("does not expose the target in the investigator's private view", () => {
    const state = setup();
    const encounter = state.displacement!;
    const view = fieldDisplacementView(
      state,
      encounter.investigatorId,
    );

    expect(view?.role).toBe("investigator");
    expect(JSON.stringify(view)).not.toContain(encounter.objectName);
    expect(JSON.stringify(view)).not.toContain(encounter.objectId);
  });

  it("rejects an unauthorized actor", () => {
    const state = setup();
    const encounter = state.displacement!;

    expect(() =>
      submitDisplacementAction(
        state,
        encounter.investigatorId,
        makeRecord(
          encounter.investigatorId,
          encounter.objectId,
          "move",
        ),
      ),
    ).toThrow("displacement_actor_unauthorized");
  });

  it("requires a physical action", () => {
    const state = setup();
    const encounter = state.displacement!;

    expect(() =>
      submitDisplacementAction(
        state,
        encounter.actorId,
        makeRecord(encounter.actorId, encounter.objectId),
      ),
    ).toThrow("displacement_requires_physical_action");
  });

  it("prevents investigation before the action", () => {
    const state = setup();
    const encounter = state.displacement!;

    expect(() =>
      resolveDisplacementInvestigation(
        state,
        encounter.investigatorId,
        makeRecord(encounter.investigatorId, encounter.objectId),
        encounter.objectId,
      ),
    ).toThrow("displacement_investigation_unavailable");
  });

  it("rewards correct identification", () => {
    const state = setup();
    const encounter = state.displacement!;

    const afterAction = submitDisplacementAction(
      state,
      encounter.actorId,
      makeRecord(encounter.actorId, encounter.objectId, "move"),
    );

    const result = resolveDisplacementInvestigation(
      afterAction,
      encounter.investigatorId,
      makeRecord(encounter.investigatorId, encounter.objectId),
      encounter.objectId,
    );

    expect(result.displacement?.phase).toBe("resolved");
    expect(result.displacement?.outcome).toBe("detected");
    expect(result.scoreEvents.at(-1)?.playerId)
      .toBe(encounter.investigatorId);
  });

  it("rewards the actor when the investigator selects the wrong object", () => {
    const state = setup();
    const encounter = state.displacement!;
    const wrongObject = objects.find(o => o.id !== encounter.objectId)!;

    const afterAction = submitDisplacementAction(
      state,
      encounter.actorId,
      makeRecord(encounter.actorId, encounter.objectId, "move"),
    );

    const result = resolveDisplacementInvestigation(
      afterAction,
      encounter.investigatorId,
      makeRecord(encounter.investigatorId, wrongObject.id),
      wrongObject.id,
    );

    expect(result.displacement?.outcome).toBe("missed");
    expect(result.scoreEvents.at(-1)?.playerId)
      .toBe(encounter.actorId);
  });

  it("does not award points twice", () => {
    const state = setup();
    const encounter = state.displacement!;

    const afterAction = submitDisplacementAction(
      state,
      encounter.actorId,
      makeRecord(encounter.actorId, encounter.objectId, "move"),
    );

    const result = resolveDisplacementInvestigation(
      afterAction,
      encounter.investigatorId,
      makeRecord(encounter.investigatorId, encounter.objectId),
      encounter.objectId,
    );

    expect(() =>
      resolveDisplacementInvestigation(
        result,
        encounter.investigatorId,
        makeRecord(encounter.investigatorId, encounter.objectId),
        encounter.objectId,
      ),
    ).toThrow("displacement_investigation_unavailable");

    expect(result.scoreEvents).toHaveLength(1);
  });

  it("waits for Displacement when everyone finishes Exchange first", () => {
    const initial = setup();

    let state: FieldState = { ...initial, stage: "exchange" };

    for (const player of players) {
      const object = fieldView(state, objects, players, player.id).target!;

      state = submitFieldObservation(
        state,
        {
          playerId: player.id,
          object,
          observation: "The object is in its recorded location.",
          action: "observe",
        },
        players,
        2000,
        objects,
      );
    }

    expect(state.stage).toBe("exchange");

    const encounter = state.displacement!;
    const actionRecord = makeRecord(
      encounter.actorId,
      encounter.objectId,
      "move",
    );

    state = submitDisplacementAction(
      state,
      encounter.actorId,
      actionRecord,
    );

    const investigationRecord = makeRecord(
      encounter.investigatorId,
      encounter.objectId,
    );

    state = resolveDisplacementInvestigation(
      state,
      encounter.investigatorId,
      investigationRecord,
      encounter.objectId,
    );

    state = advanceFieldAfterDisplacement(state, players);

    expect(state.stage).toBe("fracture");
    expect(state.puzzle).not.toBeNull();
  });

  it("advances when the final Exchange observation arrives after Displacement", () => {
    const initial = setup();
    let state: FieldState = { ...initial, stage: "exchange" };

    const encounter = state.displacement!;

    state = submitDisplacementAction(
      state,
      encounter.actorId,
      makeRecord(encounter.actorId, encounter.objectId, "move"),
    );

    state = resolveDisplacementInvestigation(
      state,
      encounter.investigatorId,
      makeRecord(encounter.investigatorId, encounter.objectId),
      encounter.objectId,
    );

    expect(state.stage).toBe("exchange");

    for (const player of players) {
      const object = fieldView(state, objects, players, player.id).target!;

      state = submitFieldObservation(
        state,
        {
          playerId: player.id,
          object,
          observation: "The object is in its recorded location.",
          action: "observe",
        },
        players,
        3000,
        objects,
      );
    }

    expect(state.stage).toBe("fracture");
    expect(state.puzzle).not.toBeNull();
  });

  it("keeps Displacement evidence separate from normal Exchange observations", () => {
    const initial = setup();
    const state = { ...initial, stage: "exchange" as const };

    const encounter = state.displacement!;
    const actionRecord = makeRecord(
      encounter.actorId,
      encounter.objectId,
      "move",
    );

    const updated = submitDisplacementAction(
      state,
      encounter.actorId,
      actionRecord,
    );

    const saved = {
      ...updated,
      displacementEvidence: [
        ...(updated.displacementEvidence ?? []),
        actionRecord,
      ],
    };

    expect(saved.displacementEvidence).toHaveLength(1);
    expect(saved.records).toHaveLength(0);

    const actorView = fieldView(
      saved,
      objects,
      players,
      encounter.actorId,
    );

    expect(actorView.submitted).toBe(false);
    expect(actorView.received).toBe(0);
    expect(actorView.prior).toHaveLength(0);
  });
});
