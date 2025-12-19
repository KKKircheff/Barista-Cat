import { VoiceChat } from '@/components/voice-chat/voice-chat';
import { GradientCard } from '@/components/shared/gradient-card';

export default function Home() {
    return (
        <div className="flex min-h-screen items-center justify-center custom-gradient">
            <main className="flex flex-col items-center justify-center gap-8 p-8 max-w-3xl w-full">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl pb-2 font-bold text-white tracking-tight text-shadow-glow">
                        Welcome to Whiskerjack's Bar
                    </h1>
                </div>

                <GradientCard className="w-full">
                    <VoiceChat />
                </GradientCard>

            </main>
        </div>
    );
}
