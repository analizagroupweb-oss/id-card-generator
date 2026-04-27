export function createCameraController({ videoElement, canvasElement, onStatusChange, onCapture }) {
  let stream = null;
  let preferredFacingMode = "user";
  let activeFacingMode = null;

  function getFacingLabel(facingMode) {
    return facingMode === "environment" ? "Back" : "Front";
  }

  function updateVideoPreviewOrientation() {
    const isUserFacing = activeFacingMode === "user";
    videoElement.style.transform = isUserFacing ? "scaleX(-1)" : "scaleX(1)";
    videoElement.style.transformOrigin = "center";
  }

  function updateStatus(baseStatus) {
    const facingSuffix = activeFacingMode ? ` (${getFacingLabel(activeFacingMode)})` : "";
    onStatusChange(`${baseStatus}${facingSuffix}`);
  }

  function waitForVideoReady() {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Video preview did not become ready in time."));
      }, 5000);

      function cleanup() {
        window.clearTimeout(timeout);
        videoElement.removeEventListener("loadedmetadata", handleReady);
        videoElement.removeEventListener("canplay", handleReady);
        videoElement.removeEventListener("error", handleError);
      }

      async function handleReady() {
        try {
          await videoElement.play();
        } catch (error) {
          cleanup();
          reject(error);
          return;
        }

        cleanup();
        resolve();
      }

      function handleError() {
        cleanup();
        reject(new Error("The browser could not render the camera stream."));
      }

      videoElement.addEventListener("loadedmetadata", handleReady, { once: true });
      videoElement.addEventListener("canplay", handleReady, { once: true });
      videoElement.addEventListener("error", handleError, { once: true });
    });
  }

  async function tryGetUserMedia(constraintsList) {
    let lastError = null;

    for (const constraints of constraintsList) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
        console.warn("Camera constraints failed:", constraints, error);
      }
    }

    throw lastError;
  }

  function getEnvironmentIssue() {
    if (window.location.protocol === "file:") {
      return {
        code: "file_origin",
        message: "Camera access is blocked on file:// pages. Open this app through http://localhost instead.",
      };
    }

    if (!window.isSecureContext) {
      return {
        code: "insecure_context",
        message: "Camera access requires a secure context such as https:// or http://localhost.",
      };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        code: "unsupported",
        message: "This browser does not support camera access.",
      };
    }

    return null;
  }

  async function openStream(facingMode) {
    const primaryVideoConstraints =
      facingMode === "user"
        ? [
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { exact: "user" },
            },
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
          ]
        : [
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { exact: "environment" },
            },
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "environment",
            },
          ];

    const fallbackVideoConstraints =
      facingMode === "user"
        ? [
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "environment",
            },
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            true,
          ]
        : [
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            true,
          ];

    const constraintsList = [...primaryVideoConstraints, ...fallbackVideoConstraints].map((video) => ({
      video,
      audio: false,
    }));

    stream = await tryGetUserMedia(constraintsList);
    activeFacingMode =
      stream.getVideoTracks()[0]?.getSettings?.().facingMode || facingMode;
    videoElement.srcObject = stream;
    updateVideoPreviewOrientation();
    await waitForVideoReady();
    updateStatus("Ready");

    return {
      ok: true,
      facingMode: activeFacingMode,
      facingLabel: getFacingLabel(activeFacingMode),
    };
  }

  async function start() {
    if (stream) {
      updateStatus("Ready");
      return {
        ok: true,
        facingMode: activeFacingMode,
        facingLabel: getFacingLabel(activeFacingMode || preferredFacingMode),
      };
    }

    const environmentIssue = getEnvironmentIssue();

    if (environmentIssue) {
      updateStatus("Unavailable");
      return { ok: false, ...environmentIssue };
    }

    try {
      return await openStream(preferredFacingMode);
    } catch (error) {
      console.error("Camera start failed:", error);
      stop();
      updateStatus("Blocked");

      if (error?.name === "NotAllowedError") {
        return {
          ok: false,
          code: "permission_denied",
          message: "Camera permission was denied. Allow camera access in the browser site settings and try again.",
        };
      }

      if (error?.name === "NotFoundError") {
        return {
          ok: false,
          code: "device_missing",
          message: "No camera device was found on this system.",
        };
      }

      if (error?.name === "NotReadableError") {
        return {
          ok: false,
          code: "device_busy",
          message: "The camera is busy in another app or browser tab. Close it there and try again.",
        };
      }

      if (error?.name === "OverconstrainedError") {
        return {
          ok: false,
          code: "unsupported_constraints",
          message: "This camera rejected the requested video settings. Try refreshing and starting the camera again.",
        };
      }

      return {
        ok: false,
        code: "unknown",
        message: `Unable to start the camera in this browser session${error?.name ? ` (${error.name})` : ""}.`,
      };
    }
  }

  function capture() {
    if (!stream) {
      return null;
    }

    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;

    if (!width || !height) {
      return null;
    }

    canvasElement.width = width;
    canvasElement.height = height;
    const context = canvasElement.getContext("2d");

    if (!context) {
      return null;
    }

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.drawImage(videoElement, 0, 0, width, height);
    context.restore();

    const dataUrl = canvasElement.toDataURL("image/png");
    onCapture(dataUrl);
    return dataUrl;
  }

  function stop() {
    if (!stream) {
      activeFacingMode = null;
      updateVideoPreviewOrientation();
      return;
    }

    stream.getTracks().forEach((track) => track.stop());
    videoElement.srcObject = null;
    stream = null;
    activeFacingMode = null;
    updateVideoPreviewOrientation();
    updateStatus("Idle");
  }

  async function flipCamera() {
    const nextFacingMode = preferredFacingMode === "user" ? "environment" : "user";
    preferredFacingMode = nextFacingMode;

    if (!stream) {
      updateStatus(`Idle - ${getFacingLabel(preferredFacingMode)} Selected`);
      return {
        ok: true,
        facingMode: preferredFacingMode,
        facingLabel: getFacingLabel(preferredFacingMode),
      };
    }

    stop();

    try {
      return await openStream(preferredFacingMode);
    } catch (error) {
      console.error("Camera flip failed:", error);
      stop();
      updateStatus("Blocked");

      return {
        ok: false,
        message: `Unable to switch camera${error?.name ? ` (${error.name})` : ""}.`,
      };
    }
  }

  window.addEventListener("beforeunload", stop);

  updateStatus("Idle");

  return {
    start,
    capture,
    stop,
    flipCamera,
    getEnvironmentIssue,
  };
}
