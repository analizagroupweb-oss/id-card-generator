export function createCameraController({ videoElement, canvasElement, onStatusChange, onCapture }) {
  let stream = null;

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

  async function start() {
    if (stream) {
      onStatusChange("Ready");
      return { ok: true };
    }

    const environmentIssue = getEnvironmentIssue();

    if (environmentIssue) {
      onStatusChange("Unavailable");
      return { ok: false, ...environmentIssue };
    }

    try {
      stream = await tryGetUserMedia([
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        },
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ]);

      videoElement.srcObject = stream;
      await waitForVideoReady();
      onStatusChange("Ready");
      return { ok: true };
    } catch (error) {
      console.error("Camera start failed:", error);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
        videoElement.srcObject = null;
      }
      onStatusChange("Blocked");

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
    context.drawImage(videoElement, 0, 0, width, height);
    const dataUrl = canvasElement.toDataURL("image/png");
    onCapture(dataUrl);
    return dataUrl;
  }

  function stop() {
    if (!stream) {
      return;
    }

    stream.getTracks().forEach((track) => track.stop());
    videoElement.srcObject = null;
    stream = null;
    onStatusChange("Idle");
  }

  window.addEventListener("beforeunload", stop);

  return {
    start,
    capture,
    stop,
    getEnvironmentIssue,
  };
}
