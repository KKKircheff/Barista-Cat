import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GradientButtonProps extends Omit<React.ComponentProps<typeof Button>, 'variant'> {
    variant?: 'purple-pink' | 'green' | 'red' | 'ghost';
}

export function GradientButton({
    variant = 'purple-pink',
    className,
    children,
    ...props
}: GradientButtonProps) {
    const variantStyles = {
        'purple-pink':
            'bg-gradient-to-r from-[var(--gradient-orange)] to-[var(--gradient-rust)] hover:from-[var(--gradient-rust)] hover:to-[var(--gradient-orange)] text-white border-0 shadow-[0_0_20px_rgba(91,129,131,0.5)] hover:shadow-[0_0_30px_rgba(255,178,68,0.7)]',
        // 'bg-gradient-to-r from-[var(--gradient-teal)] to-[var(--gradient-gold)] hover:from-[var(--gradient-orange)] hover:to-[var(--gradient-rust)] text-white border-0 shadow-[0_0_20px_rgba(91,129,131,0.5)] hover:shadow-[0_0_30px_rgba(255,178,68,0.7)]',
        green: 'bg-[var(--gradient-teal)] hover:bg-[var(--gradient-teal)]/80 text-white border-0 shadow-[0_0_20px_rgba(91,129,131,0.5)]',
        red: 'bg-[var(--gradient-rust)] hover:bg-[var(--gradient-rust)]/80 text-white border-0 animate-pulse shadow-[0_0_20px_rgba(158,71,0,0.6)]',
        ghost:
            'bg-white/15 hover:bg-white/25 text-white border border-[var(--gradient-teal)]/50 backdrop-blur-sm',
    };

    return (
        <Button
            className={cn(
                'rounded-full px-8 py-4 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-shadow-glow',
                variantStyles[variant],
                className
            )}
            {...props}
        >
            {children}
        </Button>
    );
}
