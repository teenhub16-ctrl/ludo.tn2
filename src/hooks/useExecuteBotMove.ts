import { useCallback } from 'react';
import type { TPlayerColour } from '../types';
import { selectBestTokenForBot } from '../game/bot/selectBestTokenForBot';
import { saveState } from '../game/storage/saveState';
import { type RootState } from '../state/store';
import { useStore } from 'react-redux';
import { useMoveAndCaptureToken } from './useMoveAndCaptureToken';
import { useRollDice } from './useRollDice';
import { useUnlockAndAlignTokens } from './useUnlockAndAlignTokens';
import { useChangeTurn } from './useChangeTurn';
import { sleep } from '../utils/sleep';
import { logError } from '../utils/logError';
import { playSound } from '../utils/sounds';
import { getDistanceBetweenTokens } from '../game/coords/logic';

export const useExecuteBotMove = () => {
  const store = useStore<RootState>();
  const moveAndCapture = useMoveAndCaptureToken();
  const unlockAndAlignTokens = useUnlockAndAlignTokens();
  const rollDice = useRollDice();
  const changeTurnFn = useChangeTurn();

  return useCallback(
    async function executeBotMove(colour: TPlayerColour, diceNumber: number) {
      try {
        if (diceNumber === -1) return changeTurnFn();
        const allPlayers = store.getState().players.players;
        const allTokens = allPlayers.flatMap((p) => p.tokens);

        const otherBotColours = allPlayers
          .filter((p) => p.isBot && p.colour !== colour)
          .map((p) => p.colour);

        const enemyColours = allPlayers.filter((p) => !p.isBot).map((p) => p.colour);
        const enemyTokens = allTokens.filter(
          (t) => enemyColours.includes(t.colour) && !t.hasTokenReachedHome
        );

        // لكل طائر عدو، حدد إن كان بوت آخر أقرب إليه منا
        const othersTargeted = new Set<string>();
        for (const enemyToken of enemyTokens) {
          const key = `${enemyToken.colour}-${enemyToken.id}`;
          let myMinDist = Infinity;
          for (const myT of allTokens) {
            if (myT.colour !== colour) continue;
            const d = getDistanceBetweenTokens(myT, enemyToken);
            if (d < myMinDist) myMinDist = d;
          }
          for (const botColour of otherBotColours) {
            let botMinDist = Infinity;
            for (const bt of allTokens) {
              if (bt.colour !== botColour) continue;
              const d = getDistanceBetweenTokens(bt, enemyToken);
              if (d < botMinDist) botMinDist = d;
            }
            if (botMinDist < myMinDist) {
              othersTargeted.add(key);
              break;
            }
          }
        }

        const bestToken = selectBestTokenForBot(
          colour,
          diceNumber,
          allTokens,
          otherBotColours,
          othersTargeted
        );
        if (!bestToken) return changeTurnFn();

        if (bestToken.isLocked && !bestToken.hasTokenReachedHome && diceNumber === 6) {
          playSound('tokenExit');
          unlockAndAlignTokens({ colour, id: bestToken.id });
          saveState(store.getState());
          await sleep(300);
          return executeBotMove(colour, await rollDice(colour));
        }
        const moveData = await moveAndCapture(bestToken, diceNumber);
        if (!moveData) return changeTurnFn();
        const { hasTokenReachedHome, isCaptured, hasPlayerWon } = moveData;
        if (hasPlayerWon) {
          return changeTurnFn();
        }
        if (!isCaptured && !hasTokenReachedHome && diceNumber !== 6) {
          await sleep(300);
          return changeTurnFn();
        } else {
          await sleep(300);
          return executeBotMove(colour, await rollDice(colour));
        }
      } catch (e) {
        logError('useExecuteBotMove')(e);
        changeTurnFn();
      }
    },
    [changeTurnFn, moveAndCapture, unlockAndAlignTokens, store, rollDice]
  );
};