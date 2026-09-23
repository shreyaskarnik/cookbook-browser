import { noul } from "open-jev";
import type { CookbookDefinition } from "./types";
import { bandRule } from "./routing";

const consistencyNoul: CookbookDefinition = {
  id: "consistency-noul",
  questions: {
    covered: noul("Is the loss covered under the policy's collision coverage?"),
    exclusionApplies: noul("Does a policy exclusion apply to this loss?"),
    onTrack: noul(
      "Did the collision happen while the vehicle was being driven on the racetrack itself?"
    ),
    deductible: noul(
      "Would the $500 deductible be correctly applied before any payout?"
    ),
    documentation: noul(
      "Is the attached documentation sufficient to adjudicate the claim as-is?"
    ),
    withinLimit: noul("Is the amount claimed within the per-incident coverage limit?"),
    inPeriod: noul("Did the loss occur within the policy's active coverage period?"),
    reportedInWindow: noul(
      "Was the loss reported within the policy's required window?"
    ),
    rentalEligible: noul(
      "Is the rental-car cost eligible for reimbursement under this policy?"
    ),
    fraudIndicators: noul("Are there indicators that warrant a fraud review?"),
    autoApproved: noul(
      "Was payment approved by automated triage without a human adjuster's review?"
    ),
    manualReview: noul(
      "Should this claim be routed for manual/supervisor review before payout?"
    ),
    lineItemsAddUp: noul(
      "Do the claimed line-item costs add up to the total amount claimed?"
    ),
    subrogation: noul(
      "Is there a potentially at-fault third party the insurer could pursue for subrogation recovery?"
    ),
  },
  labels: {
    covered: "Covered",
    exclusionApplies: "Exclusion applies",
    onTrack: "On the track itself",
    deductible: "Deductible applied",
    documentation: "Documentation sufficient",
    withinLimit: "Within limit",
    inPeriod: "In coverage period",
    reportedInWindow: "Reported in time",
    rentalEligible: "Rental eligible",
    fraudIndicators: "Fraud indicators",
    autoApproved: "Auto-approved",
    manualReview: "Needs manual review",
    lineItemsAddUp: "Line items add up",
    subrogation: "Subrogation possible",
  },
  samples: [
    {
      id: "track-day",
      label: "Track-day parking lot",
      meta: "the cookbook's own scenario",
      text: `Claim #AC-88213. Policy P-4471, collision coverage active 2026-01-01 to 2026-12-31, $500 deductible, $25,000 per-incident limit.

Loss date 2026-08-14, reported 2026-08-29. The insured attended a track day at Sonoma Raceway. The collision occurred in the venue's paved parking lot, not on the circuit: a third-party vehicle reversed into the insured's rear bumper while both were leaving. The third party admitted fault at the scene but no police report was filed.

Claimed: bumper and rear quarter panel $4,180; paint $1,240; rental car for 9 days $612; track entry fee $395. Total claimed $6,427.

Notes: the policy excludes "competitive driving, racing, speed trials or track use". Rental reimbursement is available only on the Premium endorsement, which this policy does not carry. Photographs were supplied; no repair estimate from an approved shop is attached. Automated triage marked this claim approved for payment on 2026-08-30 without adjuster review.`,
    },
    {
      id: "clean-rear-end",
      label: "Straightforward rear-end",
      meta: "everything lines up",
      text: `Claim #AC-90114. Policy P-5520, collision coverage active 2026-03-01 to 2027-02-28, $500 deductible, $25,000 per-incident limit.

Loss date 2026-09-02, reported 2026-09-02. The insured was stopped at a red light on Market Street when a delivery van struck the rear of the vehicle. Police report #SF-2026-44118 filed at the scene; the van driver was cited for following too closely and their insurer has acknowledged liability.

Claimed: rear bumper assembly $1,850; trunk lid $940; labour $720; paint $560. Total claimed $4,070.

An approved-shop estimate matching the claimed total is attached, along with the police report and eleven photographs. No rental was taken. Assigned to adjuster R. Okafor, who inspected the vehicle on 2026-09-04.`,
    },
    {
      id: "thin-file",
      label: "Thin file, late report",
      meta: "documentation is missing",
      text: `Claim #AC-87002. Policy P-3318, collision coverage active 2025-11-15 to 2026-11-14, $500 deductible, $10,000 per-incident limit.

Loss date "sometime in June", reported 2026-09-10. The insured states the vehicle was damaged in a parking garage and that they only noticed the damage later. The policy requires loss to be reported within 30 days.

Claimed: "front end damage, approx $9,800". No itemisation, no estimate, no photographs, no incident location beyond "a garage downtown". The insured has filed three claims in the past fourteen months, two of which were withdrawn after an estimate was requested.

No third party identified. No police report. Automated triage flagged the claim and did not approve payment.`,
    },
  ],
  code: `import { OpenJev, noul } from "open-jev";

const jev = await OpenJev.load({ model: "kev-0.6b" });

// All fourteen questions travel in one request: the state is read once.
const answers = await jev.decide(claim, {
  covered: noul("Is the loss covered under the policy's collision coverage?"),
  exclusionApplies: noul("Does a policy exclusion apply to this loss?"),
  fraudIndicators: noul("Are there indicators that warrant a fraud review?"),
  // ... eleven more
});

const LOW = 0.3;
const HIGH = 0.7;

function decide(probability) {
  if (probability < LOW) return "no";
  if (probability > HIGH) return "yes";
  return "uncertain"; // a person looks at this one
}

const verdicts = Object.fromEntries(
  Object.entries(answers).map(([key, answer]) => [key, decide(answer.probability)])
);`,
  routing: bandRule(0.3, 0.7),
  requires: {
    model: "kev-0.6b",
    why: "Measured at 0.6B: the fourteen probabilities span 16% to 90% on the track-day claim, with seven inside the default band.",
  },
  /**
   * The questions a person must be sure about before a payout goes out: whether the
   * loss is covered at all, whether an exclusion kills it, whether it smells like
   * fraud, and whether the file itself asks for a supervisor. Uncertainty anywhere
   * else can be absorbed; uncertainty here cannot.
   *
   * This is a judgment call about claims handling rather than a fact about the model.
   * Change this list (or swap the rule in `claimVerdict` for a count over all
   * fourteen) and the headline changes with it.
   */
  criticalKeys: ["covered", "exclusionApplies", "fraudIndicators", "manualReview"],
};

export default consistencyNoul;
