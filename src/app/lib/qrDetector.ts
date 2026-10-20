import jsQR from 'jsqr';

export interface QrDetectResult {
  rawValue: string;
}

export interface QrDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<QrDetectResult[]>;
}

interface NativeBarcodeDetectorWindow extends Window {
  BarcodeDetector?: new (options?: { formats?: string[] }) => QrDetectorLike;
}

/**
 * Returns a QR detector for the camera video element.
 * Uses the native BarcodeDetector when the browser supports it (Chrome on Android),
 * otherwise falls back to decoding video frames with jsQR so scanning also works on
 * iOS Safari, Firefox, and desktop browsers.
 */
export function createQrDetector(): QrDetectorLike {
  const Native = (window as NativeBarcodeDetectorWindow).BarcodeDetector;
  if (Native) {
    try {
      return new Native({ formats: ['qr_code'] });
    } catch {
      // fall through to the jsQR decoder
    }
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  return {
    detect: async (video: HTMLVideoElement) => {
      if (!ctx || !video.videoWidth || !video.videoHeight) return [];
      // Downscale large frames to keep decoding fast on phones.
      const maxSide = 640;
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);
      const frame = ctx.getImageData(0, 0, width, height);
      const code = jsQR(frame.data, width, height, { inversionAttempts: 'attemptBoth' });
      return code?.data ? [{ rawValue: code.data }] : [];
    }
  };
}

