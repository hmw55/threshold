import { useEffect, useRef, useState } from "react";
import {
  sessionClient,
  type ScanGroup,
} from "../services/sessionClient";

type CameraStatus =
  | "initializing"
  | "active"
  | "unavailable";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_SCAN_IMAGES = 6;

interface CapturedImage {
  id: string;
  blob: Blob;
  url: string;
}

interface ThresholdZone {
  id: string;
  deviceId: string;
  zoneName: string;
  joinedAt: string;
}

interface ScanTarget {
  thresholdId: string | null;
  label: string;
}

interface RoomScannerProps {
  sessionCode: string;
  playerId: string;
  playerToken: string;
  thresholds: ThresholdZone[];
  onClose: () => void;
}

export function RoomScanner({
  sessionCode,
  playerId,
  playerToken,
  thresholds,
  onClose,
}: RoomScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraStatus, setCameraStatus] =
    useState<CameraStatus>("initializing");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [image, setImage] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const capturedImagesRef = useRef<CapturedImage[]>([]);
  const [scanComplete, setScanComplete] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [scanGroupId, setScanGroupId] = useState<string | null>(null);
  const [objectName, setObjectName] = useState("");
  const [confirmedObjects, setConfirmedObjects] = useState<string[]>([]);
  const [isSavingObject, setIsSavingObject] = useState(false);
  const uploadInProgressRef = useRef(false);
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);
  const [scanGroups, setScanGroups] = useState<ScanGroup[]>([]);
  const [isLoadingScans, setIsLoadingScans] = useState(true);

  useEffect(() => {
    if (scanTarget) return;

    let cancelled = false;

    async function loadScanGroups() {
      setIsLoadingScans(true);

      try {
        const response = await sessionClient.getScanGroups(
          sessionCode,
          playerId,
          playerToken,
        );

        if (!cancelled) {
          setScanGroups(response.groups);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("UNABLE TO LOAD CALIBRATION PROGRESS.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingScans(false);
        }
      }
    }

    void loadScanGroups();

    return () => {
      cancelled = true;
    };
  }, [sessionCode, playerId, playerToken, scanTarget]);

  useEffect(() => {
    if (!scanTarget) {
      return;
    }
    
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("unavailable");
        setError(
          "LIVE CAMERA UNAVAILABLE. OPEN LENS THROUGH A SECURE HTTPS CONNECTION.",
        );
        return;
      }

      try {
        const mediaStream =
          await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          });

        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = mediaStream;
        streamRef.current = mediaStream;

        const video = videoRef.current;

        if (video) {
          video.srcObject = mediaStream;
          await video.play();
        }

        if (!cancelled) {
          setCameraStatus("active");
          setError(null);
        }
      } catch (caught) {
        if (cancelled) return;

        setCameraStatus("unavailable");

        if (
          caught instanceof DOMException &&
          caught.name === "NotAllowedError"
        ) {
          setError(
            "CAMERA ACCESS DENIED. ENABLE CAMERA PERMISSION IN YOUR BROWSER.",
          );
        } else {
          setError(
            "UNABLE TO INITIALIZE OPTICS. CHECK CAMERA ACCESS AND TRY AGAIN.",
          );
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;

      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [scanTarget]);

  useEffect(() => {
    capturedImagesRef.current = capturedImages;
  }, [capturedImages]);

  useEffect(() => {
    return () => {
      capturedImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.url);
      });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        const saved = capturedImagesRef.current.some(
          (image) => image.url === previewUrl,
        );

        if (!saved) {
          URL.revokeObjectURL(previewUrl);
        }
      }
    };
  }, [previewUrl]);

  function selectThreshold(threshold: ThresholdZone) {
    setScanTarget({
      thresholdId: threshold.id,
      label: threshold.zoneName,
    });

    setError(null);
  }

  function capture() {
    if (capturedImages.length >= MAX_SCAN_IMAGES) {
      setError("MAXIMUM ENVIRONMENT CAPTURES REACHED.");
      return;
    }

    const video = videoRef.current;

    if (
      !video ||
      cameraStatus !== "active" ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setError("CAMERA FEED IS NOT READY.");
      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("UNABLE TO CAPTURE IMAGE.");
      return;
    }

    context.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("IMAGE CAPTURE FAILED.");
          return;
        }

        if (blob.size > MAX_IMAGE_SIZE) {
          setError("IMAGE EXCEEDS 10 MB LIMIT.");
          return;
        }

        const url = URL.createObjectURL(blob);

        setImage(blob);
        setPreviewUrl(url);
        setScanComplete(false);
        setError(null);
      },
      "image/jpeg",
      0.88,
    );
  }

  function retake() {
    setImage(null);
    setPreviewUrl(null);
    setScanComplete(false);
    setError(null);
  }


  function confirm() {
    if (!image || !previewUrl) return;

    const captured: CapturedImage = {
      id: crypto.randomUUID(),
      blob: image,
      url: previewUrl,
    };

    setCapturedImages((previous) => [...previous, captured]);

    // The saved image now owns this URL.
    setPreviewUrl(null);
    setImage(null);
    setError(null);
  }

  async function confirmObject() {
    const name = objectName.trim();

    if (
      !scanComplete ||
      !scanGroupId ||
      name.length < 2 ||
      isSavingObject
    ) {
      return;
    }

    if (
      confirmedObjects.some(
        (existing) => existing.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("OBJECT ALREADY CONFIRMED.");
      return;
    }

    setIsSavingObject(true);
    setError(null);

    try {
      const result = await sessionClient.registerEnvironmentObject(
        sessionCode,
        playerId,
        playerToken,
        scanGroupId,
        name,
      );

      setConfirmedObjects((previous) => [
        ...previous,
        result.object.name,
      ]);

      setObjectName("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `OBJECT REGISTRATION FAILED: ${caught.message}`
          : "OBJECT REGISTRATION FAILED.",
      );
    } finally {
      setIsSavingObject(false);
    }
  }

  async function finishScan() {
    if (
      !scanTarget ||
      capturedImages.length === 0 ||
      uploadInProgressRef.current ||
      scanComplete
    ) {
      return;
    }

    uploadInProgressRef.current = true;
    setIsUploading(true);
    setError(null);

    let groupId = scanGroupId;

    try {
      if (!groupId) {
        const response = await sessionClient.createScanGroup(
          sessionCode,
          playerId,
          playerToken,
          scanTarget.thresholdId,
          scanTarget.label,
        );

        groupId = response.group.id;
        setScanGroupId(groupId);
      }

      for (let index = uploadedCount; index < capturedImages.length; index++) {
        await sessionClient.uploadScanImage(
          sessionCode,
          groupId,
          playerId,
          playerToken,
          capturedImages[index].blob,
        );

        setUploadedCount(index + 1);
      }

      const finalized = await sessionClient.finalizeScanGroup(
        sessionCode,
        groupId,
        playerId,
        playerToken,
      );

      if (finalized.group.status !== "uploaded") {
        throw new Error("Scan finalization was not confirmed");
      }

      setScanComplete(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `UPLOAD FAILED: ${caught.message}. RETRY TO CONTINUE.`
          : "UPLOAD FAILED. RETRY TO CONTINUE.",
      );
    } finally {
      uploadInProgressRef.current = false;
      setIsUploading(false);
    }
  }


  if (!scanTarget) {
    return (
      <section
        className="scanner-viewport"
        aria-label="Select calibration environment"
      >
        <header className="scanner-hud-header">
          <div>
            <span className="scanner-hud-brand">
              THRESHOLD // LENS
            </span>
            <span className="scanner-hud-subtitle">
              ENVIRONMENT CALIBRATION
            </span>
          </div>
          <span className="scanner-camera-status">
            SELECT ENVIRONMENT
          </span>
        </header>

        <div className="scanner-hud-bottom">
          <div className="scanner-hud-message">
            <span className="scanner-hud-label">
              [ ARCHITECT TRANSMISSION ]
            </span>
            <p>
              Select a Threshold to calibrate. Capture the surrounding
              environment from multiple angles, including connected rooms.
            </p>
          </div>

          {error && (
            <p className="scanner-hud-error" role="alert">
              [ ERROR ] {error}
            </p>
          )}

          <div className="scanner-hud-actions">
            {thresholds.map((threshold) => {
              const scanned = scanGroups.some(
                (group) =>
                  group.thresholdId === threshold.id &&
                  ["uploaded", "analyzing", "completed"].includes(group.status),
              );

              return (
                <button
                  key={threshold.id}
                  type="button"
                  className="scanner-hud-secondary"
                  onClick={() => selectThreshold(threshold)}
                  disabled={isLoadingScans || scanned}
                >
                  {threshold.zoneName} //{" "}
                  {isLoadingScans
                    ? "CHECKING..."
                    : scanned
                      ? "SCANNED ✓"
                      : "AWAITING SCAN"}
                </button>
              );
            })}
          </div>

          <p className="scanner-hud-label">
            {scanGroups.filter(
              (group) =>
                thresholds.some(
                  (threshold) => threshold.id === group.thresholdId,
                ) &&
                ["uploaded", "analyzing", "completed"].includes(group.status),
            ).filter(
              (group, index, groups) =>
                groups.findIndex(
                  (other) => other.thresholdId === group.thresholdId,
                ) === index,
            ).length}
            /{thresholds.length} THRESHOLDS CALIBRATED
          </p>

          <button
            type="button"
            className="scanner-hud-primary"
            onClick={onClose}
          >
            RETURN TO EXPEDITION
          </button>

          <div className="scanner-hud-footer">
            <span>SECTOR 01 // CALIBRATION</span>
            <span>{thresholds.length} THRESHOLDS CONNECTED</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="scanner-viewport"
      aria-label="Threshold environment scanner"
    >
      <div className="scanner-navigation">
        <button
          type="button"
          className="scanner-exit-button"
          onClick={onClose}
          aria-label="Exit environment scanner"
          disabled={isUploading || isSavingObject}
        >
          <span aria-hidden="true">←</span>
          EXIT SCANNER
        </button>

        <button
          type="button"
          className="scanner-exit-button"
          onClick={() => {
            if (!scanComplete && (capturedImages.length > 0 || previewUrl)) {
              setError(
                "FINISH THE CURRENT SCAN BEFORE CHANGING AREAS.",
              );
              return;
            }

            if (scanComplete) {
              capturedImages.forEach((captured) => {
                URL.revokeObjectURL(captured.url);
              });

              setCapturedImages([]);
              capturedImagesRef.current = [];
              setImage(null);
              setPreviewUrl(null);
              setScanComplete(false);
            }

            setCameraStatus("initializing");
            setScanGroupId(null);
            setUploadedCount(0);
            setObjectName("");
            setConfirmedObjects([]);
            setScanTarget(null);
            setError(null);
          }}
          disabled={isUploading || isSavingObject}
        >
         {scanComplete ? "SCAN ANOTHER THRESHOLD" : "CHANGE THRESHOLD"}
        </button>
      </div>
      <video
        ref={videoRef}
        className="scanner-live-video"
        autoPlay
        playsInline
        muted
        aria-label="Live rear camera view"
      />

      {previewUrl && (
        <img
          className="scanner-captured-image"
          src={previewUrl}
          alt="Captured environment"
        />
      )}

      <div className="scanner-camera-tint" aria-hidden="true" />
      <div className="scanner-camera-scanlines" aria-hidden="true" />

      <header className="scanner-hud-header">
        <div>
          <span className="scanner-hud-brand">
            THRESHOLD // LENS
          </span>
          <span className="scanner-hud-subtitle">
            {scanTarget.label} // RECONNAISSANCE
          </span>
        </div>

        <span className="scanner-camera-status">
          <span className="indicator-dot" />
          {scanComplete
            ? "SCAN COMPLETE"
            : previewUrl
              ? "IMAGE CAPTURED"
              : cameraStatus === "active"
                ? "OPTICS ACTIVE"
                : cameraStatus === "initializing"
                  ? "INITIALIZING"
                  : "SIGNAL LOST"}
        </span>
      </header>

      {!previewUrl && (
        <div className="scanner-hud-reticle" aria-hidden="true">
          <span className="scanner-crosshair">+</span>
        </div>
      )}

      <div className="scanner-hud-bottom">
        <div className="scanner-hud-message">
          <span className="scanner-hud-label">
            [ ARCHITECT TRANSMISSION ]
          </span>

          <p>
            {scanComplete
              ? `${capturedImages.length} environment images secured. Await further instructions.`
              : previewUrl
                ? "Review the captured environment."
                : cameraStatus === "active"
                  ? `Capture your environment from multiple angles. ${capturedImages.length}/${MAX_SCAN_IMAGES} images secured.`
                  : "Establishing visual connection..."}
          </p>
        </div>

        {error && (
          <p className="scanner-hud-error" role="alert">
            [ ERROR ] {error}
          </p>
        )}

        {scanComplete ? (
          <div className="scanner-hud-actions">
            <div className="scanner-hud-confirmation" role="status">
              ✓ {capturedImages.length} ENVIRONMENT IMAGES SECURED
            </div>

            <label htmlFor="confirmed-object" className="scanner-hud-label">
              IDENTIFY AN OBJECT IN THIS ENVIRONMENT
            </label>

            <input
              id="confirmed-object"
              type="text"
              value={objectName}
              onChange={(event) => setObjectName(event.target.value)}
              placeholder="e.g. bookshelf, lamp, coffee table"
              maxLength={100}
              disabled={isSavingObject}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "16px",
                color: "#fff",
                background: "#14191d",
                border: "1px solid #82949a",
                borderRadius: "4px",
              }}
            />

            <button
              type="button"
              className="scanner-hud-primary"
              onClick={() => void confirmObject()}
              disabled={isSavingObject || objectName.trim().length < 2}
            >
              {isSavingObject ? "REGISTERING..." : "CONFIRM OBJECT"}
            </button>

            {confirmedObjects.length > 0 && (
              <p className="scanner-hud-label" role="status">
                {confirmedObjects.length} OBJECTS CONFIRMED:{" "}
                {confirmedObjects.join(", ")}
              </p>
            )}
          </div>
        ) : previewUrl ? (
          <div className="scanner-hud-actions">
            <button
              type="button"
              className="scanner-hud-secondary"
              onClick={retake}
            >
              RETAKE
            </button>

            <button
              type="button"
              className="scanner-hud-primary"
              onClick={confirm}
            >
              SAVE CAPTURE
            </button>
          </div>
        ) : (
          <div className="scanner-hud-actions">
            <button
              type="button"
              className="scanner-hud-primary"
              onClick={capture}
              disabled={
                cameraStatus !== "active" ||
                capturedImages.length >= MAX_SCAN_IMAGES
              }
            >
              {cameraStatus === "initializing"
                ? "INITIALIZING OPTICS..."
                : capturedImages.length >= MAX_SCAN_IMAGES
                  ? "CAPTURE LIMIT REACHED"
                  : `CAPTURE ${capturedImages.length + 1}/${MAX_SCAN_IMAGES}`}
            </button>

            {capturedImages.length > 0 && (
              <button
                type="button"
                className="scanner-hud-secondary"
                onClick={() => void finishScan()}
                disabled={isUploading || isSavingObject}
              >
                {isUploading
                  ? uploadedCount === capturedImages.length
                    ? "FINALIZING SCAN..."
                    : `UPLOADING ${uploadedCount}/${capturedImages.length}...`
                  : uploadedCount === capturedImages.length
                    ? "RETRY FINALIZATION"
                    : uploadedCount > 0
                      ? "RETRY UPLOAD"
                      : "FINISH SCAN"}
              </button>
            )}
          </div>
        )}

        <div className="scanner-hud-footer">
          <span>SECTOR 01 // RECON</span>
          <span>
            {capturedImages.length}/{MAX_SCAN_IMAGES} CAPTURED
          </span>
        </div>
      </div>
    </section>
  );
}
