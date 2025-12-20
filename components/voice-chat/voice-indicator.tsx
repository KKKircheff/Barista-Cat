'use client';

import { useMemo } from 'react';

interface VoiceIndicatorProps {
    show: boolean;
    size?: number; // Size multiplier (default: 1)
    speed?: number; // Animation speed multiplier (default: 1, lower = faster)
}


export function VoiceIndicator({ show, size = 2, speed = 1 }: VoiceIndicatorProps) {

    const bars = useMemo(() => {
        return Array.from({ length: 60 }).map((_, i) => ({
            rotation: i * 6, // 360 degrees / 60 bars = 6 degrees each
            height: 20 + Math.random() * 30, // Random height between 20-50px
            duration: 0.5 + Math.random() * 0.5, // Random duration between 0.5-1s
            delay: Math.random() * 0.3, // Random delay between 0-0.3s
        }));
    }, []); // Empty dependency array - only generate once

    if (!show) return null;

    // Calculate scaled dimensions
    const containerSize = 48 * size; // Base size is 48 (12rem = 192px)
    const barWidth = 2 * size; // Base bar width is 1 (0.25rem = 4px)
    const radius = 60 * size; // Base radius is 60px

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 mt-15">
            <div className="relative" style={{ width: `${containerSize * 4}px`, height: `${containerSize * 4}px` }}>
                {/* Circular bars - 60 bars around circle */}
                {bars.map((bar, i) => (
                    <div
                        key={i}
                        className="absolute left-1/2 bottom-1/2 bg-orange-500 animate-voice-pulse"
                        style={{
                            width: `${barWidth}px`,
                            height: `${bar.height * size}px`,
                            transformOrigin: 'bottom center',
                            transform: `rotate(${bar.rotation}deg) translateY(-${radius}px)`,
                            animationDuration: `${bar.duration * speed}s`,
                            animationDelay: `${bar.delay * speed}s`,
                            // Store the rotation and radius in CSS variables for the animation to use
                            ['--rotation' as any]: `${bar.rotation}deg`,
                            ['--radius' as any]: `-${radius}px`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
