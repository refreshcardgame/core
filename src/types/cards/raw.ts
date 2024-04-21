import type {
  RCGCardID,
  RCGCardName,
  RCGCardPosition,
  RCGRelativeCardPosition,
} from "../../card.ts";
import type { RCGPlayer, RCGPlayerName } from "../../player.ts";

export interface RCGRawCardData {
  controller?: RCGPlayerName;
  id: RCGCardID;
  name: RCGCardName;
  position?: RCGCardPosition;
  type: "card";
}

export interface RCGRawCard {
  controller?: RCGPlayerName;
  id: RCGCardID;
  name: RCGCardName;
  position?: RCGCardPosition;
  type: "card";

  getController(): RCGPlayer | undefined;

  setPosition(to: RCGRelativeCardPosition): this;
}
