import { Sparkles, Trophy } from "lucide-react";

export type XpPopupEvent = {
  xp_awarded: number;
  total_xp: number;
  level: number;
  leveled_up: boolean;
};

type XpPopupProps = {
  event: XpPopupEvent;
  visible: boolean;
};

export default function XpPopup({ event, visible }: XpPopupProps) {
  return (
    <div
      className={`xp-popup ${visible ? "xp-popup--visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="xp-popup-burst" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="xp-popup-card">
        <div className="xp-popup-icon">
          {event.leveled_up ? <Trophy size={30} /> : <Sparkles size={30} />}
        </div>
        <div>
          <p className="xp-popup-kicker">
            {event.leveled_up ? `Level ${event.level} reached` : "Points gained"}
          </p>
          <p className="xp-popup-value">+{event.xp_awarded}</p>
          <p className="xp-popup-meta">{event.total_xp} XP total</p>
        </div>
      </div>
    </div>
  );
}
