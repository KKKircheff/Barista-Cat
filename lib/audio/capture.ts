import type {AudioConfig} from '../types';

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
    sampleRate: 16000, // 16kHz required by Gemini
    channels: 1, // Mono
    bufferSize: 4096, // Process 4096 samples at a time (256ms @ 16kHz)
};

export async function requestMicrophoneAccess(sampleRate: number = 16000): Promise<MediaStream> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: {ideal: sampleRate},
                channelCount: {ideal: 1},
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });
        return stream;
    } catch (error) {
        throw new Error(`Failed to access microphone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function createAudioProcessor(config: AudioConfig = DEFAULT_AUDIO_CONFIG): {
    start: (onAudioChunk: (base64: string) => void) => Promise<() => void>;
    getAnalyser: () => AnalyserNode | null;
} {
    let audioContext: AudioContext | null = null;
    let analyserNode: AnalyserNode | null = null;
    let mediaStream: MediaStream | null = null;
    let workletNode: AudioWorkletNode | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;

    const start = async (onAudioChunk: (base64: string) => void): Promise<() => void> => {
        // Get microphone access
        mediaStream = await requestMicrophoneAccess(config.sampleRate);

        // Create audio context with default sample rate (browser native)
        audioContext = new AudioContext();

        // Load AudioWorklet module
        try {
            await audioContext.audioWorklet.addModule('/audio-processor.worklet.js');
        } catch (error) {
            throw new Error(
                `Failed to load AudioWorklet module: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }

        // Create analyser for visualization
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;

        // Create source from media stream
        sourceNode = audioContext.createMediaStreamSource(mediaStream);

        // Create AudioWorklet processor node
        workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor', {
            processorOptions: {
                targetSampleRate: config.sampleRate,
            },
        });

        // Handle messages from the worklet (audio data)
        workletNode.port.onmessage = (event) => {
            if (event.data.type === 'audio') {
                onAudioChunk(event.data.data);
            }
        };

        // Connect audio nodes
        // Source -> Analyser -> Worklet -> Destination
        sourceNode.connect(analyserNode);
        analyserNode.connect(workletNode);
        workletNode.connect(audioContext.destination);

        // Return stop function
        return () => {
            if (workletNode) {
                workletNode.disconnect();
                workletNode.port.close();
                workletNode = null;
            }
            if (sourceNode) {
                sourceNode.disconnect();
                sourceNode = null;
            }
            if (mediaStream) {
                mediaStream.getTracks().forEach((track) => track.stop());
                mediaStream = null;
            }
            if (audioContext) {
                audioContext.close();
                audioContext = null;
            }
            analyserNode = null;
        };
    };

    const getAnalyser = () => analyserNode;

    return {start, getAnalyser};
}

export function calculateVolumeLevel(analyser: AnalyserNode): number {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    return Math.min(100, Math.round(rms * 200)); // Scale to 0-100
}
