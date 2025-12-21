import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GradientCardProps extends React.ComponentProps<typeof Card> {
    variant?: 'glass' | 'gradient';
}

export function GradientCard({ variant = 'glass', children, className, ...props }: GradientCardProps) {
    const variantStyles = {
        glass: 'bg-[#161b1f]/90 backdrop-blur-lg border border-[var(--gradient-teal)]/30',
        gradient: 'bg-gradient-to-br from-[var(--gradient-teal)]/20 to-[var(--gradient-gold)]/20 border border-[var(--gradient-orange)]/30'
    };

    return (
        <Card
            className={cn(
                'rounded-2xl shadow-2xl p-3',
                variantStyles[variant],
                className
            )}
            {...props}
        >
            <CardContent className="p-8">{children}</CardContent>
        </Card>
    );
}
