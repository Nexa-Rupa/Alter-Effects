import { Anton, Archivo_Black, Bangers, Bebas_Neue, Montserrat, Instrument_Serif, Newsreader, Noto_Sans_Devanagari, Noto_Sans_Telugu, Permanent_Marker, Playfair_Display, Poppins, Space_Mono, Special_Elite } from "next/font/google";
import { ToolsChrome } from "@/tools/ToolsChrome";

// Caption fonts for the free tools (all SIL OFL). Loaded only on /tools pages.
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "800", "900"], variable: "--font-montserrat", display: "swap" });
// Hindi/Marathi and Telugu glyphs for the translated interface and for captions in those scripts.
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "600", "800"], variable: "--font-deva", display: "swap" });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], weight: ["400", "600", "800"], variable: "--font-telugu", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "700"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
const bangers = Bangers({ subsets: ["latin"], weight: "400", variable: "--font-bangers", display: "swap" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker", display: "swap" });
// Editorial highlight and Retro typer styles (ported from Claude Caption Styles).
const newsreader = Newsreader({ subsets: ["latin"], weight: ["500"], style: ["normal", "italic"], variable: "--font-newsreader", display: "swap" });
const typer = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-typer", display: "swap" });
// Effects fonts (same faces as the effects engine in packages/fx).
const archivo = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-archivo", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const spacemono = Space_Mono({ subsets: ["latin"], weight: "700", variable: "--font-spacemono", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-poppins", display: "swap" });

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${anton.variable} ${bebas.variable} ${montserrat.variable} ${poppins.variable} ${playfair.variable} ${bangers.variable} ${marker.variable} ${newsreader.variable} ${typer.variable} ${archivo.variable} ${instrument.variable} ${spacemono.variable} ${deva.variable} ${telugu.variable} tools-fonts flex min-h-screen flex-col`}>
      <ToolsChrome>{children}</ToolsChrome>
    </div>
  );
}
