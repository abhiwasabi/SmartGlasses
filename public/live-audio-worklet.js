// Keep microphone processing off the UI thread, including on mobile Safari.
class LiveAudioCapture extends AudioWorkletProcessor {
  constructor() { super(); this.samples = []; }
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (input) {
      for (const sample of input) this.samples.push(sample);
      if (this.samples.length >= sampleRate / 20) {
        const chunk = new Float32Array(this.samples);
        this.port.postMessage(chunk, [chunk.buffer]);
        this.samples = [];
      }
    }
    // Connected to destination to keep processing alive, but never monitor the mic.
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor('live-audio-capture', LiveAudioCapture);
