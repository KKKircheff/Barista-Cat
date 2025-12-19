import Image from 'next/image';

/**
 * Persistent barista cat image - always visible throughout the session.
 */
export function BaristaImage() {
    return (
        <div className="flex justify-center">
            <Image
                src="/images/barista-cat-square.webp"
                alt="Whiskerjack the Barista Cat"
                width={450}
                height={450}
                priority
                className="rounded-2xl shadow-2xl"
            />
        </div>
    );
}
