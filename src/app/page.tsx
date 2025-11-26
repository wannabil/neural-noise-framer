import NeuralNoise from "@/components/NeuralNoise";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-background text-foreground">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <NeuralNoise
          backgroundColor="#050505"
          primaryColor="#007BFF"
          secondaryColor="#FFFFFF"
          intensity={0.5}
          pointerStrength={0.4}
          animationSpeed={0.4}
        />
      </div>

      {/* Content Layer */}
      <main className="relative z-10 flex flex-col items-center justify-center w-full h-full px-4 pointer-events-none">
        <div className="max-w-5xl w-full flex flex-col items-center text-center space-y-12">
          
          {/* Name */}
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter uppercase mix-blend-difference animate-reveal">
            Miracle
            <br />
            Mikhael
          </h1>

          {/* CTA */}
          <div className="animate-reveal delay-200 pointer-events-auto">
            <Link 
              href="https://miraclemikhael.com" 
              target="_blank" 
              className="btn-cyber inline-block"
            >
              Enter Site
            </Link>
          </div>
          
        </div>
      </main>
      
      {/* Optional noise overlay texture for extra grit */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03] z-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
    </div>
  );
}
