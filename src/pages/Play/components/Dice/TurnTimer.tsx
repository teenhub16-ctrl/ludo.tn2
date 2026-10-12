import { useTurnTimer } from '../../../../hooks/useTurnTimer';
import type { TPlayerColour } from '../../../../types';
import styles from './TurnTimer.module.css';

type Props = {
  colour: TPlayerColour;
};

export default function TurnTimer({ colour }: Props) {
  const { timeLeft, isActive, showWarning } = useTurnTimer(colour);
  if (!isActive) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const isUrgent = timeLeft <= 30;

  return (
    <div className={styles.timerWrapper}>
      {showWarning && (
        <span className={styles.warningText}>
          إذا انتهى الوقت دون أن تلعب ستُعتبر منسحبًا
        </span>
      )}
      <div className={`${styles.timerDisplay} ${isUrgent ? styles.urgent : ''}`}>
        <span className={styles.timerText}>{display}</span>
      </div>
    </div>
  );
}