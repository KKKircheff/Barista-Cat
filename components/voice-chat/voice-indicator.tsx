'use client';

import { useMemo } from 'react';

interface VoiceIndicatorProps {
    show: boolean;
    size?: number; // Size multiplier (default: responsive)
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

    // Responsive size: 0.4 on mobile (< 768px), 2.0 on desktop (>= 768px)
    // Override with explicit size prop if provided
    const mobileSize = 1;
    const desktopSize = 2.0;

    // Calculate scaled dimensions
    const mobileContainerSize = 48 * mobileSize * 4;
    const mobileBarWidth = 2 * mobileSize;
    const mobileRadius = 60 * mobileSize;

    const desktopContainerSize = 48 * desktopSize * 4;
    const desktopBarWidth = 2 * desktopSize;
    const desktopRadius = 60 * desktopSize;

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 mt-15">
            {/* Mobile size (default) */}
            <div
                className="relative md:hidden"
                style={{
                    width: `${mobileContainerSize}px`,
                    height: `${mobileContainerSize}px`,
                    '--voice-size': mobileSize
                } as React.CSSProperties}
            >
                {bars.map((bar, i) => (
                    <div
                        key={i}
                        className="absolute left-1/2 bottom-1/2 bg-orange-500 animate-voice-pulse"
                        style={{
                            width: `${mobileBarWidth}px`,
                            height: `${bar.height * mobileSize}px`,
                            transformOrigin: 'bottom center',
                            transform: `rotate(${bar.rotation}deg) translateY(-${mobileRadius}px)`,
                            animationDuration: `${bar.duration * speed}s`,
                            animationDelay: `${bar.delay * speed}s`,
                            ['--rotation' as any]: `${bar.rotation}deg`,
                            ['--radius' as any]: `-${mobileRadius}px`,
                        }}
                    />
                ))}
            </div>

            {/* Desktop size */}
            <div
                className="relative hidden md:block"
                style={{
                    width: `${desktopContainerSize}px`,
                    height: `${desktopContainerSize}px`,
                    '--voice-size': desktopSize
                } as React.CSSProperties}
            >
                {bars.map((bar, i) => (
                    <div
                        key={i}
                        className="absolute left-1/2 bottom-1/2 bg-orange-500 animate-voice-pulse"
                        style={{
                            width: `${desktopBarWidth}px`,
                            height: `${bar.height * desktopSize}px`,
                            transformOrigin: 'bottom center',
                            transform: `rotate(${bar.rotation}deg) translateY(-${desktopRadius}px)`,
                            animationDuration: `${bar.duration * speed}s`,
                            animationDelay: `${bar.delay * speed}s`,
                            ['--rotation' as any]: `${bar.rotation}deg`,
                            ['--radius' as any]: `-${desktopRadius}px`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
