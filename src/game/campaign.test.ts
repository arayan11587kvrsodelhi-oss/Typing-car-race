import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS,
  CAMPAIGN_WORLDS,
  canStartLevel,
  completeLevel,
  defaultCampaignProgress,
  isLevelUnlocked,
  isWorldUnlocked,
  levelsForWorld,
  normalizeCampaignProgress,
  qualifiesLevel,
} from "./levels";
import { EASY, HARD, MEDIUM, TECH, TECH_HARD, buildSentenceQueue } from "./sentences";
import { applyKey, firstMismatch, isComplete, matchKey, normalizeChar, progressPercent } from "./typing";

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

test("campaign worlds contain exactly their assigned four levels", () => {
  assert.deepEqual(CAMPAIGN_WORLDS.map((world) => levelsForWorld(world).map((level) => level.index)), [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
  ]);
});

/* ------------------------------------------------------------------ */
/* Typing content and punctuation                                      */
/* ------------------------------------------------------------------ */

/** Every symbol class the task requires to appear in real target text. */
const REQUIRED_PUNCTUATION = [".", ",", ":", ";", "?", "!", "'", '"', "/", "\\", "(", ")", "[", "]", "-", "_", "@", "#", "="];

function assertPunctuation(pool: string[], label: string) {
  for (const ch of REQUIRED_PUNCTUATION) {
    assert.ok(pool.some((sentence) => sentence.includes(ch)), `${label} is missing "${ch}"`);
  }
}

test("the content pools together cover every required punctuation character", () => {
  assertPunctuation([...EASY, ...MEDIUM, ...HARD, ...TECH, ...TECH_HARD], "content pools");
});

test("a sentence containing a period and comma is offered and typed as-is", () => {
  const sentence = EASY.find((s) => s.includes(".") && s.includes(","));
  assert.ok(sentence, "expected an easy sentence with both a period and a comma");
  assert.match(sentence!, /[.,]/);
});

test("a challenge contains quotes and a question mark", () => {
  const challenge = [...MEDIUM, ...HARD].find((s) => s.includes('"') && s.includes("?"));
  assert.ok(challenge, "expected a challenge with quotes and a question mark");
});

test("a technical challenge contains forward and backward slashes", () => {
  assert.ok(TECH.some((s) => s.includes("/")), "expected a forward slash in intermediate technical text");
  assert.ok(TECH.some((s) => s.includes("\\")), "expected a backward slash in intermediate technical text");
  assert.ok(
    [...TECH, ...TECH_HARD].some((s) => s.includes("/") && s.includes("\\")),
    "expected a technical line with both slash kinds",
  );
});

/** Type a whole string one character at a time using the shared rules. */
function typeAll(target: string, input: string) {
  let state = { typed: "", correct: 0, errors: 0 };
  let completed = false;
  for (const ch of input) {
    const next = applyKey(state, ch, target);
    state = { typed: next.typed, correct: next.correct, errors: next.errors };
    completed = next.completed;
  }
  return { ...state, completed };
}

test("correct punctuation advances; punctuation is not skipped", () => {
  const target = "Go, now!";
  const result = typeAll(target, "Go, ");
  assert.equal(result.typed, "Go, ");
  assert.equal(firstMismatch(result.typed, target), -1, "typed prefix matches exactly");
  assert.equal(result.errors, 0, "entering the exact characters must not error");
  assert.equal(result.completed, false, "the line must not complete early");
});

test("incorrect punctuation is counted as an error", () => {
  const target = "Go, now!";
  const result = typeAll(target, "Go."); // wrong: target wants a comma
  assert.equal(result.errors, 1);
  assert.equal(result.typed, "Go.", "the wrong character is still recorded");
  assert.notEqual(firstMismatch(result.typed, target), -1);
});

test("a line only completes after the full target string is typed", () => {
  const target = "Go, now!";
  const almost = typeAll(target, "Go, now");
  assert.equal(almost.completed, false, "missing the final ! must not complete the line");
  assert.ok(progressPercent(almost.typed.length, target.length) < 100);

  const full = typeAll(target, "Go, now!");
  assert.equal(full.completed, true, "typing the final ! completes the line");
  assert.equal(progressPercent(full.typed.length, target.length), 100);
});

test("slash and backslash are distinct; letters stay case-insensitive", () => {
  const line = TECH.find((s) => s.includes("/") && s.includes("\\"));
  assert.ok(line, "expected a technical line with both slash kinds");

  // A forward slash must not satisfy a target backslash...
  const wrong = applyKey({ typed: "Path C:", correct: 0, errors: 0 }, "/", `Path C:\\`);
  assert.equal(wrong.errors, 1, "/ must not satisfy a target \\");

  // ...but the correct backslash does.
  const right = applyKey({ typed: "Path C:", correct: 0, errors: 0 }, "\\", `Path C:\\`);
  assert.equal(right.errors, 0, "the correct backslash advances cleanly");
  assert.equal(right.completed, true);

  // Letters remain case-insensitive (the existing game rule).
  assert.equal(matchKey("A"), matchKey("a"));
  assert.equal(matchKey("/"), "/");
  assert.notEqual(matchKey("/"), matchKey("\\"));
});

test("smart-punctuation lookalikes normalize to the ASCII the target expects", () => {
  assert.equal(normalizeChar("\u2019"), "'");
  assert.equal(normalizeChar("\u201c"), '"');
  assert.equal(normalizeChar("\uff0f"), "/");
  assert.equal(normalizeChar("\uff3c"), "\\");
  assert.equal(normalizeChar("\u2013"), "-");
});

test("restarting and changing difficulty keep punctuation intact", () => {
  const rookie = buildSentenceQueue("rookie", 40, 77);
  const legend = buildSentenceQueue("legend", 40, 77);
  const punct = /[.,!?;:'"()\[\]\/_@#=-]/;
  assert.ok(rookie.some((s) => punct.test(s)), "rookie queue should contain punctuation");
  assert.ok(legend.some((s) => punct.test(s)), "legend queue should contain punctuation");

  // Same seed reproduces the same race, so a restart is deterministic.
  const restart = buildSentenceQueue("rookie", 40, 77);
  assert.deepEqual(restart, rookie);
});

test("technical challenges appear in race queues", () => {
  const queue = buildSentenceQueue("legend", 40, 7);
  assert.ok(queue.some((s) => s.includes("/")), "expected a path or command in a legend race");
});

test("isComplete never reports done before every character is entered", () => {
  const target = EASY.find((s) => s.includes(".") && s.includes(","))!;
  assert.equal(isComplete(target.slice(0, -1), target), false);
  assert.equal(isComplete(target, target), true);
  assert.equal(isComplete(target + "!", target), false, "extra mistyped characters break completion");
});

test("worlds unlock from existing completed campaign progress", () => {
  const fresh = defaultCampaignProgress();
  assert.equal(isWorldUnlocked(fresh, CAMPAIGN_WORLDS[0]), true);
  assert.equal(isWorldUnlocked(fresh, CAMPAIGN_WORLDS[1]), false);
  assert.equal(isWorldUnlocked(fresh, CAMPAIGN_WORLDS[2]), false);

  const levelFour = completeLevel(
    completeLevel(
      completeLevel(
        completeLevel(fresh, LEVELS[0], { wpm: 30, accuracy: 95, dnf: false, place: 1, score: 1000 }),
        LEVELS[1], { wpm: 30, accuracy: 95, dnf: false, place: 1, score: 1000 },
      ),
      LEVELS[2], { wpm: 30, accuracy: 95, dnf: false, place: 1, score: 1000 },
    ),
    LEVELS[3], { wpm: 30, accuracy: 95, dnf: false, place: 1, score: 1000 },
  );
  assert.equal(isWorldUnlocked(levelFour, CAMPAIGN_WORLDS[1]), true);
  assert.equal(isWorldUnlocked(levelFour, CAMPAIGN_WORLDS[2]), false);
});
