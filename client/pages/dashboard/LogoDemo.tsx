import { useState } from "react";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { Button } from "@/components/ui/button";

type Emotion = "happy" | "sad" | "mad" | "excited" | "neutral";

export default function LogoDemo() {
  const [emotion, setEmotion] = useState<Emotion>("happy");

  return (
    <section className="container mx-auto py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-center">Animated Logo Demo</h1>
        
        <div className="flex justify-center mb-6 md:mb-4 md:mb-6">
          <AnimatedLogo emotion={emotion} autoAnimate={true} size={120} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 md:mb-6">
          <Button
            variant={emotion === "happy" ? "default" : "outline"}
            onClick={() => setEmotion("happy")}
          >
            😊 Happy
          </Button>
          <Button
            variant={emotion === "excited" ? "default" : "outline"}
            onClick={() => setEmotion("excited")}
          >
            🤩 Excited
          </Button>
          <Button
            variant={emotion === "sad" ? "default" : "outline"}
            onClick={() => setEmotion("sad")}
          >
            😢 Sad
          </Button>
          <Button
            variant={emotion === "mad" ? "default" : "outline"}
            onClick={() => setEmotion("mad")}
          >
            😠 Mad
          </Button>
          <Button
            variant={emotion === "neutral" ? "default" : "outline"}
            onClick={() => setEmotion("neutral")}
          >
            😐 Neutral
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-bold mb-4">Features:</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Auto-blinking animation every 3-5 seconds</li>
            <li>5 different emotions: Happy, Excited, Sad, Mad, Neutral</li>
            <li>Smooth transitions between states</li>
            <li>Hover effect with scale animation</li>
            <li>Color changes based on emotion</li>
            <li>Customizable size</li>
          </ul>
        </div>

        <div className="mt-4 md:mt-6 rounded-lg border bg-card p-6">
          <h3 className="font-bold mb-4">Different Sizes:</h3>
          <div className="flex items-center gap-3 md:gap-4 flex-wrap">
            <div className="text-center">
              <AnimatedLogo emotion={emotion} size={24} />
              <p className="text-xs mt-2">24px</p>
            </div>
            <div className="text-center">
              <AnimatedLogo emotion={emotion} size={32} />
              <p className="text-xs mt-2">32px</p>
            </div>
            <div className="text-center">
              <AnimatedLogo emotion={emotion} size={48} />
              <p className="text-xs mt-2">48px</p>
            </div>
            <div className="text-center">
              <AnimatedLogo emotion={emotion} size={64} />
              <p className="text-xs mt-2">64px</p>
            </div>
            <div className="text-center">
              <AnimatedLogo emotion={emotion} size={96} />
              <p className="text-xs mt-2">96px</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
