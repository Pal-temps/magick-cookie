let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let chunks: Float32Array[] = [];

export async function startRecording(): Promise<void> {
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, sampleRate: 16000 },
  });

  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(mediaStream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  chunks = [];

  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
}

export async function stopRecording(): Promise<{ samples: Float32Array; sampleRate: number }> {
  const sampleRate = audioContext?.sampleRate ?? 44100;

  // Stop media tracks
  mediaStream?.getTracks().forEach((t) => t.stop());
  mediaStream = null;

  // Close audio context
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }

  // Merge chunks
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  chunks = [];

  // Resample to 16kHz if needed
  if (Math.abs(sampleRate - 16000) > 100) {
    const resampled = await resampleTo16k(merged, sampleRate);
    return { samples: resampled, sampleRate: 16000 };
  }

  return { samples: merged, sampleRate: 16000 };
}

async function resampleTo16k(input: Float32Array, inputRate: number): Promise<Float32Array> {
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(input.length * 16000 / inputRate), 16000);
  const buffer = offlineCtx.createBuffer(1, input.length, inputRate);
  buffer.getChannelData(0).set(input);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}
