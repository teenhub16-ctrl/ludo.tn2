import type { TCoordinate, TPlayerColour } from '../../types';
import type { TToken } from '../../types';
import {
  isCoordASafeSpot,
  isTokenAhead,
  getDistanceBetweenTokens,
  getDistanceInTokenPath,
  getHomeCoordForColour,
  areCoordsEqual,
  getFinalCoord,
} from '../coords/logic';
import { tokenPaths } from '../tokens/paths';

// ================================================================
// ملف الطائر
// ================================================================
type TokenProfile = {
  token: TToken;
  distToHome: number;
  distTraveled: number;
  isOnStar: boolean;
  weightedThreats: number;
  isRealSafeNow: boolean;
  nearestBehind: number;
  nearestAhead: number;
  huntingBonus: number;
};

// ================================================================
// الأوزان
// ================================================================
const W = {
  REACH_HOME: 100_000_000,
  EAT_HUMAN_BASE: 8_000_000,
  EAT_HUMAN_PER_PROGRESS: 60_000,
  EAT_HUMAN_URGENT: 5_000_000,
  EXIT_AT_SIX: 2_500_000,

  ENTER_STAR: 900_000,
  STAY_ON_STAR: 700_000,
  ESCAPE_DANGER: 1_500_000,
  PROGRESS_PER_TILE: 3_000,
  BACKWARD_BONUS: 150_000,
  EAT_TEAMMATE: 150_000,

  THREAT_AT_1: 3_000_000,
  THREAT_AT_2: 2_200_000,
  THREAT_AT_3: 1_500_000,
  THREAT_AT_4: 900_000,
  THREAT_AT_5: 500_000,
  THREAT_AT_6: 250_000,

  HUNTING_BONUS_AT_1: 250_000,
  HUNTING_BONUS_AT_2: 150_000,
  HUNTING_BONUS_AT_3: 80_000,
  HUNTING_BONUS_AT_6: 30_000,

  LEAVE_STAR_BASE: 10_000_000,
  LEAVE_STAR_PER_PROGRESS: 300_000,
  LEAVE_STAR_TO_DANGER_EXTRA: 15_000_000,
  SAFE_TO_DANGER: 5_000_000,
  STACK_ON_TEAMMATE: 500_000,
  PROGRESS_TAX: 100,
};

// ================================================================
// الدالة الرئيسية
// ================================================================
export function selectBestTokenForBot(
  botPlayerColour: TPlayerColour,
  diceNumber: number,
  allTokens: TToken[],
  teamColours: TPlayerColour[],
  othersTargeted: Set<string>
): TToken | null {
  const enemyColours = new Set(
    [...new Set(allTokens.map((t) => t.colour))].filter((c) => !teamColours.includes(c))
  );
  const enemyTokens = allTokens.filter(
    (t) => enemyColours.has(t.colour) && !t.hasTokenReachedHome
  );
  const myTokens = allTokens.filter(
    (t) => t.colour === botPlayerColour && !t.hasTokenReachedHome
  );
  if (myTokens.length === 0) return null;

  // ============================================================
  // 1. الوصول للنهاية
  // ============================================================
  const homeCoord = getHomeCoordForColour(botPlayerColour);
  for (const token of myTokens) {
    if (token.isLocked) continue;
    const d = getDistanceInTokenPath(token.colour, token.coordinates, homeCoord);
    if (d === diceNumber) return token;
  }

  // ============================================================
  // 2. أكل بشر (أولوية مطلقة)
  // ============================================================
  const humanEater = findHumanEater(myTokens, diceNumber, enemyTokens, othersTargeted);
  if (humanEater) return humanEater;

  // ============================================================
  // 3. التقييم العادي (يشمل الإخراج عند 6، أكل الزميل، البقاء في نجمة...)
  // ============================================================
  const profiles: TokenProfile[] = myTokens.map((t) => buildProfile(t, enemyTokens));

  const evaluations: { token: TToken; score: number }[] = [];
  for (const profile of profiles) {
    const score = scoreMove(profile, profiles, diceNumber, allTokens, enemyTokens, teamColours);
    if (score !== null) evaluations.push({ token: profile.token, score });
  }

  if (evaluations.length === 0) return null;
  evaluations.sort((a, b) => b.score - a.score);
  const best = evaluations[0].score;
  const top = evaluations.filter((e) => e.score === best);
  return top[Math.floor(Math.random() * top.length)].token;
}

// ================================================================
// أكل بشر
// ================================================================
function findHumanEater(
  myTokens: TToken[],
  diceNumber: number,
  enemyTokens: TToken[],
  othersTargeted: Set<string>
): TToken | null {
  let best: { token: TToken; score: number } | null = null;
  for (const token of myTokens) {
    if (token.isLocked) continue;
    const fc = getFinalCoord(token, diceNumber);
    if (!fc) continue;
    for (const enemy of enemyTokens) {
      if (!areCoordsEqual(enemy.coordinates, fc)) continue;
      if (isCoordASafeSpot(enemy.coordinates, enemy.colour)) continue;
      const eDist = getDistanceInTokenPath(
        enemy.colour,
        enemy.coordinates,
        getHomeCoordForColour(enemy.colour)
      );
      let score = W.EAT_HUMAN_BASE + (100 - eDist) * W.EAT_HUMAN_PER_PROGRESS;
      if (eDist <= 10) score += W.EAT_HUMAN_URGENT * (11 - eDist);
      if (othersTargeted.has(`${enemy.colour}-${enemy.id}`)) score *= 0.4;
      if (!best || score > best.score) best = { token, score };
    }
  }
  return best?.token ?? null;
}

// ================================================================
// بناء ملف الطائر
// ================================================================
function buildProfile(token: TToken, enemyTokens: TToken[]): TokenProfile {
  if (token.isLocked) {
    return {
      token,
      distToHome: 999,
      distTraveled: 0,
      isOnStar: false,
      weightedThreats: 0,
      isRealSafeNow: true,
      nearestBehind: 999,
      nearestAhead: 999,
      huntingBonus: 0,
    };
  }
  const homeCoord = getHomeCoordForColour(token.colour);
  const distToHome = getDistanceInTokenPath(token.colour, token.coordinates, homeCoord);
  const distTraveled = tokenPaths[token.colour].length - distToHome;
  const isOnStar = isCoordASafeSpot(token.coordinates, token.colour);
  const enemies = readEnemiesAround(token, enemyTokens);
  return {
    token,
    distToHome,
    distTraveled,
    isOnStar,
    weightedThreats: isOnStar ? 0 : enemies.weightedThreats,
    isRealSafeNow: isOnStar || enemies.weightedThreats === 0,
    nearestBehind: enemies.nearestBehind,
    nearestAhead: enemies.nearestAhead,
    huntingBonus: enemies.huntingBonus,
  };
}

// ================================================================
// قراءة الأعداء حول طائر
// ================================================================
type EnemiesAround = {
  weightedThreats: number;
  nearestBehind: number;
  nearestAhead: number;
  huntingBonus: number;
};

function readEnemiesAround(token: TToken, enemyTokens: TToken[]): EnemiesAround {
  const result: EnemiesAround = {
    weightedThreats: 0,
    nearestBehind: 999,
    nearestAhead: 999,
    huntingBonus: 0,
  };
  for (const enemy of enemyTokens) {
    const dist = getDistanceBetweenTokens(token, enemy);
    if (dist < 1 || dist > 6) continue;
    // isTokenAhead(token, enemy) = true → token متقدم على enemy → enemy خلفي
    if (isTokenAhead(token, enemy)) {
      if (dist < result.nearestBehind) result.nearestBehind = dist;
      result.weightedThreats += threatByDistance(dist);
    } else {
      if (dist < result.nearestAhead) result.nearestAhead = dist;
      result.huntingBonus += huntingBonusByDistance(dist);
    }
  }
  return result;
}

function readEnemiesAroundCoord(coord: TCoordinate, movingToken: TToken, enemyTokens: TToken[]): EnemiesAround {
  const dummy = { ...movingToken, coordinates: coord };
  return readEnemiesAround(dummy, enemyTokens);
}

function threatByDistance(dist: number): number {
  switch (dist) {
    case 1: return W.THREAT_AT_1;
    case 2: return W.THREAT_AT_2;
    case 3: return W.THREAT_AT_3;
    case 4: return W.THREAT_AT_4;
    case 5: return W.THREAT_AT_5;
    case 6: return W.THREAT_AT_6;
    default: return 0;
  }
}

function huntingBonusByDistance(dist: number): number {
  switch (dist) {
    case 1: return W.HUNTING_BONUS_AT_1;
    case 2: return W.HUNTING_BONUS_AT_2;
    case 3: return W.HUNTING_BONUS_AT_3;
    case 4:
    case 5:
    case 6: return W.HUNTING_BONUS_AT_6;
    default: return 0;
  }
}

// ================================================================
// تقييم حركة
// ================================================================
function scoreMove(
  profile: TokenProfile,
  allProfiles: TokenProfile[],
  diceNumber: number,
  allTokens: TToken[],
  enemyTokens: TToken[],
  teamColours: TPlayerColour[]
): number | null {
  const { token, distToHome, distTraveled, isOnStar } = profile;

  // ============================================================
  // طائر مقفل: يخرج فقط بـ 6 (يُقيَّم مع باقي الخيارات)
  // ============================================================
  if (token.isLocked) {
    if (diceNumber !== 6) return null;
    const startCoord = tokenPaths[token.colour][0];
    const startIsStar = isCoordASafeSpot(startCoord, token.colour);
    let score = W.EXIT_AT_SIX;
    if (startIsStar) score += W.ENTER_STAR;
    const enemiesAtStart = readEnemiesAroundCoord(startCoord, token, enemyTokens);
    score -= enemiesAtStart.weightedThreats;
    return score;
  }

  const finalCoord = getFinalCoord(token, diceNumber);
  if (!finalCoord) return null;

  const finalIsStar = isCoordASafeSpot(finalCoord, token.colour);
  const enemiesAtFinal = readEnemiesAroundCoord(finalCoord, token, enemyTokens);

  let score = 0;

  // ============================================================
  // أكل زميل (بوت آخر) — مكافأة صغيرة
  // ============================================================
  const teammateAtDest = allTokens.find(
    (t) =>
      teamColours.includes(t.colour) &&
      t.colour !== token.colour &&
      !t.hasTokenReachedHome &&
      areCoordsEqual(t.coordinates, finalCoord)
  );
  if (teammateAtDest) {
    // هل الزميل على مكان آمن؟ → لا يمكن أكله → مجرد تكديس
    const teammateIsSafe = isCoordASafeSpot(teammateAtDest.coordinates, teammateAtDest.colour);
    if (teammateIsSafe || finalIsStar) {
      // لا أكل ممكن → منع التكديس فقط
      if (!finalIsStar) score -= W.STACK_ON_TEAMMATE;
    } else {
      // أكل زميل → مكافأة صغيرة
      score += W.EAT_TEAMMATE;
    }
  }

  // ============================================================
  // البقاء على نجمة
  // ============================================================
  if (isOnStar && finalIsStar) {
    score += W.STAY_ON_STAR;
    score += distTraveled * W.PROGRESS_PER_TILE;
    return score;
  }

  // ============================================================
  // مغادرة النجمة → عقوبة كبيرة
  // ============================================================
  if (isOnStar && !finalIsStar) {
    const leaveCost = W.LEAVE_STAR_BASE + distTraveled * W.LEAVE_STAR_PER_PROGRESS;
    score -= leaveCost;
    if (enemiesAtFinal.weightedThreats > 0) {
      score -= W.LEAVE_STAR_TO_DANGER_EXTRA;
      score -= enemiesAtFinal.weightedThreats;
    }
    return score;
  }

  // ============================================================
  // الدخول إلى نجمة
  // ============================================================
  if (!isOnStar && finalIsStar) {
    score += W.ENTER_STAR;
    score += distTraveled * W.PROGRESS_PER_TILE;
    return score;
  }

  // ============================================================
  // لا نجمة في الحالتين
  // ============================================================
  const wasSafe = profile.isRealSafeNow;
  const willBeSafe = enemiesAtFinal.weightedThreats === 0;

  if (!wasSafe && willBeSafe) {
    // هروب من خطر → مكافأة كبيرة
    score += W.ESCAPE_DANGER;
    score += profile.weightedThreats;
  } else if (wasSafe && !willBeSafe) {
    // آمن → خطر → عقوبة
    score -= W.SAFE_TO_DANGER;
    score -= enemiesAtFinal.weightedThreats;
  } else if (!wasSafe && !willBeSafe) {
    // خطر → خطر
    score -= enemiesAtFinal.weightedThreats;
    score += profile.weightedThreats * 0.5;
  } else {
    // آمن → آمن
    score += distTraveled * W.PROGRESS_PER_TILE;
  }

  // مكافأة الصيد (أنا خلف عدو)
  score += enemiesAtFinal.huntingBonus;

  // عقوبة وجود عدو خلفي مباشرة
  if (enemiesAtFinal.nearestBehind !== 999) {
    score -= threatByDistance(enemiesAtFinal.nearestBehind);
  }

  // مكافأة الطائر المتخلف إذا كانت حركته آمنة
  if (willBeSafe && isBackwardToken(profile, allProfiles)) {
    score += W.BACKWARD_BONUS;
  }

  // ضريبة تقدم بسيطة (لتشجيع الحركة)
  score -= distToHome * W.PROGRESS_TAX;

  return score;
}

// ================================================================
// هل هذا الطائر الأكثر تخلفًا؟
// ================================================================
function isBackwardToken(profile: TokenProfile, allProfiles: TokenProfile[]): boolean {
  const unlocked = allProfiles.filter((p) => !p.token.isLocked);
  if (unlocked.length === 0) return false;
  const maxDist = Math.max(...unlocked.map((p) => p.distToHome));
  return profile.distToHome === maxDist;
}