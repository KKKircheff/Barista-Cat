/**
 * AudioWorklet Processor for capturing and resampling microphone audio
 * Runs on the audio rendering thread for optimal performance
 *
 * This replaces the deprecated ScriptProcessorNode with modern Web Audio API
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Target sample rate (16kHz for Gemini)
    this.targetSampleRate = options.processorOptions?.targetSampleRate || 16000;

    // Native sample rate comes from the audio context
    this.nativeSampleRate = sampleRate; // global variable provided by AudioWorklet

    // Resampling state
    this.resampleRatio = this.nativeSampleRate / this.targetSampleRate;
    this.inputBuffer = [];
    this.outputBufferSize = 4096; // Process chunks of 4096 samples

    // Track if we need resampling
    this.needsResampling = this.nativeSampleRate !== this.targetSampleRate;
  }

  /**
   * Process audio in 128-sample blocks (quantum size)
   * This runs on the audio rendering thread
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // No input connected
    if (!input || input.length === 0) {
      return true;
    }

    // Get the first channel (mono)
    const inputChannel = input[0];

    if (!inputChannel || inputChannel.length === 0) {
      return true;
    }

    // Add samples to buffer
    this.inputBuffer.push(...inputChannel);

    // Process when we have enough samples
    if (this.inputBuffer.length >= this.outputBufferSize) {
      const samplesToProcess = this.inputBuffer.splice(0, this.outputBufferSize);
      const float32Array = new Float32Array(samplesToProcess);

      // Resample if needed
      let processedData = float32Array;
      if (this.needsResampling) {
        processedData = this.resample(float32Array);
      }

      // Convert to PCM16 and base64
      const base64Audio = this.float32ToBase64(processedData);

      // Send to main thread
      this.port.postMessage({ type: 'audio', data: base64Audio });
    }

    // Keep processor alive
    return true;
  }

  /**
   * Resample audio using linear interpolation
   */
  resample(inputData) {
    const outputLength = Math.round(inputData.length / this.resampleRatio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const position = i * this.resampleRatio;
      const index = Math.floor(position);
      const fraction = position - index;

      if (index + 1 < inputData.length) {
        // Linear interpolation
        output[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
      } else {
        output[i] = inputData[index];
      }
    }

    return output;
  }

  /**
   * Convert Float32Array to Base64 PCM16
   * Uses custom base64 encoding since btoa is not available in AudioWorklet context
   */
  float32ToBase64(float32Array) {
    // Convert to Int16Array (PCM 16-bit)
    const int16Array = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    // Convert to Uint8Array for base64 encoding
    const uint8Array = new Uint8Array(int16Array.buffer);

    // Encode to base64 using custom implementation
    return this.base64Encode(uint8Array);
  }

  /**
   * Custom base64 encoding for AudioWorklet context
   * btoa is not available in AudioWorklet, so we implement our own
   */
  base64Encode(uint8Array) {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;

    while (i < uint8Array.length) {
      const byte1 = uint8Array[i++];
      const byte2 = i < uint8Array.length ? uint8Array[i++] : 0;
      const byte3 = i < uint8Array.length ? uint8Array[i++] : 0;

      const encoded1 = byte1 >> 2;
      const encoded2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
      const encoded3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
      const encoded4 = byte3 & 0x3f;

      result += base64Chars[encoded1];
      result += base64Chars[encoded2];
      result += i - 2 < uint8Array.length ? base64Chars[encoded3] : '=';
      result += i - 1 < uint8Array.length ? base64Chars[encoded4] : '=';
    }

    return result;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
