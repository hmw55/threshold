import type { GameMission, GamePlayerState, GameState, GameTvEvent } from "./gameState.js";

export function assignMission(state: GameState, mission: GameMission): GameState {
  const missions = state.missions ?? [];
  if (missions.some((item) => item.id === mission.id)) throw new Error("Mission already exists");
  if (!mission.assignedPlayerIds.length) throw new Error("Mission requires a player");
  if (!Number.isSafeInteger(mission.points) || mission.points < 0) throw new Error("Invalid points");
  return { ...state, missions: [...missions, { ...mission, status: "available" }] };
}

export function completeMission(state: GameState, missionId: string, playerId: string): GameState {
  const missions = state.missions ?? [];
  const mission = missions.find((item) => item.id === missionId);
  if (!mission) throw new Error("Mission not found");
  if (!mission.assignedPlayerIds.includes(playerId)) throw new Error("Mission not assigned to player");
  if (mission.status === "completed" || mission.status === "failed") throw new Error("Mission already resolved");
  const players = [...(state.players ?? [])];
  const index = players.findIndex((item) => item.playerId === playerId);
  const current: GamePlayerState = index >= 0 ? players[index]! : { playerId, score: 0, completedMissionIds: [] };
  const updated: GamePlayerState = { ...current, score: current.score + mission.points, completedMissionIds: [...current.completedMissionIds, missionId] };
  if (index >= 0) players[index] = updated; else players.push(updated);
  const event: GameTvEvent = { id: "mission-" + missionId + "-completed", type: "score_update", message: "A player earned " + mission.points + " points.", createdAt: Date.now() };
  return { ...state, players, missions: missions.map((item) => item.id === missionId ? { ...item, status: "completed" as const } : item), tvEvents: [...(state.tvEvents ?? []), event] };
}

export function getPlayerMissions(state: GameState, playerId: string): GameMission[] {
  return (state.missions ?? []).filter((mission) => mission.assignedPlayerIds.includes(playerId) || !mission.private);
}

export function getPublicScoreboard(state: GameState): GamePlayerState[] {
  return [...(state.players ?? [])].sort((a, b) => b.score - a.score);
}

export function getTvEvents(state: GameState): GameTvEvent[] {
  return state.tvEvents ?? [];
}
