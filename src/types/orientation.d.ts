export type RCGAxis = "x" | "y";

export interface RCGCoordinate {
  x: number;
  y: number;
}

export type RCGDirection = "north" | "east" | "south" | "west";

export interface RCGOrientation extends RCGCoordinate {
  direction: RCGDirection;
}

export type RCGRelativeDirection = "front" | "back" | "left" | "right";
