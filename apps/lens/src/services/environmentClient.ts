
import {
  normalizeCode,
  playerHeaders,
  request,
} from "./apiClient";

export interface ScanGroup {
  id: string;
  sessionCode: string;
  thresholdId: string | null;
  label: string;
  createdBy: string;
  status:
    | "pending"
    | "uploaded"
    | "analyzing"
    | "completed"
    | "failed";
  createdAt: string;
}

export interface ScanImageUploadResult {
  image: {
    id: string;
    scanGroupId: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  };
  count: number;
  limit: number;
}

export const environmentClient = {
  registerEnvironmentObject(
    code: string,
    playerId: string,
    playerToken: string,
    scanGroupId: string,
    name: string,
  ): Promise<{
    object: {
      id: string;
      name: string;
      category: string;
      location: string;
    };
  }> {
    return request(
      `/sessions/${normalizeCode(code)}/environment/objects`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          scanGroupId,
          name: name.trim(),
        }),
      },
    );
  },

  createScanGroup(
    code: string,
    playerId: string,
    playerToken: string,
    thresholdId: string | null,
    label: string,
  ): Promise<{ group: ScanGroup }> {
    return request(
      `/sessions/${normalizeCode(code)}/scan-groups`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          thresholdId,
          label,
        }),
      },
    );
  },

  getScanGroups(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<{ groups: ScanGroup[] }> {
    return request(
      `/sessions/${normalizeCode(code)}/scan-groups`,
      {
        method: "GET",
        headers: playerHeaders(playerId, playerToken),
      },
    );
  },

  finalizeScanGroup(
    code: string,
    groupId: string,
    playerId: string,
    playerToken: string,
  ): Promise<{ group: ScanGroup }> {
    return request(
      `/sessions/${normalizeCode(code)}/scan-groups/${encodeURIComponent(groupId)}/finalize`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
        }),
      },
    );
  },

  uploadScanImage(
    code: string,
    groupId: string,
    playerId: string,
    playerToken: string,
    image: Blob,
  ): Promise<ScanImageUploadResult> {
    const formData = new FormData();
    formData.append("image", image, "environment.jpg");

    return request(
      `/sessions/${normalizeCode(code)}/scan-groups/${encodeURIComponent(groupId)}/images`,
      {
        method: "POST",
        headers: playerHeaders(playerId, playerToken),
        body: formData,
      },
    );
  },
};
