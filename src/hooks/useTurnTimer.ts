import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../state/store';
import type { TPlayerColour } from '../types';
import { endGameByTimeout } from '../state/slices/playersSlice';

const HIDDEN_GRACE = 10;
const TURN_DURATION = 180;
const WARNING_THRESHOLD = 120;

export const useTurnTimer = (colour: TPlayerColour) => {
  const dispatch = useDispatch<AppDispatch>();
  const { currentPlayerColour, isGameEnded, players, isAnyTokenMoving } = useSelector(
    (state: RootState) => state.players
  );
  const isPlaceholderShowing = useSelector(
    (state: RootState) =>
      state.dice.dice.find((d) => d.colour === colour)?.isPlaceholderShowing ?? false
  );

  const [hiddenGrace, setHiddenGrace] = useState(HIDDEN_GRACE);
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);

  const player = players.find((p) => p.colour === colour);
  const isHuman = player ? !player.isBot : false;
  const isCurrentPlayer = currentPlayerColour === colour;
  const isActive = isCurrentPlayer && isHuman && !isGameEnded;
  const isVisible = isActive && hiddenGrace <= 0;

  useEffect(() => {
    if (isActive) {
      setHiddenGrace(HIDDEN_GRACE);
      setTimeLeft(TURN_DURATION);
    }
  }, [isActive, currentPlayerColour]);

  useEffect(() => {
    if (!isActive) return;
    if (isPlaceholderShowing || isAnyTokenMoving) {
      setHiddenGrace(HIDDEN_GRACE);
      setTimeLeft(TURN_DURATION);
    }
  }, [isPlaceholderShowing, isAnyTokenMoving, isActive]);

  useEffect(() => {
    if (!isActive || hiddenGrace <= 0) return;
    const id = setTimeout(() => setHiddenGrace((g) => g - 1), 1000);
    return () => clearTimeout(id);
  }, [hiddenGrace, isActive]);

  useEffect(() => {
    if (!isVisible) return;
    if (timeLeft <= 0) {
      dispatch(endGameByTimeout(colour));
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, isVisible, dispatch, colour]);

  return {
    timeLeft,
    isActive: isVisible,
    showWarning: isVisible && timeLeft <= WARNING_THRESHOLD,
  };
};