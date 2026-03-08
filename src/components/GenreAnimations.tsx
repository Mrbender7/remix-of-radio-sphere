import img60s from "@/assets/genres/60s.png";
import img70s from "@/assets/genres/70s.png";
import img80s from "@/assets/genres/80s.png";
import img90s from "@/assets/genres/90s.png";
import imgAmbient from "@/assets/genres/ambient.png";
import imgBlues from "@/assets/genres/blues.png";
import imgChillout from "@/assets/genres/chillout.png";
import imgClassical from "@/assets/genres/classical.png";
import imgCountry from "@/assets/genres/country.png";
import imgElectronic from "@/assets/genres/electronic.png";
import imgFunk from "@/assets/genres/funk.png";
import imgHiphop from "@/assets/genres/hiphop.png";
import imgJazz from "@/assets/genres/jazz.png";
import imgLatin from "@/assets/genres/latin.png";
import imgMetal from "@/assets/genres/metal.png";
import imgNews from "@/assets/genres/news.png";
import imgPop from "@/assets/genres/pop.png";
import imgRnb from "@/assets/genres/rnb.png";
import imgReggae from "@/assets/genres/reggae.png";
import imgRock from "@/assets/genres/rock.png";
import imgSoul from "@/assets/genres/soul.png";
import imgTechno from "@/assets/genres/techno.png";
import imgTrance from "@/assets/genres/trance.png";
import imgWorld from "@/assets/genres/world.png";

interface GenreAnimationProps {
  genre: string;
}

const GENRE_IMAGES: Record<string, string> = {
  "60s": img60s,
  "70s": img70s,
  "80s": img80s,
  "90s": img90s,
  ambient: imgAmbient,
  blues: imgBlues,
  chillout: imgChillout,
  classical: imgClassical,
  country: imgCountry,
  electronic: imgElectronic,
  funk: imgFunk,
  hiphop: imgHiphop,
  jazz: imgJazz,
  latin: imgLatin,
  metal: imgMetal,
  news: imgNews,
  pop: imgPop,
  "r&b": imgRnb,
  reggae: imgReggae,
  rock: imgRock,
  soul: imgSoul,
  techno: imgTechno,
  trance: imgTrance,
  world: imgWorld,
};

export function GenreAnimation({ genre }: GenreAnimationProps) {
  const src = GENRE_IMAGES[genre.toLowerCase()];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={genre}
      className="absolute right-1 top-1/2 -translate-y-1/2 w-16 h-16 object-contain pointer-events-none drop-shadow-lg"
      loading="lazy"
    />
  );
}
