
import { useEffect, useRef, useState } from "react";

interface FieldEvidenceCameraProps {
  onCapture: (image: Blob | null) => void;
  disabled?: boolean;
  label?: string;
}

export function FieldEvidenceCamera({
  onCapture,
  disabled = false,
  label = "EVIDENCE",
}: FieldEvidenceCameraProps) {
  const [active, setActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera unavailable. Check browser permissions.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled) {
          setError("CAMERA UNAVAILABLE. CHECK PERMISSIONS AND TRY AGAIN.");
          setActive(false);
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      if (!blob) return;

      setPreviewUrl(URL.createObjectURL(blob));
      onCapture(blob);
      setActive(false);
    }, "image/jpeg", 0.9);
  }

  function reset(reopen: boolean) {
    setPreviewUrl(null);
    onCapture(null);
    setError("");
    setActive(reopen);
  }

  return (
    <div className="field-evidence-camera">
      <label>TAKE OR CHOOSE AN EVIDENCE PHOTO
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={disabled}
          onChange={e => { const file = e.target.files?.[0]; if (file) { setPreviewUrl(URL.createObjectURL(file)); onCapture(file); setActive(false); } }} />
      </label>
      {error && <p role="alert" className="field-error">{error}</p>}

      {active || previewUrl ? (
        <div className="scanner-viewport field-camera-viewport">
          {active && (
            <video
              ref={videoRef}
              className="scanner-live-video"
              autoPlay
              playsInline
              muted
              aria-label={`${label} camera`}
            />
          )}

          {previewUrl && (
            <img
              className="scanner-captured-image"
              src={previewUrl}
              alt={`${label} evidence preview`}
            />
          )}

          <div className="scanner-camera-tint" aria-hidden="true" />
          <div className="scanner-camera-scanlines" aria-hidden="true" />

          <header className="scanner-hud-header">
            <div>
              <span className="scanner-hud-brand">THRESHOLD // LENS</span>
              <span className="scanner-hud-subtitle">{label} // CAPTURE</span>
            </div>
            <span className="scanner-camera-status">
              <span className="indicator-dot" />
              {previewUrl ? "IMAGE CAPTURED" : "OPTICS ACTIVE"}
            </span>
          </header>

          {active && (
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
                {previewUrl
                  ? "Review the evidence. Retake if the image is unclear."
                  : "Frame the real object. Do not handle unsafe objects."}
              </p>
            </div>

            <div className="scanner-hud-actions">
              {previewUrl ? (
                <button
                  type="button"
                  className="scanner-hud-secondary"
                  disabled={disabled}
                  onClick={() => reset(true)}
                >
                  RETAKE
                </button>
              ) : (
                <button
                  type="button"
                  className="scanner-hud-primary"
                  disabled={disabled}
                  onClick={capture}
                >
                  CAPTURE EVIDENCE
                </button>
              )}

              <button
                type="button"
                className="scanner-hud-secondary"
                disabled={disabled}
                onClick={() => reset(false)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setError("");
            setActive(true);
          }}
        >
          OPEN ARCHITECT CAMERA
        </button>
      )}
    </div>
  );
}
