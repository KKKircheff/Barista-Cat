import Image from 'next/image';
import { VoiceIndicator } from './voice-indicator';

interface BaristaImageProps {
    showVoiceIndicator?: boolean;
    voiceIndicatorSize?: number;
    voiceIndicatorSpeed?: number;
}

/**
 * Persistent barista cat image - always visible throughout the session.
 * Optionally displays a voice indicator overlay when AI is speaking.
 */
export function BaristaImage({

    showVoiceIndicator = false,
    voiceIndicatorSize = 2,
    voiceIndicatorSpeed = 1
}: BaristaImageProps) {
    return (
        <div className="flex justify-center pb-2">
            <div className="relative">
                <Image
                    src="/images/barista-cat-square.webp"
                    alt="Whiskerjack the Barista Cat"
                    width={600}
                    height={600}
                    priority
                    className="rounded-2xl shadow-2xl"
                />
                {/* Voice indicator overlay */}
                <VoiceIndicator
                    show={showVoiceIndicator}
                    size={voiceIndicatorSize}
                    speed={voiceIndicatorSpeed}
                />
            </div>
        </div>
    );
}
