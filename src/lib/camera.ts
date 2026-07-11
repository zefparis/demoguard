export async function captureSelfie(videoEl: HTMLVideoElement): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = videoEl.videoWidth || 1280
  canvas.height = videoEl.videoHeight || 960
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
  const b64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
  if (b64.length < 5000) {
    throw new Error('Captured image too small — camera may not be ready')
  }
  return b64
}

export async function startCameraStream(
  facingMode: 'user' | 'environment' = 'user',
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1280 },
      height: { ideal: 960 },
    },
    audio: false,
  })
}

export function stopStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}
