import type { Difficulty } from "./types";

// Short openers: the first sentence of every race is one of these so the
// player is moving within the first two seconds of typing.
export const OPENERS = [
  "Start your engines.",
  "Green light, go!",
  "Ready, set, go!",
  "Lights out "+"\u2014"+" go!",
  "Hit the gas now.",
  "Fast fingers win races.",
  "Keep your eyes ahead.",
  "The road is yours.",
  "Shift into high gear.",
  "Type like you mean it.",
  "Speed is a habit.",
  "Chase the horizon.",
  "Full throttle ahead.",
  "Never lift off.",
];

export const EASY = [
  "The sun sets behind the hills.",
  "A cup of coffee can fix most mornings.",
  "Birds fly south when winter comes.",
  "My dog loves to chase the ball.",
  "The library closes at nine tonight.",
  "Rain makes the garden grow faster.",
  "She painted the door bright red.",
  "We walked along the quiet beach.",
  "Fresh bread smells like home.",
  "The train leaves in ten minutes.",
  "Honey never spoils if sealed well.",
  "Cats sleep for most of the day.",
  "The moon pulls the ocean tides.",
  "He fixed the bike with one tool.",
  "Music can change your whole mood.",
  "Snow covered the town overnight.",
  "A good map makes any trip easier.",
  "The kids built a fort from boxes.",
  "Apples float because they are mostly air.",
  "Keep calm and keep typing.",
  "The river bends toward the old mill.",
  "Open windows let the breeze in.",
  "Every expert was once a beginner.",
  "The stars look brighter in the desert.",
  "Lemons turn sweet with enough sugar.",
  "We planted tomatoes in early spring.",
  "A tidy desk helps a busy mind.",
  "The bridge was built in a single year.",
  "Warm socks make cold nights better.",
  "Turn left at the second light, then go straight.",
  "Wait "+"\u2014"+" is that my bus?",
  "Pack a snack, some water, and a map.",
  "Don't forget to lock the door!",
  "The sign read: 'Closed for repairs.'",
  "Did the mail arrive yet?",
  "She asked, \"Are we there yet?\"",
  "Practice turns effort into skill.",
  "The engine roared to life at dawn.",
  "Tight corners reward steady hands.",
  "The pit crew changed four tires in two seconds.",
  "Wind pushed the kite high above the park.",
  "Bees dance to share directions to flowers.",
  "Grandma keeps her recipes in a blue tin.",
  "Clouds drifted slowly over the valley.",
  "The bakery sells out of bagels by noon.",
  "A single spark can light a campfire.",
];

export const MEDIUM = [
  "The fastest way to learn is to make mistakes and fix them quickly.",
  "Octopuses have three hearts and blue blood that carries oxygen.",
  "A journey of a thousand miles begins with a single step forward.",
  "The old lighthouse still guides fishing boats home every night.",
  "Nothing beats the smell of rain on hot pavement in July.",
  "Our neighbors host a chili cook off on the first day of fall.",
  "The museum added a new wing dedicated to space exploration.",
  "Bamboo can grow almost a meter in a single day under ideal conditions.",
  "She tuned the guitar by ear before the concert began.",
  "The highway stretched for miles without a single turn.",
  "A checkered flag means the race is over and the winner is decided.",
  "Headlights carved bright tunnels through the midnight fog.",
  "The mechanic swore the turbo would add fifty horsepower.",
  "Mountain roads demand patience, focus, and a steady pair of hands.",
  "Downshift before the corner and accelerate out of the apex.",
  "The crowd rose to its feet as the cars thundered past the stands.",
  "Volcanoes form when molten rock pushes up through the crust.",
  "The chef insists that fresh herbs make all the difference.",
  "Sea turtles return to the same beach where they were born.",
  "A rainbow appears when sunlight bends through falling raindrops.",
  "The city council approved a new park beside the river.",
  "Astronauts see sixteen sunrises every single day in orbit.",
  "A gentle breeze carried the scent of pine through the cabin.",
  "The marathon route winds through five historic neighborhoods.",
  "Good tires grip the road long after cheap ones give up.",
  "The sound of distant thunder rolled across the open plains.",
  "Every great story starts with a character who wants something.",
  "The orchestra rehearsed the final movement until midnight.",
  "Sharks have roamed the oceans for over four hundred million years.",
  "Her garden bursts with sunflowers taller than the fence.",
  "The desert cools quickly once the sun drops below the dunes.",
  "A well timed pit stop can decide an entire championship.",
  "The night market glows with lanterns and sizzling street food.",
  "Learning to type faster frees your mind to focus on ideas.",
  "The hikers reached the summit just as the clouds parted.",
  "Rubber burned as the sports car launched off the starting line.",
  "The small cafe on the corner roasts its own coffee beans.",
  "Tonight the aurora painted the northern sky in green and violet.",
  "Our road trip playlist has enough songs for three days of driving.",
  "The engineer redesigned the spoiler to add downforce in fast corners.",
  "Patience and precision beat raw speed in the final lap.",
  "A lighthouse keeper once lived alone on that rocky island.",
  "The gears clicked smoothly as the cyclist climbed the hill.",
  "Spring floods turned the quiet creek into a rushing torrent.",
  "Dolphins communicate with whistles that are unique to each individual.",
  "The subway map looks confusing until you ride it a few times.",
  "Hot air balloons rise because warm air is lighter than cool air.",
  "The final straight was long enough to overtake two cars at once.",
  "Jupiter is so large that every other planet could fit inside it.",
  "A steady rhythm matters more than bursts of frantic speed.",
  "The recipe calls for flour, sugar, butter, and eggs; mix them well.",
  "Her journal entry began: 'Today I finally understood the assignment.'",
  "Why do we park in a driveway?",
  "He whispered, \"We made it\" before the lights went out.",
  "She asked, \"Are we there yet?\"; the kids all laughed.",
  "Plan the route, check the weather (twice), and leave early.",
  "The mechanic said, \"It's a small leak; nothing serious.\"",
  "A well-tuned engine revs smoothly (you can hear it) and never stalls.",
];

export const HARD = [
  "The quick brown fox jumps over the lazy dog, then naps in the afternoon sun.",
  "If you want to go fast, go alone; if you want to go far, go together.",
  "Racing drivers brake later than seems sensible, trusting the tires to hold.",
  "The Great Wall of China was built over many centuries by several dynasties.",
  "Honeybees communicate the location of flowers through a complex waggle dance.",
  "Under the stadium lights, the final lap felt longer than the entire race before it.",
  "Carbon fiber is prized by engineers because it is both incredibly strong and light.",
  "The storm knocked out power for hours, so we played cards by candlelight.",
  "Precision typing is a skill built from thousands of small, deliberate repetitions.",
  "The Sahara was once a green savanna dotted with lakes, rivers, and grazing animals.",
  "She crossed the finish line with a broken wing mirror and a grin a mile wide.",
  "A quiet mind, a steady pulse, and quick reflexes will carry you through the chicane.",
  "Light from the sun takes about eight minutes to reach the surface of the Earth.",
  "Before the invention of the printing press, every book was copied by hand.",
  "The championship came down to the last corner of the last lap of the season.",
  "Great drivers feel the limit of grip through their fingertips and the seat of their pants.",
  "Coral reefs support a quarter of all marine species despite covering a tiny fraction of the ocean.",
  "The old mechanic could diagnose an engine problem just by listening to it idle.",
  "Write the sentence once with care, and your fingers will remember it the second time.",
  "Thunder is the sound of air expanding rapidly after being heated by a lightning bolt.",
  "The twisting coastal road offered a stunning view at the end of every hairpin turn.",
  "Mistakes are proof that you are trying, but corrections are proof that you are learning.",
  "Night racing demands total trust in your headlights and your memory of the track.",
  "The smell of burning rubber and high octane fuel hung heavy over the starting grid.",
  "Every second you save in a corner is worth more than horsepower on the straight.",
  "The nervous rookie became a seasoned veteran by the time the season ended.",
  "Deep in the forest, the only sounds were birdsong and the crunch of leaves underfoot.",
  "Modern race cars generate enough downforce to drive upside down on a ceiling.",
  "Clear communication between driver and crew often decides a close race.",
  "The scent of oranges filled the kitchen as she zested fruit for the cake.",
  "Many famous inventions were discovered by accident during unrelated experiments.",
  "A calm start, a strong middle, and a fearless finish make a perfect run.",
  "Waves crashed against the pier as the fishermen secured their boats before the storm.",
  "The telescope revealed thousands of galaxies in a patch of sky the size of a grain of sand.",
  "Good typists do not look at the keys; they trust their hands and read ahead.",
  "He said, \"Racing is 90% preparation (and 10% luck)\"; the crew nodded in agreement.",
  "The team's fearless leader shouted, 'One more lap!' as the crowd erupted.",
  "Her notes began: 'Measure twice; cut once' (her father's motto).",
  "Did the pit crew warn the driver before the tire failed?",
  "The inspector asked, 'Is the paperwork in order?'; the clerk just smiled.",
  "Careful "+"\u2014"+" the second corner is tighter than it looks.",
];

/* ---------- Technical challenges: paths, commands, and code-like text ---------- */

// Intermediate technical text: paths, flags, and light symbols.
export const TECH = [
  "Open the file at /usr/local/bin/racer to inspect the build.",
  "Run: type --fast --level 3 to load the sprint track.",
  "The log lives at /var/log/race.log (check it first).",
  "Press Ctrl+S, then select File > Save As.",
  "Set the port to 8080; the host stays localhost.",
  "Path C:\\games\\racer\\assets holds the track data.",
  "Deploy with: npm run build && npm run deploy.",
  "The config uses key=value pairs; whitespace is ignored.",
  "Send the report to pit-crew@racing.dev before noon.",
  "Check the box labeled [ready] and submit the form.",
  "Syntax: probe [name] with flag --verbose.",
  "Edit git config user.name \"Track Rat\" in the shell.",
  "Mix the separators: src/utils\\index.ts is not the same as src/utils/index.ts.",
  "The backup script copies /home/racer/data into D:\\backup\\racer\\.",
  "Track issue #42 and close it with a fix=clean commit.",
];

// Advanced technical text: code, strings, and dense punctuation.
export const TECH_HARD = [
  "Type: grep -r \"nitro\" src/game/*.ts to find every match.",
  "The regex ^\\d{3}-\\d{4}$ matches a phone number like 555-0199.",
  "Set PATH=C:\\bin;%PATH% and reload the terminal.",
  "Write: const ratio = (done / total).toFixed(2); for the report.",
  "Parse args: node race.js --track=alpine --laps=3.",
  "Parse the URL: https://api.racing.dev/v1/cars?limit=10.",
  "Commit with: git commit -m 'fix: punctuation in target text'.",
  "Decode the header: {\"alg\":\"HS256\",\"typ\":\"JWT\"}.",
  "Query the table: SELECT * FROM laps WHERE time < 60.5;",
  "Resolve ./src/utils/helpers.ts?raw for the raw import.",
  "Run (or troll) check: if (wpm >= 60) { rank = \"pro\"; }.",
  "Filter the list [1, 2, 3].map(n => n * 2).filter(Boolean).",
  "Back up to D:\\archive\\race_2026\\ before the update.",
  "The template string `lap ${n}/${total} done` prints the progress.",
];

const OPENERS_PUNCT = OPENERS;
export const EASY_PUNCT = EASY;
export const MEDIUM_PUNCT = MEDIUM;
export const HARD_PUNCT = HARD;

const TIER_WEIGHTS: Record<Difficulty, [number, number, number]> = {
  rookie: [0.6, 0.35, 0.05],
  pro: [0.3, 0.5, 0.2],
  legend: [0.12, 0.43, 0.45],
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Builds a race-length queue of sentences: an easy opener, then a weighted random mix. */
export function pickRandom<T>(arr: readonly T[], rnd: () => number = Math.random): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

/** Technical pools keyed by difficulty tier (0 = intermediate, 2 = advanced). */
const TECH_TIER: readonly (readonly string[])[] = [[], TECH, TECH_HARD];

export function buildSentenceQueue(difficulty: Difficulty, count: number, seed = Date.now()): string[] {
  const rnd = mulberry32(seed);
  const pools: string[][] = [shuffle([...OPENERS_PUNCT, ...EASY_PUNCT], rnd), shuffle(MEDIUM_PUNCT, rnd), shuffle(HARD_PUNCT, rnd)];
  const techPools: string[][] = [shuffle(TECH_TIER[1], rnd), shuffle(TECH_TIER[2], rnd)];
  const cursors = [0, 0, 0];
  const techCursors = [0, 0];
  const weights = TIER_WEIGHTS[difficulty];
  const out: string[] = [pickRandom(OPENERS, rnd)];

  // Ramp: second sentence is always easy, so the player builds momentum before harder lines.
  const pickTier = (i: number) => {
    if (i < 1) return 0;
    const r = rnd();
    if (r < weights[0]) return 0;
    if (r < weights[0] + weights[1]) return 1;
    return 2;
  };

  for (let i = 0; i < count; i++) {
    const tier = pickTier(i);
    // Insert a technical typing challenge roughly every sixth line so paths,
    // commands and code-like text appear at every difficulty without displacing
    // the normal-sentence progression.
    const wantTech = tier > 0 && i > 1 && i % 6 === 5;
    if (wantTech) {
      const tp = techPools[tier - 1];
      const t = tp[techCursors[tier - 1] % tp.length];
      techCursors[tier - 1]++;
      out.push(t);
      continue;
    }
    const pool = pools[tier];
    const s = pool[cursors[tier] % pool.length];
    cursors[tier]++;
    out.push(s);
  }
  return out;
}

/**
 * Builds a deterministic, punctuation-heavy queue for tests and tooling: it
 * covers every required symbol class (basic punctuation, questions/emphasis,
 * quotes/apostrophes, slashes, brackets, hyphens/underscores and @/#/=).
 */
export function buildPunctuationSample(seed = 1): string[] {
  const rnd = mulberry32(seed);
  return [
    ...shuffle(EASY.filter((s) => /[.,]/.test(s)), rnd).slice(0, 3),
    ...shuffle(MEDIUM.filter((s) => /[?!]/.test(s) || /["']/.test(s)), rnd).slice(0, 3),
    ...shuffle(TECH, rnd).slice(0, 3),
    ...shuffle(TECH_HARD, rnd).slice(0, 3),
    ...shuffle(HARD.filter((s) => /[;:()\[\]]/.test(s)), rnd).slice(0, 3),
  ];
}
