/**
 * VAD Recorder — Real-time Voice Activity Detection during recording
 *
 * Uses AudioWorklet (with AnalyserNode fallback) to run energy-based VAD
 * on the normalized signal during recording. Stops when cumulative voiced
 * duration reaches MIN_VOICED_DURATION_MS, with MAX_RECORDING_MS safety cap.
 *
 * VAD thresholds are centralized in vad-thresholds.ts (P10-FINAL reference).
 * See vad-thresholds.ts for cross-repo synchronization requirements.
 *
 * The client NEVER computes a liveness score — VAD only controls WHEN to
 * stop recording. Confidence decision remains 100% on HCS backend.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { pickMimeType } from './audio';
import { VAD_ENERGY_THRESHOLD as _VAD_THRESHOLD, MIN_VOICED_DURATION_MS, MAX_RECORDING_MS } from './vad-thresholds';

export { MIN_VOICED_DURATION_MS, MAX_RECORDING_MS };
export const VAD_ENERGY_THRESHOLD = _VAD_THRESHOLD;

const VAD_PROCESSOR_CODE = `
class VadProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      const samples = input[0];
      let sumSq = 0;
      for (let i = 0; i < samples.length; i++) {
        sumSq += samples[i] * samples[i];
      }
      const energy = sumSq / samples.length;
      this.port.postMessage({ energy, frameSize: samples.length });
    }
    return true;
  }
}
registerProcessor('vad-processor', VadProcessor);
`;

export function createVadAccumulator(threshold: number = VAD_ENERGY_THRESHOLD) {
  let voicedDurationMs = 0;
  let maxEnergy = 1e-10;

  return {
    processFrame(energy: number, frameDurationMs: number) {
      if (energy > maxEnergy) maxEnergy = energy;
      const voiced = energy > threshold;
      if (voiced) voicedDurationMs += frameDurationMs;
      return { voiced, voicedDurationMs, maxEnergy };
    },
    getVoicedDurationMs: () => voicedDurationMs,
    getMaxEnergy: () => maxEnergy,
  };
}

export type VadMode = 'audioworklet' | 'analyser' | 'none';

export interface VadRecordingResult {
  blob: Blob | null;
  mimeType: string;
  voicedDurationMs: number;
  totalDurationMs: number;
  interrupted: boolean;
  interruptReason?: string;
  timeout: boolean;
  chunksCount: number;
  debug: {
    pickedMimeType: string;
    recorderStateAtStop: string;
    trackMuted: boolean;
    trackReadyState: string;
    vadMode: VadMode;
    maxEnergy: number;
  };
}

export async function recordAudioWithVad(options: {
  minVoicedDurationMs?: number;
  maxRecordingMs?: number;
  energyThreshold?: number;
} = {}): Promise<VadRecordingResult> {
  const minVoicedMs = options.minVoicedDurationMs ?? MIN_VOICED_DURATION_MS;
  const maxRecordingMs = options.maxRecordingMs ?? MAX_RECORDING_MS;
  const energyThreshold = options.energyThreshold ?? VAD_ENERGY_THRESHOLD;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];

  const recordStart = performance.now();
  let audioInterrupted = false;
  let interruptReason = '';
  const track = stream.getAudioTracks()[0];
  const onTrackEnded = () => {
    audioInterrupted = true;
    interruptReason = 'track_ended_prematurely';
  };
  if (track) track.addEventListener('ended', onTrackEnded);

  const onVisibilityChange = () => {
    if (document.hidden) {
      audioInterrupted = true;
      interruptReason = 'page_visibility_hidden';
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  let blob: Blob | null = null;
  const stopPromise = new Promise<void>((resolve) => {
    recorder.onstop = () => {
      blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      resolve();
    };
  });

  const AudioCtx = window.AudioContext
    || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  // TEMP-DEBUG: log AudioContext state at creation
  console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'audioCtx_created', state: audioCtx.state, sampleRate: audioCtx.sampleRate }));
  if (audioCtx.state === 'suspended') {
    // TEMP-DEBUG: log resume attempt
    console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'resume_attempt', state: audioCtx.state }));
    try {
      await audioCtx.resume();
      // TEMP-DEBUG: log resume success
      console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'resume_result', success: true, state: audioCtx.state }));
    } catch (resumeErr) {
      // TEMP-DEBUG: log resume failure — this is the prime suspect for intermittent timeout
      console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'resume_result', success: false, state: audioCtx.state, error: resumeErr instanceof Error ? resumeErr.message : String(resumeErr) }));
    }
  }

  const sourceNode = audioCtx.createMediaStreamSource(stream);
  const vad = createVadAccumulator(energyThreshold);
  let vadMode: VadMode = 'none';
  let vadInterval: ReturnType<typeof setInterval> | null = null;
  let analyser: AnalyserNode | null = null;
  let workletNode: AudioWorkletNode | null = null;

  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;
  silentGain.connect(audioCtx.destination);

  let workletFirstFrameReceived = false; // TEMP-DEBUG: detect if worklet never receives frames
  try {
    const blobUrl = URL.createObjectURL(
      new Blob([VAD_PROCESSOR_CODE], { type: 'application/javascript' }),
    );
    await audioCtx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    workletNode = new AudioWorkletNode(audioCtx, 'vad-processor');
    sourceNode.connect(workletNode);
    workletNode.connect(silentGain);
    vadMode = 'audioworklet';
    // TEMP-DEBUG: log worklet path selected and audioCtx state at this point
    console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'worklet_loaded', state: audioCtx.state }));

    workletNode.port.onmessage = (e: MessageEvent) => {
      if (!workletFirstFrameReceived) {
        workletFirstFrameReceived = true;
        // TEMP-DEBUG: log first frame arrival — if this never fires, worklet is loaded but no audio flows
        console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'worklet_first_frame', state: audioCtx.state, elapsedMs: Math.round(performance.now() - recordStart) }));
      }
      const { energy, frameSize } = e.data as { energy: number; frameSize: number };
      const frameDurationMs = (frameSize / audioCtx.sampleRate) * 1000;
      vad.processFrame(energy, frameDurationMs);
    };
  } catch (workletErr) {
    // TEMP-DEBUG: log worklet failure reason — was silently swallowed before
    console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'worklet_failed', error: workletErr instanceof Error ? workletErr.message : String(workletErr), state: audioCtx.state }));
    workletNode = null;
    try {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      sourceNode.connect(analyser);
      analyser.connect(silentGain);
      vadMode = 'analyser';
      // TEMP-DEBUG: log analyser fallback selected
      console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'analyser_fallback', state: audioCtx.state }));

      let analyserFirstFrame = false; // TEMP-DEBUG
      const timeData = new Float32Array(analyser.fftSize);
      vadInterval = setInterval(() => {
        if (!analyser) return;
        analyser.getFloatTimeDomainData(timeData);
        if (!analyserFirstFrame) {
          analyserFirstFrame = true;
          // TEMP-DEBUG: log first analyser frame
          console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'analyser_first_frame', state: audioCtx.state, elapsedMs: Math.round(performance.now() - recordStart) }));
        }
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSq += timeData[i] * timeData[i];
        }
        const energy = sumSq / timeData.length;
        const frameDurationMs = (timeData.length / audioCtx.sampleRate) * 1000;
        vad.processFrame(energy, frameDurationMs);
      }, 25);
    } catch {
      vadMode = 'none';
    }
  }

  recorder.start(250);
  // TEMP-DEBUG: log recorder start and audioCtx state at recording start
  console.log(JSON.stringify({ event: '[VAD-DEBUG]', stage: 'recorder_started', recorderState: recorder.state, audioCtxState: audioCtx.state, vadMode }));

  let timeout = false;
  // TEMP-DEBUG: periodic voiced-duration sampler — logs every 1000ms to see if accumulation progresses
  const debugSampler = setInterval(() => {
    const elapsed = Math.round(performance.now() - recordStart);
    console.log(JSON.stringify({
      event: '[VAD-DEBUG]',
      stage: 'progress_sample',
      elapsedMs: elapsed,
      voicedDurationMs: Math.round(vad.getVoicedDurationMs()),
      targetVoicedMs: minVoicedMs,
      audioCtxState: audioCtx.state,
      vadMode,
      maxEnergy: vad.getMaxEnergy(),
      workletFirstFrameReceived,
    }));
  }, 1000);

  await new Promise<void>((resolve) => {
    if (vadMode === 'none') {
      setTimeout(resolve, maxRecordingMs);
      return;
    }

    const checkInterval = setInterval(() => {
      const elapsed = performance.now() - recordStart;
      if (audioInterrupted) {
        clearInterval(checkInterval);
        resolve();
        return;
      }
      if (vad.getVoicedDurationMs() >= minVoicedMs) {
        clearInterval(checkInterval);
        resolve();
        return;
      }
      if (elapsed >= maxRecordingMs) {
        timeout = true;
        clearInterval(checkInterval);
        resolve();
        return;
      }
    }, 50);
  });

  clearInterval(debugSampler); // TEMP-DEBUG: stop periodic sampler

  const recorderStateAtStop = recorder.state;
  const trackMuted = track ? track.muted : false;
  const trackReadyState = track ? track.readyState : 'unknown';

  if (recorder.state === 'recording') {
    recorder.stop();
  }

  if (recorder.state === 'inactive') {
    blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
  } else {
    await stopPromise;
  }

  if (vadInterval) clearInterval(vadInterval);
  if (workletNode) {
    workletNode.port.onmessage = null;
    workletNode.disconnect();
  }
  if (analyser) analyser.disconnect();
  if (silentGain) silentGain.disconnect();
  sourceNode.disconnect();
  try { await audioCtx.close(); } catch { /* ignore */ }
  if (track) track.removeEventListener('ended', onTrackEnded);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  stream.getTracks().forEach(t => t.stop());

  const totalDurationMs = Math.round(performance.now() - recordStart);
  const actualMimeType = blob?.type || mimeType || 'audio/webm';

  console.log(JSON.stringify({
    event: '[VAD-RECORD]',
    vadMode,
    voicedDurationMs: Math.round(vad.getVoicedDurationMs()),
    totalDurationMs,
    timeout,
    interrupted: audioInterrupted,
    mimeType: actualMimeType,
    blobSize: blob?.size ?? 0,
    chunksCount: chunks.length,
    maxEnergy: vad.getMaxEnergy(),
    // TEMP-DEBUG: additional diagnostic fields for intermittent timeout investigation
    workletFirstFrameReceived, // false = worklet loaded but never got audio (suspended ctx?)
    audioCtxStateAtStop: audioCtx.state, // 'closed' expected after close()
  }));

  return {
    blob,
    mimeType: actualMimeType,
    voicedDurationMs: Math.round(vad.getVoicedDurationMs()),
    totalDurationMs,
    interrupted: audioInterrupted,
    interruptReason: interruptReason || undefined,
    timeout,
    chunksCount: chunks.length,
    debug: {
      pickedMimeType: mimeType,
      recorderStateAtStop,
      trackMuted,
      trackReadyState,
      vadMode,
      maxEnergy: vad.getMaxEnergy(),
    },
  };
}
