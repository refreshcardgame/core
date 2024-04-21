import type { RCGCoordinate } from "./types/orientation.js";
import type { RCGDirection } from "./types/orientation.js";

interface RCGExtremes {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
}

interface RCGGridData {
  boundaries: RCGCoordinate[][];
  boundariesExtremes: RCGExtremes[];
}

function getExtremes(coordinates: RCGCoordinate[]): RCGExtremes {
  const firstCoordinate = coordinates[0];
  if (!firstCoordinate)
    return { minimumX: 0, maximumX: 0, minimumY: 0, maximumY: 0 };
  let minimumX = firstCoordinate.x;
  let maximumX = minimumX;
  let minimumY = firstCoordinate.y;
  let maximumY = minimumY;

  coordinates.slice(1).forEach((position) => {
    const x = position.x;
    if (x < minimumX) minimumX = x;
    if (x > maximumX) maximumX = x;
    const y = position.y;
    if (y < minimumY) minimumY = y;
    if (y > maximumY) maximumY = y;
  });

  return { minimumX, maximumX, minimumY, maximumY };
}

export class RCGGrid implements RCGGridData {
  boundaries: RCGCoordinate[][];
  boundariesExtremes: RCGExtremes[];

  constructor(...boundaries: RCGCoordinate[][]) {
    this.boundaries = boundaries;
    this.boundariesExtremes = boundaries.map(getExtremes);
  }

  getInitialCoordinate(
    playerOrder: number,
    totalPlayers: number,
  ): RCGCoordinate {
    const mainBoundary = this.getMainBoundary();
    if (!mainBoundary) return { x: 0, y: 0 };
    if (totalPlayers === 1) return mainBoundary[0] ?? { x: 0, y: 0 };
    let totalLength = 0;

    for (let index = 0; index < mainBoundary.length; index++) {
      const nextIndex = (index + 1) % mainBoundary.length;
      const nextCoordinate = mainBoundary[nextIndex] ?? { x: 0, y: 0 };
      const currentCoordinate = mainBoundary[index] ?? { x: 0, y: 0 };
      totalLength +=
        Math.abs(nextCoordinate.x - currentCoordinate.x) +
        Math.abs(nextCoordinate.y - currentCoordinate.y);
    }

    const step = totalLength / totalPlayers;
    let currentLength = 0;
    let currentStep = 0;
    let currentPlayerOrder = 0;
    let index = 0;

    for (;;) {
      const nextIndex = (index + 1) % mainBoundary.length;
      const nextCoordinate = mainBoundary[nextIndex] ?? { x: 0, y: 0 };
      const nextX = nextCoordinate.x;
      const currentCoordinate = mainBoundary[index] ?? { x: 0, y: 0 };
      const currentX = currentCoordinate.x;
      const nextY = nextCoordinate.y;
      const currentY = currentCoordinate.y;
      const segmentLength =
        Math.abs(nextX - currentX) + Math.abs(nextY - currentY);

      if (currentLength + segmentLength < currentStep) {
        currentLength += segmentLength;
        index++;
      } else if (currentPlayerOrder < playerOrder) {
        currentPlayerOrder++;
        currentStep += step;
      } else {
        const t = (currentStep - currentLength) / segmentLength;
        return {
          x: Math.round(currentX + t * (nextX - currentX)),
          y: Math.round(currentY + t * (nextY - currentY)),
        };
      }
    }
  }

  getInitialDirection(coordinate: RCGCoordinate): RCGDirection {
    const mainBoundary = this.getMainBoundary();
    if (!mainBoundary) return "north";
    const mainBoundaryExtremes = this.getMainBoundaryExtremes();
    if (!mainBoundaryExtremes) return "north";
    const [
      firstCoordinate = { x: 0, y: 0 },
      secondCoordinate = { x: 0, y: 0 },
    ] = mainBoundary;
    const xDifference = secondCoordinate.x - firstCoordinate.x;
    if (xDifference > 0)
      return coordinate.y >
        (mainBoundaryExtremes.minimumY + mainBoundaryExtremes.maximumY) / 2
        ? "south"
        : "north";
    else if (xDifference < 0)
      return coordinate.y <
        (mainBoundaryExtremes.minimumY + mainBoundaryExtremes.maximumY) / 2
        ? "north"
        : "south";
    const yDifference = secondCoordinate.y - firstCoordinate.y;
    if (yDifference > 0)
      return coordinate.x <
        (mainBoundaryExtremes.minimumX + mainBoundaryExtremes.maximumX) / 2
        ? "west"
        : "east";
    else if (yDifference < 0)
      return coordinate.x >
        (mainBoundaryExtremes.minimumX + mainBoundaryExtremes.maximumX) / 2
        ? "east"
        : "west";
    return "north";
  }

  getMainBoundary(): RCGCoordinate[] | undefined {
    return this.boundaries[0];
  }

  getMainBoundaryExtremes(): RCGExtremes | undefined {
    return this.boundariesExtremes[0];
  }

  isInside({ x, y }: RCGCoordinate, boundaryIndex = 0): boolean {
    const boundary = this.boundaries[boundaryIndex];
    if (!boundary) return false;
    let crossings = 0;

    for (
      let firstIndex = 0, secondIndex = boundary.length - 1;
      firstIndex < boundary.length;
      secondIndex = firstIndex++
    ) {
      const { x: firstX, y: firstY } = boundary[firstIndex] ?? { x: 0, y: 0 };
      const { x: secondX, y: secondY } = boundary[secondIndex] ?? {
        x: 0,
        y: 0,
      };

      // Horizontal edge
      if (firstY === secondY) {
        // If point is on the edge
        if (
          y === firstY &&
          x >= Math.min(firstX, secondX) &&
          x <= Math.max(firstX, secondX)
        )
          return true;
        continue;
      }

      // Vertical edge
      if (firstX === secondX) {
        // If point is on the edge
        if (
          x === firstX &&
          y >= Math.min(firstY, secondY) &&
          y <= Math.max(firstY, secondY)
        )
          return true;
        // Check if the vertical edge crosses the scanline at y
        if (x < firstX && firstY > y !== secondY > y) crossings++;
      }
    }

    return crossings % 2 === 1;
  }

  toJSON(): RCGGridData {
    const { boundaries, boundariesExtremes } = this;
    return { boundaries, boundariesExtremes };
  }
}
