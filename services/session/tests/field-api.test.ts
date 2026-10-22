import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==", "base64");
async function setup() {
  const created = await request(app).post("/sessions").send({deviceId:"tv-1"}).expect(201);
  const code = created.body.code as string;
  const thresholdId = created.body.thresholds[0].id as string;
  const joined = await request(app).post(`/sessions/${code}/join`).send({name:"Solo"}).expect(201);
  const p = {playerId:joined.body.player.id as string, playerToken:joined.body.playerToken as string};
  await request(app).post(`/sessions/${code}/advance`).send({deviceId:"tv-1"}).expect(200);
  const group = await request(app).post(`/sessions/${code}/scan-groups`).send({...p,thresholdId,label:"Living room"}).expect(201);
  await request(app).post(`/sessions/${code}/scan-groups/${group.body.group.id}/images`)
    .set("X-Player-Id",p.playerId).set("Authorization",`Bearer ${p.playerToken}`)
    .attach("image",image,{filename:"room.png",contentType:"image/png"}).expect(201);
  await request(app).post(`/sessions/${code}/scan-groups/${group.body.group.id}/finalize`).send(p).expect(200);
  await request(app).post(`/sessions/${code}/advance`).send({deviceId:"tv-1"}).expect(200);
  await request(app).post(`/sessions/${code}/advance`).send({deviceId:"tv-1"}).expect(200);
  const headers = {"X-Player-Id":p.playerId,Authorization:`Bearer ${p.playerToken}`};
  return {code,headers};
}
describe("field encounter API",()=>{
  beforeEach(()=>resetSessionsForTesting());
  it("rejects unauthenticated access and invented object IDs",async()=>{
    const {code,headers}=await setup();
    await request(app).get(`/sessions/${code}/field`).expect(401);
    await request(app).post(`/sessions/${code}/field/observation`).set(headers)
      .field("objectId","imaginary-bookshelf").field("observation","I saw this in the room for real.").expect(400);
  });
  it("rejects a confirmed but incorrectly targeted object during Signal", async () => {
    const { code, headers } = await setup();

    const first = await request(app)
      .post(`/sessions/${code}/field/objects`)
      .set(headers)
      .send({ name: "Dresser", location: "Bedroom" })
      .expect(201);

    const second = await request(app)
      .post(`/sessions/${code}/field/objects`)
      .set(headers)
      .send({ name: "Lamp", location: "Bedroom" })
      .expect(201);

    await request(app)
      .post(`/sessions/${code}/field/observation`)
      .set(headers)
      .field("objectId", first.body.object.id)
      .field("observation", "The dresser has a visible scratch beneath its drawer.")
      .expect(200);

    const signal = await request(app)
      .get(`/sessions/${code}/field`)
      .set(headers)
      .expect(200);

    expect(signal.body.stage).toBe("signal");

    // Select a confirmed object that differs from the server-assigned target.
    const wrongObjectId =
      signal.body.target.id === first.body.object.id
        ? second.body.object.id
        : first.body.object.id;

    expect(wrongObjectId).not.toBe(signal.body.target.id);

    const rejected = await request(app)
      .post(`/sessions/${code}/field/observation`)
      .set(headers)
      .field("objectId", wrongObjectId)
      .field("observation", "This object has a visible mark along its base.")
      .expect(409);

    expect(rejected.body.error).toBe("wrong_directive_object");
  });

  it("confirms real objects and completes a solo session without fake evidence",async()=>{
    const {code,headers}=await setup();
    const opening = await request(app).get(`/sessions/${code}/threshold/game`).set("x-device-id","tv-1").expect(200);
    expect(opening.body.game.timelinePhase).toBe("opening");
    const created = await request(app).post(`/sessions/${code}/field/objects`).set(headers)
      .send({name:"Dresser",location:"Bedroom"}).expect(201);
    const id = created.body.object.id as string;
    await request(app).post(`/sessions/${code}/field/observation`).set(headers)
      .field("objectId",id).field("observation","I rotated the object to inspect its back.").field("action","rotate").expect(409);
    const before = await request(app).get(`/sessions/${code}/field`).set(headers).expect(200);
    expect(before.body.privateInstruction).toContain("PRIVATE DIRECTIVE");

    const observation = await request(app).post(`/sessions/${code}/field/observation`).set(headers)
      .field("objectId",id)
      .field("observation","The dresser has a visible mark along the bottom drawer.")
      .expect(200);

    expect(observation.body.view.stage).toBe("signal");

    let currentView = observation.body.view;

    for (const stage of ["signal", "exchange"]) {
      expect(currentView.stage).toBe(stage);
      expect(currentView.target?.id).toBeTruthy();

      const report = await request(app)
        .post(`/sessions/${code}/field/observation`)
        .set(headers)
        .field("objectId", currentView.target.id)
        .field(
          "observation",
          `I inspected the assigned ${currentView.target.name} and verified a real physical detail.`,
        )
        .expect(200);

      currentView = report.body.view;
    }

    expect(currentView.stage).toBe("fracture");
    expect(currentView.puzzle.choices.length).toBeGreaterThan(0);

    // The public case exposes evidence, not the answer key.
    const mystery = currentView.mystery;
    expect(mystery).toBeTruthy();
    expect(mystery.solution).toBeUndefined();
    expect(mystery.clues.length).toBeGreaterThan(0);
    expect(mystery.clues.every(
      (clue: { requiredForSolution?: boolean }) =>
        clue.requiredForSolution === undefined,
    )).toBe(true);

    // Submit published evidence alongside each candidate suspect.
    // Incorrect deductions remain retryable; a supported one unlocks the verdict.
    const evidenceIds = mystery.clues.map((clue: { id: string }) => clue.id);
    let solved = false;
    for (const item of currentView.puzzle.choices) {
      const answer = await request(app).post(`/sessions/${code}/field/puzzle`).set(headers)
        .send({choiceId: item.id, evidenceIds}).expect(200);
      if (answer.body.correct) {
        solved = true;
        expect(answer.body.outcome).toBe("solved");
        expect(answer.body.view.stage).toBe("verdict");
        break;
      }
    }
    expect(solved).toBe(true);

    // The Fire TV records its legacy terminal decision.
    // The Lens makes the final Witness identity accusation.
    await request(app)
      .post(`/sessions/${code}/threshold/field/verdict`)
      .set("x-device-id", "tv-1")
      .send({ choice: "release" })
      .expect(200);

    const witnessCase = currentView.witnessCase;
    expect(witnessCase).toBeTruthy();

    const witnessChoice = witnessCase.suspects.find(
      (candidate: { id: string }) =>
        candidate.id === "architect" || candidate.id === "unknown",
    );

    expect(witnessChoice).toBeDefined();

    const voted = await request(app)
      .post(`/sessions/${code}/field/verdict`)
      .set(headers)
      .send({ choice: witnessChoice!.id })
      .expect(200);

    expect(voted.body.view.stage).toBe("complete");
    expect(["release", "preserve"]).toContain(voted.body.view.ending);

    await request(app)
      .post(`/sessions/${code}/field/verdict`)
      .set(headers)
      .send({ choice: "erase" })
      .expect(409);
    const tv = await request(app).get(`/sessions/${code}/threshold/game`).set("x-device-id","tv-1").expect(200);
    expect(tv.body.fieldEncounter.stage).toBe("complete");
    expect(tv.body.terminalChallenge).toBeNull();
  });
});
