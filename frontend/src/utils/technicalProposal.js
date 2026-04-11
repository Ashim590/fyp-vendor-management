/**
 * Parse structured technical proposal text (section headers in ALL CAPS, one per line).
 */
export function parseTechnicalProposalSections(text) {
  const raw = String(text || "").trim();
  const keys = [
    ["SCOPE OF WORK", "scopeOfWork"],
    ["DELIVERY TIMELINE", "deliveryTimeline"],
    ["COMPLIANCE", "compliance"],
    ["DIFFERENTIATORS", "differentiators"],
  ];
  const out = {
    scopeOfWork: "",
    deliveryTimeline: "",
    compliance: "",
    differentiators: "",
  };
  if (!raw) return out;
  const lines = raw.split("\n");
  let currentKey = null;
  const bucket = [];
  const flush = () => {
    if (!currentKey) return;
    out[currentKey] = bucket.join("\n").trim();
    bucket.length = 0;
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const found = keys.find(([h]) => h === trimmed);
    if (found) {
      flush();
      currentKey = found[1];
    } else if (currentKey) {
      bucket.push(line);
    }
  }
  flush();
  return out;
}

/** Merge parsed sections into one textarea for editing. */
export function mergeSectionsToProposalText(sections) {
  const parts = [
    sections.scopeOfWork,
    sections.deliveryTimeline,
    sections.compliance,
    sections.differentiators,
  ].filter((x) => String(x || "").trim());
  return parts.join("\n\n—\n\n");
}

/**
 * Stored bid.proposal / technicalProposal: single scope block (no filler sections).
 * Backends still accept the legacy multi-header format when reading old rows.
 */
export function buildTechnicalProposalBlob(userText) {
  const t = String(userText || "").trim();
  if (!t) return "";
  return ["SCOPE OF WORK", t].join("\n");
}

const BOILERPLATE_LINE = /^Covered in (the proposal|scope of work) above\.?$/i;

/**
 * Text shown in tables and previews: real scope/content, without auto-fill boilerplate lines.
 */
export function getTechnicalProposalDisplayText(raw) {
  const sections = parseTechnicalProposalSections(raw);
  const pieces = [
    sections.scopeOfWork,
    sections.deliveryTimeline,
    sections.compliance,
    sections.differentiators,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .filter((p) => !BOILERPLATE_LINE.test(p));

  if (pieces.length) return pieces.join("\n\n");

  const fallback = String(raw || "").trim();
  if (!fallback) return "";
  return fallback
    .split("\n")
    .filter((line) => !BOILERPLATE_LINE.test(line.trim()))
    .join("\n")
    .trim();
}
