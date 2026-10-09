import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS,
  canStartLevel,
  completeLevel,
  defaultCampaignProgress,
  isLevelUnlocked,
  normalizeCampaignProgress,
  qualifiesLevel,
} from "./levels";

test("a new campaign exposes only level 1", () => {
  const progress = defaultCampaignProgress();
  assert.deepEqual(progress.unlockedLevelIds, [LEVELS[0].id]);
  assert.equal(isLevelUnlocked(progress, LEVELS[1].id), false);
  assert.equal(canStartLevel(progress, LEVELS[1].id), false);
});

test("qualifying level 1 unlocks level 2", () => {
  const next = completeLevel(defaultCampaignProgress(), LEVELS[0], {
    wpm: LEVELS[0].targetWpm,
    accuracy: LEVELS[0].minimumAccuracy,
    dnf: false,
    place: 1,
    score: 1000,
  });
  assert.equal(next.completedLevelIds.includes(LEVELS[0].id), true);
  assert.equal(next.unlockedLevelIds.includes(LEVELS[1].id), true);
});

test("a failed result does not qualify or unlock the next level", () => {
  const progress = defaultCampaignProgress();
  assert.equal(qualifiesLevel(LEVELS[0], { wpm: 1, accuracy: 99, dnf: false }), false);
  assert.deepEqual(completeLevel(progress, LEVELS[0], { wpm: 1, accuracy: 99, dnf: false, place: 4, score: 10 }), progress);
});

test("completed levels can be replayed without duplicate rewards", () => {
  const once = completeLevel(defaultCampaignProgress(), LEVELS[0], {
    wpm: 30,
    accuracy: 95,
    dnf: false,
    place: 1,
    score: 1000,
  });
  const replay = completeLevel(once, LEVELS[0], {
    wpm: 35,
    accuracy: 98,
    dnf: false,
    place: 1,
    score: 1200,
  });
  assert.equal(replay.unlockedLevelIds.filter((id) => id === LEVELS[1].id).length, 1);
  assert.equal(replay.completedLevelIds.filter((id) => id === LEVELS[0].id).length, 1);
});

test("malformed progress is normalized safely", () => {
  const progress = normalizeCampaignProgress({
    unlockedLevelIds: ["missing-level", LEVELS[4].id],
    completedLevelIds: [LEVELS[2].id, "bad"],
    bestResults: null,
    rewardsClaimed: ["bad"],
  });
  assert.equal(progress.unlockedLevelIds.includes(LEVELS[0].id), true);
  assert.equal(progress.unlockedLevelIds.includes(LEVELS[3].id), true);
  assert.deepEqual(progress.rewardsClaimed, []);
});
