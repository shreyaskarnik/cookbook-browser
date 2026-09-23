import { choice } from "open-jev";
import { minimumConfidenceRule } from "./routing";
import type { CookbookDefinition } from "./types";

const consistencyChoice: CookbookDefinition = {
  id: "consistency-choice",
  questions: {
    category: choice("What is the single most applicable content-policy category for this post?",
      ["None", "Harass", "Hate", "Violence", "Spam", "Sexual"]),
    primaryRisk: choice("What is the primary moderation risk that should drive triage for this post?",
      ["Harassment", "Violence", "LinkAbuse", "AccountHistory", "LowRisk"]),
    target: choice("Who or what is the content primarily directed at?",
      ["None", "Person", "Group", "Platform"]),
    action: choice("What enforcement action should be taken on this post?",
      ["Allow", "Warn", "Remove", "Strike", "Escalate"]),
    queue: choice("Which single moderation queue should own this post?",
      ["Auto", "General", "Threat", "Spam", "TSLead"]),
    linkHandling: choice("How should any external link or off-platform invite in the post be handled?",
      ["Allow", "RmLink", "Brigade", "Escalate"]),
    reviewPath: choice("Who should make the final call on this post?",
      ["Auto", "Human", "Senior", "Legal"]),
    severity: choice("What is the overall severity of this post?",
      ["None", "Low", "Medium", "High"]),
  },
  labels: {
    category: "Category",
    primaryRisk: "Primary risk",
    target: "Directed at",
    action: "Enforcement action",
    queue: "Queue",
    linkHandling: "Link handling",
    reviewPath: "Final call",
    severity: "Severity",
  },
  // The cookbook's own threshold: below 0.60 the top label is "uncertain" and
  // goes to a person rather than to automatic enforcement.
  routing: minimumConfidenceRule(0.6),
  requires: {
    model: "kev-0.6b",
    why: "Measured at 0.6B: a six-option tool choice resolved correctly at 60% confidence, and a 24-option classification at 99%. Choice questions of this size are well within the small model.",
  },
  samples: [
    {
      id: "borderline-post",
      label: "Borderline post",
      meta: "the cookbook's own scenario",
      text: `Post by u/4471, reported 4 times, 1 prior strike on the account.

"honestly if you keep posting this garbage don't be surprised when someone turns
up at your door. everyone can see where you work, it's not exactly a secret.
anyway we're all moving to discord, link below, come say what you really think
where the mods can't see it 👀"

Attached: discord.gg invite. Account age 3 weeks. Previous strike was for
targeted harassment of a different user.`,
    },
    {
      id: "clearly-fine",
      label: "Clearly fine",
      meta: "nothing to action",
      text: `Post by u/8812, no reports, no strikes, account age 4 years.

"Finally got the sourdough starter working after three failed attempts. The
trick was leaving it somewhere genuinely warm — the top of the fridge, not the
counter. Recipe in the comments if anyone wants it."

No links. No prior moderation history.`,
    },
    {
      id: "ambiguous",
      label: "Ambiguous",
      meta: "where the floor earns its keep",
      text: `Post by u/2290, reported twice, no prior strikes, account age 11 months.

"that take is genuinely one of the worst I've read all year and I say that as
someone who reads a lot of bad takes. how do you function. honestly how do you
get through a day."

No links. Both reports came from accounts that have reported this user before.`,
    },
  ],
  code: `import { OpenJev, choice } from "open-jev";

const jev = await OpenJev.load({ model: "kev-0.6b" });

// Eight questions, one request: the post is read once.
const answers = await jev.decide(post, {
  category: choice("What is the single most applicable content-policy category for this post?",
    ["None", "Harass", "Hate", "Violence", "Spam", "Sexual"]),
  action: choice("What enforcement action should be taken on this post?",
    ["Allow", "Warn", "Remove", "Strike", "Escalate"]),
  // ... six more
});

const FLOOR = 0.6;

// Below the floor the label is not trusted enough to enforce on.
for (const [key, answer] of Object.entries(answers)) {
  if (answer.confidence < FLOOR) sendToHuman(key, answer);
  else enforce(key, answer.choice);
}`,
};

export default consistencyChoice;
