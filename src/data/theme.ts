import type { TailwindColor } from "@/utils/types/tailwind";

type Theme = {
  colors: {
    primary: TailwindColor;
    background: TailwindColor;
    blur: {
      top: TailwindColor;
      bottom: TailwindColor;
    };
  };
};

const theme: Theme = {
  colors: {
    primary: "cyan",
    background: "neutral",
    blur: {
      top: "cyan",
      bottom: "blue",
    },
  },
};

export default theme;
