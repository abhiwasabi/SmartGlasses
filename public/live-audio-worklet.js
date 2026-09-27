// Keep microphone processing off the UI thread, including on mobile Safari.
class LiveAudioCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.targetRate = 16000;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (input) {
      for (let i = 0; i < input.length; i++) {
        this.samples.push(input[i]);
      }

      // Collect ~50ms of audio at the current input sample rate
      const threshold = Math.floor(sampleRate * 0.05);
      if (this.samples.length >= threshold) {
        let chunk;
        if (sampleRate === this.targetRate) {
          chunk = new Float32Array(this.samples);
        } else {
          // Linear interpolation resampling to 16,000 Hz
          const inCount = this.samples.length;
          const outCount = Math.floor(inCount * (this.targetRate / sampleRate));
          chunk = new Float32Array(outCount);
          const ratio = (inCount - 1) / (outCount - 1 || 1);
          for (let i = 0; i < outCount; i++) {
            const srcIdx = i * ratio;
            const low = Math.floor(srcIdx);
            const high = Math.min(low + 1, inCount - 1);
            const weight = srcIdx - low;
            chunk[i] = this.samples[low] * (1 - weight) + this.samples[high] * weight;
          }
        }
        this.port.postMessage(chunk, [chunk.buffer]);
        this.samples = [];
      }
    }
    // Connected to destination to keep processing alive, but never monitor the mic.
    for (const output of outputs) {
      for (const channel of output) {
        channel.fill(0);
      }
    }
    return true;
  }
}
registerProcessor('live-audio-capture', LiveAudioCapture);

