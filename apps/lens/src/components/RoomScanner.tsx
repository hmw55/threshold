
import { useEffect, useRef, useState } from "react";

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

interface RoomScannerProps {
  onClose: () => void;
}

export function RoomScanner({ onClose }: RoomScannerProps) {
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

  useEffect(() => {
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
  }, []);

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

  return (
    <section
      className="scanner-viewport"
      aria-label="Threshold environment scanner"
    >
      <button
        type="button"
        className="scanner-exit-button"
        onClick={onClose}
        aria-label="Exit environment scanner"
      >
        <span aria-hidden="true">←</span>
        EXIT SCANNER
      </button>
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
            ENVIRONMENT RECONNAISSANCE
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
          <div className="scanner-hud-confirmation" role="status">
            ✓ {capturedImages.length} ENVIRONMENT IMAGES SECURED
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
                onClick={() => setScanComplete(true)}
              >
                FINISH SCAN
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
