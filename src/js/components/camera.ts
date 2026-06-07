let mediaStream: MediaStream | null = null;

/**
 * Starts the webcam stream and connects it to the HTML5 video element.
 */
async function startWebcam(videoElement: HTMLVideoElement): Promise<MediaStream> {
  // Stop any existing stream first
  stopWebcam();

  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  };

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = mediaStream;
    return mediaStream;
  } catch (error) {
    console.error('Failed to get webcam stream:', error);
    throw error;
  }
}

/**
 * Stops the active webcam video tracks.
 */
function stopWebcam() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

/**
 * Captures a single image frame from the video element and returns it as a JPEG Blob.
 */
function captureFrame(videoElement: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Mirror the snapshot image so it matches the user's viewport perspective
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate image blob'));
        }
      },
      'image/jpeg',
      0.85 // 85% compression quality for S3/Supabase storage conservation
    );
  });
}

/**
 * Processes a locally uploaded file and returns it as an image Blob.
 */
function processUploadedFile(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }
    resolve(file);
  });
}

export {
  startWebcam,
  stopWebcam,
  captureFrame,
  processUploadedFile
};
