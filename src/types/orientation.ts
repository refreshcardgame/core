export type RCGAxis = "x" | "y";

export type RCGCoordinate = Record<RCGAxis, number>;

export type RCGDirection = "north" | "east" | "south" | "west";

export interface RCGOrientation extends RCGCoordinate {
  direction: RCGDirection;
}

export type RCGRelativeDirection = "front" | "back" | "left" | "right";
