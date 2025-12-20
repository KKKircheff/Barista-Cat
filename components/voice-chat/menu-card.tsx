import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const COCKTAILS = [
    {
        name: 'Molotov Mocktail',
        subtitle: '(Not Actually Explosive)',
        ingredients: 'Citrus juice, soda water, chili flakes',
        description: 'Bright, spicy, and legally non-lethal.',
    },
    {
        name: 'The Fallout Fizz',
        ingredients: 'Gin, tonic, preserved lime',
        description: 'Refreshing, sharp, and faintly nostalgic.',
    },
    {
        name: 'Nine Lives Negroni',
        ingredients: 'Gin, bitter aperitif, sweet vermouth',
        description: 'Strong, balanced, and dangerous in the right paws.',
    },
    {
        name: 'Dusty Old Fashioned',
        ingredients: 'Whiskey, sugar cube, bitters',
        description: 'Old world class in a broken glass.',
    },
    {
        name: 'The Scavenged Spritz',
        ingredients: 'Sparkling wine, herbal liqueur, soda',
        description: 'Light, fizzy, and suspiciously cheerful.',
    },
    {
        name: 'Midnight Milk Punch',
        ingredients: 'Rum, milk, nutmeg',
        description: 'Smooth, calming, and perfect before curfew.',
    },
];

interface MenuCardProps {
    onClose?: () => void;
}

export function MenuCard({ onClose }: MenuCardProps) {
    return (
        <Card className="w-full max-w-2xl mx-auto bg-[#161b1f]/90 text-gray-300">
            <CardHeader className="relative">
                <CardTitle className="text-2xl text-gray-300">Cocktails Menu</CardTitle>
                {onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 h-8 w-8 text-gray-300"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="grid gap-4">
                    {COCKTAILS.map((drink, index) => (
                        <div key={index} className="border-b pb-3 last:border-b-0">
                            <h3 className="font-semibold text-lg text-gray-200">
                                {drink.name}
                                {drink.subtitle && <span className="text-sm ml-1 text-white">{drink.subtitle}</span>}
                            </h3>
                            <p className="text-sm text-gray-400 italic">{drink.ingredients}</p>
                            <p className="text-sm mt-1 text-gray-200">{drink.description}</p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
