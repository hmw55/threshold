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

  it("uses the connected witness engine on the public display instead of a fictional reconstruction",async()=>{
    const {code}=await setup();
    const tv=await request(app).get(`/sessions/${code}/threshold/game`).set("x-device-id","tv-1").expect(200);
    expect(tv.body.fieldEncounter.version).toBe(2);
    expect(tv.body.fieldEncounter.stage).toBe("acquisition");
    expect(tv.body.fieldEncounter.assignment).toBeNull();
    expect(tv.body.terminalChallenge).toBeNull();
    expect(tv.body.fieldEncounter.witnessCase).toBeUndefined();
  });
});
