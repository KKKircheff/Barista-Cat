import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const COFFEES = [
    {
        name: 'Ashfall Espresso',
        ingredients: 'Dark roast espresso, scorched sugar, a pinch of smoked salt',
        description: 'Strong, bitter, and unapologetic. Like the day the bombs fell.',
    },
    {
        name: 'Wasteland Latte',
        ingredients: 'Espresso, steamed milk, canned vanilla syrup',
        description: 'Comfort in a cracked mug. Surprisingly hopeful.',
    },
    {
        name: 'Rad-Free Cold Brew',
        ingredients: 'Cold-brewed coffee, charcoal-filtered water',
        description: 'Smooth, clean, and allegedly safe.',
    },
    {
        name: 'Scavenger’s Mocha',
        ingredients: 'Espresso, cocoa powder, condensed milk',
        description: 'Sweet, rich, and traded often for ammunition.',
    },
    {
        name: 'The Cat Nap Cappuccino',
        ingredients: 'Espresso, foamed milk, cinnamon dust',
        description: 'Balanced and civilized, like a proper nap schedule.',
    },
    {
        name: 'Blackout Brew',
        ingredients: 'Triple espresso, no additives',
        description: 'For staying awake when the generator dies.',
    },
];

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

const BEERS = [
    {
        name: 'The Cure IPA',
        subtitle: 'Experimental Antidote',
        ingredients: 'American hops, sweet malts, citrus zest',
        description: 'Allegedly cures radiation sickness. It doesn’t, but after three, you won’t care about the extra toe.',
    },
    {
        name: 'Hell Yes Helles',
        subtitle: 'The Vault-Dweller’s Choice',
        ingredients: 'Traditional lager yeast, mild noble hops',
        description: 'A crisp lager for when the world is burning. Smooth enough to forget the sky is red.',
    },
    {
        name: 'Back to Black Stout',
        subtitle: 'Liquid Charcoal',
        ingredients: 'Roasted malts, coffee beans, dark chocolate',
        description: 'As dark as a mutant’s heart. Tastes like a campfire in a graveyard.',
    },
    {
        name: 'FCK’N HELL DIPA',
        subtitle: 'Warning: Highly Volatile',
        ingredients: 'Aggressive dry-hopping, high-ABV grain bill',
        description: 'Hits like a falling skyscraper. Keep away from open flames and irritable raiders.',
    },
    {
        name: 'Hop Trop NEIPA',
        subtitle: 'Tropical Hallucination',
        ingredients: 'Tropical fruit esters, hazy yeast, "filtered" water',
        description: 'A hazy dream of a vacation that never happened. Tastes like pineapple and broken promises.',
    },
    {
        name: 'Black Milk Stout',
        subtitle: 'Bunker-Aged Cream',
        ingredients: 'Lactose, cocoa, hazelnut, vanilla',
        description: 'A dessert for the end of the world. Contains real dairy salvaged from an old bunker.',
    },
];

interface MenuCardProps {
    onClose?: () => void;
}

export function MenuCard({ onClose }: MenuCardProps) {
    return (
        <Card className="w-full max-w-4xl mx-auto bg-[#161b1f]/90 text-gray-300 p-1">
            <CardHeader className="relative px-2">
                <CardTitle className="text-2xl text-gray-300">Menu</CardTitle>
                {onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-8 w-8 text-gray-300"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent className="max-h-100 overflow-y-auto px-2">
                <div className="grid gap-4 md:grid-cols-3">
                    {/* Cocktail Section */}
                    <div className="md:pl-4">
                        <h2 className="text-xl font-semibold mb-4 text-gray-200">Cocktails</h2>
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
                    </div>

                    {/* Beer Section */}
                    <div className="md:pl-4">
                        <h2 className="text-xl font-semibold mb-4 text-gray-200">Beers</h2>
                        <div className="grid gap-4">
                            {BEERS.map((drink, index) => (
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
                    </div>

                    {/* Coffee Section */}
                    <div className="md:pl-4">
                        <h2 className="text-xl font-semibold mb-4 text-gray-200">Coffees</h2>
                        <div className="grid gap-4">
                            {COFFEES.map((drink, index) => (
                                <div key={index} className="border-b pb-3 last:border-b-0">
                                    <h3 className="font-semibold text-lg text-gray-200">
                                        {drink.name}
                                    </h3>
                                    <p className="text-sm text-gray-400 italic">{drink.ingredients}</p>
                                    <p className="text-sm mt-1 text-gray-200">{drink.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}