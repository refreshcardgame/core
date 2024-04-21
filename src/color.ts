export type RCGColor =
  | "red"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "magenta"
  | "white"
  | "black";

export function getColorDegree(color: RCGColor): number {
  switch (color) {
    case "red":
      return 0;

    case "yellow":
      return 60;

    case "green":
      return 120;

    case "cyan":
      return 180;

    case "blue":
      return 240;

    case "magenta":
      return 300;

    case "white":
      return 361;

    case "black":
      return 362;
  }
}
