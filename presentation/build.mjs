import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = '/Users/nikhil/Documents/ChatGPT/google cloud';
const work = path.join(root, 'presentation');
const out = path.join(root, 'artifacts');
const build = path.join(work, '.build');
const nodeModules = '/Users/nikhil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(nodeModules, '@oai/artifact-tool/dist/artifact_tool.mjs')).href);
await fs.mkdir(build, { recursive: true });
await fs.mkdir(out, { recursive: true });
try { await fs.symlink(nodeModules, path.join(build, 'node_modules'), 'dir'); } catch (e) { if (e.code !== 'EEXIST') throw e; }

const W = 1280, H = 720;
const C = {
  paper: '#F4F1E8', white: '#FFFEFA', ink: '#172821', green: '#176B4B', pale: '#DDE9DF',
  muted: '#59675F', amber: '#BE7839', line: '#C9D1C8', faint: '#E8E6DC', red: '#9F4E3B',
};
const FONT = 'Avenir Next';
const deck = Presentation.create({ slideSize: { width: W, height: H } });

function tx(slide, text, x, y, w, h, size, color = C.ink, opts = {}) {
  const sh = slide.shapes.add({
    geometry: 'textbox', name: opts.name || text.slice(0, 40),
    position: { left: x, top: y, width: w, height: h },
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 },
  });
  sh.text = text;
  sh.text.style = {
    typeface: FONT, fontSize: size, color, bold: !!opts.bold,
    alignment: opts.align || 'left', verticalAlignment: opts.valign || 'top',
    wrap: 'square', autoFit: 'shrinkText', lineSpacing: opts.lineSpacing || 1.06,
    insets: 0,
  };
  return sh;
}
function rule(slide, x, y, w, color = C.line, weight = 1) {
  return slide.shapes.add({
    geometry: 'rect', position: { left: x, top: y, width: w, height: Math.max(1, weight) },
    line: { style: 'solid', fill: 'none', width: 0 }, fill: color,
  });
}
function header(slide, num, title, deckline) {
  tx(slide, 'SCAMSHIELD  /  CONCEPT PITCH', 72, 43, 500, 20, 13, C.green, { bold: true });
  tx(slide, `${num}  /  06`, 1110, 43, 98, 20, 12, C.muted, { align: 'right' });
  rule(slide, 72, 75, 1136, C.line, 1);
  tx(slide, title, 72, 104, 1120, 62, 40, C.ink, { bold: true, lineSpacing: 0.98 });
  if (deckline) tx(slide, deckline, 72, 171, 1100, 39, 18, C.muted);
}
function footer(slide, text = 'Synthetic demonstration concept  /  No payment execution') {
  rule(slide, 72, 665, 1136, C.line, 1);
  tx(slide, text, 72, 679, 1136, 19, 11, C.muted);
}
function slide() {
  const s = deck.slides.add();
  s.background.fill = C.paper;
  return s;
}

// 1 — Cover / concept
{
  const s = slide();
  tx(s, 'SCAMSHIELD', 72, 54, 420, 24, 15, C.green, { bold: true });
  tx(s, 'PAYMENT SAFETY  /  CONCEPT', 882, 57, 326, 20, 12, C.muted, { align: 'right' });
  rule(s, 72, 95, 1136, C.line, 1);
  tx(s, 'A pause at the\nright moment.', 72, 155, 690, 185, 66, C.ink, { bold: true, lineSpacing: 0.91 });
  tx(s, 'Payment risk review for the details that travel\nwith a transfer: the message, the recipient, the account.', 77, 374, 610, 82, 24, C.muted, { lineSpacing: 1.15 });
  rule(s, 72, 514, 1136, C.green, 2);
  tx(s, 'ONE ASSESSMENT ENGINE', 72, 538, 320, 20, 13, C.green, { bold: true });
  tx(s, 'Consumer transfer', 72, 574, 370, 34, 24, C.ink, { bold: true });
  tx(s, 'UPI payment with message context', 72, 612, 420, 24, 15, C.muted);
  tx(s, 'Business invoice', 659, 574, 370, 34, 24, C.ink, { bold: true });
  tx(s, 'Vendor details checked against records', 659, 612, 480, 24, 15, C.muted);
  tx(s, '01', 1124, 573, 82, 58, 40, C.green, { bold: true, align: 'right' });
  s.speakerNotes.text = 'ScamShield is a proposal for proportionate payment intervention. The prototype uses synthetic records and simulated outcomes. Source: approved design specification, docs/superpowers/specs/2026-10-11-scamshield-design.md.';
}

// 2 — Problem / synthetic example
{
  const s = slide(); header(s, '02', 'The risky detail often arrives beside the payment', 'Forms capture amount and destination. Context can change what the same payment means.');
  tx(s, 'SYNTHETIC EXAMPLE  /  UPI TRANSFER', 72, 244, 390, 21, 12, C.amber, { bold: true });
  tx(s, '₹25,000', 72, 280, 420, 74, 54, C.ink, { bold: true });
  tx(s, 'New recipient  ·  reserve@upi', 74, 364, 456, 29, 20, C.muted);
  rule(s, 72, 422, 465, C.line, 1);
  tx(s, '“Move your money to a safe account now.\nDo not call the bank.”', 72, 446, 485, 112, 25, C.ink, { lineSpacing: 1.13 });
  tx(s, 'MESSAGE TEXT IS EVIDENCE, NOT AN INSTRUCTION', 72, 580, 485, 19, 11, C.red, { bold: true });
  rule(s, 620, 242, 1, 365, C.line, 1);
  tx(s, 'WHAT THE REVIEW CAN SAY', 681, 250, 440, 21, 12, C.green, { bold: true });
  tx(s, 'Review the request\nbefore proceeding.', 681, 291, 490, 100, 35, C.ink, { bold: true, lineSpacing: 1.02 });
  tx(s, 'Recorded signals', 681, 424, 270, 25, 16, C.green, { bold: true });
  tx(s, 'New recipient\nSafe-account language\nRequest to avoid verification', 681, 459, 495, 99, 20, C.ink, { lineSpacing: 1.28 });
  tx(s, 'A recommendation follows configured policy. It is not a fraud verdict.', 681, 582, 500, 44, 14, C.muted);
  footer(s);
  s.speakerNotes.text = 'All payment and message details on this slide are synthetic. A safe-account classification at the specified provisional threshold together with a new recipient routes to review; the recommendation language is intentionally cautious. Source: approved design specification, sections “Rules and policy” and “Demonstration and evaluation”.';
}

// 3 — Two flows / shared engine
{
  const s = slide(); header(s, '03', 'Two payment paths share one decision engine', 'Adapters retain the details each workflow needs, then normalize into a common assessment.');
  const top = 245;
  tx(s, '01', 72, top, 58, 45, 28, C.green, { bold: true });
  tx(s, 'Consumer transfer', 151, top + 1, 360, 31, 24, C.ink, { bold: true });
  tx(s, 'Capture amount, UPI recipient and optional request message.\nCompare recipient and payment patterns with stored history.', 151, top + 48, 440, 80, 17, C.muted, { lineSpacing: 1.2 });
  tx(s, '02', 659, top, 58, 45, 28, C.green, { bold: true });
  tx(s, 'Invoice payment', 738, top + 1, 400, 31, 24, C.ink, { bold: true });
  tx(s, 'Capture invoice amount, vendor and requested bank account.\nCompare the destination with the vendor record.', 738, top + 48, 425, 80, 17, C.muted, { lineSpacing: 1.2 });
  rule(s, 72, 396, 1136, C.green, 2);
  tx(s, 'SHARED ENGINE', 72, 419, 220, 19, 12, C.green, { bold: true });
  const steps = [
    ['01', 'Normalize', 'One transaction contract'],
    ['02', 'Find evidence', 'Rules plus optional context'],
    ['03', 'Apply policy', 'Continue · verify · review'],
    ['04', 'Explain', 'Evidence-grounded summary'],
  ];
  const xs = [72, 360, 648, 936];
  for (let i = 0; i < steps.length; i++) {
    tx(s, steps[i][0], xs[i], 468, 64, 25, 14, C.amber, { bold: true });
    tx(s, steps[i][1], xs[i], 501, 245, 33, 22, C.ink, { bold: true });
    tx(s, steps[i][2], xs[i], 543, 252, 47, 15, C.muted, { lineSpacing: 1.13 });
  }
  footer(s);
  s.speakerNotes.text = 'The two workflow adapters feed one assessment contract. The policy recommendation is determined from recorded evidence; the explanation is generated separately and cannot change the recommendation. Source: approved design specification, sections “Workflows”, “Architecture” and “Model boundaries and resilience”.';
}

// 4 — Proposed architecture
{
  const s = slide(); header(s, '04', 'Keep evidence, policy and explanation separate', 'Each stage has a bounded job. Model output cannot authorize or execute a payment.');
  const rows = [
    { n: '01', label: 'ADAPTERS', main: 'UPI transfer  /  Vendor invoice', sub: 'Validate fields and normalize the request', color: C.ink },
    { n: '02', label: 'EVIDENCE', main: 'Rules  +  optional context classification', sub: 'Jev or Gemini on Vertex AI, selected by configuration', color: C.green },
    { n: '03', label: 'POLICY', main: 'Continue  /  Verify  /  Review', sub: 'Versioned thresholds map evidence to a recommendation', color: C.ink },
    { n: '04', label: 'EXPLANATION', main: 'Vertex AI Gemini summary', sub: 'Separate call after the decision is stored; fallback on failure', color: C.green },
  ];
  let y = 243;
  for (const row of rows) {
    tx(s, row.n, 72, y + 7, 54, 38, 20, C.amber, { bold: true });
    tx(s, row.label, 144, y + 9, 180, 20, 12, row.color, { bold: true });
    tx(s, row.main, 350, y, 760, 36, 23, C.ink, { bold: true });
    tx(s, row.sub, 350, y + 39, 760, 25, 15, C.muted);
    rule(s, 144, y + 78, 994, C.line, 1);
    y += 96;
  }
  tx(s, 'NOW', 72, 635, 61, 18, 11, C.green, { bold: true });
  tx(s, 'Synthetic records  /  fixture mode available  /  integrations configurable and unverified', 144, 631, 980, 25, 14, C.muted);
  footer(s, 'Proposed architecture  /  Provider calls remain on the backend');
  s.speakerNotes.text = 'Context classification is configurable: Jev or Gemini on Vertex AI. Gemini explanation remains a separate call after the recommendation is stored. Fixture mode supports a reproducible offline demonstration. Live providers and deployment are unverified. Source: approved design specification, sections “Architecture” and “Model boundaries and resilience”, with the project integration clarification that Google Cloud Gemini classification is supported and Jev is optional.';
}

// 5 — Demo and evaluation
{
  const s = slide(); header(s, '05', 'Show the evidence, then measure the behavior', 'A short demo moves across both workflows and includes a normal repeat payment.');
  tx(s, 'DEMO CASES', 72, 243, 300, 20, 12, C.green, { bold: true });
  const cases = [
    ['01', 'Safe-account message, new UPI recipient', 'REVIEW'],
    ['02', 'Legitimate large consumer payment', 'VERIFY'],
    ['03', 'Urgent, ambiguous family request', 'VERIFY'],
    ['04', 'Invoice with changed vendor account', 'REVIEW'],
    ['05', 'Repeat invoice, matching account', 'CONTINUE'],
    ['06', 'Context provider timeout', 'VERIFY'],
  ];
  let yy = 278;
  for (const [n, name, outcome] of cases) {
    tx(s, n, 72, yy, 42, 22, 13, C.amber, { bold: true });
    tx(s, name, 128, yy, 390, 24, 15, C.ink);
    tx(s, outcome, 515, yy, 106, 20, 10, outcome === 'REVIEW' ? C.red : C.green, { bold: true, align: 'right' });
    rule(s, 72, yy + 32, 549, C.line, 1);
    yy += 42;
  }
  rule(s, 663, 243, 1, 358, C.line, 1);
  tx(s, 'EVALUATION PLAN', 711, 243, 380, 20, 12, C.green, { bold: true });
  tx(s, '40', 711, 281, 95, 68, 48, C.ink, { bold: true });
  tx(s, 'synthetic examples', 810, 299, 260, 26, 18, C.muted);
  tx(s, '20 development  /  20 held out', 711, 358, 440, 25, 15, C.ink);
  rule(s, 711, 399, 425, C.green, 2);
  tx(s, 'Compare rules-only with the\nconfigured classifier on identical inputs.', 711, 422, 450, 61, 21, C.ink, { bold: true, lineSpacing: 1.1 });
  tx(s, 'Report intervention recall, intervention rate on legitimate cases, ambiguous routing and provider failures. Measure latency separately.', 711, 500, 452, 78, 15, C.muted, { lineSpacing: 1.2 });
  footer(s, 'Synthetic evaluation plan  /  No measured accuracy or latency claims');
  s.speakerNotes.text = 'The six named scenarios are in the spec; this slide shows four representative outcomes. Evaluation uses 40 synthetic examples split into 20 development and 20 held-out, with identical-input rules-only comparison. The dataset does not establish real-world fraud accuracy. Source: approved design specification, section “Demonstration and evaluation”.';
}

// 6 — MVP and next steps
{
  const s = slide(); header(s, '06', 'A focused prototype fits a 48–72 hour build window', 'Deliver the two simulators and an auditable recommendation path before extending scope.');
  tx(s, 'FIRST 48 HOURS', 72, 244, 430, 20, 12, C.green, { bold: true });
  tx(s, 'Contracts and fixtures', 72, 282, 480, 29, 22, C.ink, { bold: true });
  tx(s, 'Two adapters, deterministic rules, policy checks and a shared API.', 72, 322, 465, 53, 16, C.muted);
  rule(s, 72, 396, 480, C.line, 1);
  tx(s, 'Simulators and investigation view', 72, 418, 520, 29, 22, C.ink, { bold: true });
  tx(s, 'Consumer transfer, invoice payment, case history and recorded evidence.', 72, 458, 480, 53, 16, C.muted);
  rule(s, 72, 532, 480, C.line, 1);
  tx(s, 'Provider integrations', 72, 554, 440, 28, 22, C.ink, { bold: true });
  tx(s, 'Configure Gemini classification and explanation separately; Jev remains optional.', 72, 592, 475, 42, 15, C.muted);
  rule(s, 648, 244, 1, 369, C.line, 1);
  tx(s, 'NEXT 24 HOURS  /  BUFFER', 702, 244, 400, 20, 12, C.amber, { bold: true });
  tx(s, 'Held-out evaluation', 702, 282, 430, 29, 22, C.ink, { bold: true });
  tx(s, 'Compare policy behavior, record failures and measure latency by stage.', 702, 322, 434, 52, 16, C.muted);
  rule(s, 702, 396, 436, C.line, 1);
  tx(s, 'Cloud readiness check', 702, 418, 430, 29, 22, C.ink, { bold: true });
  tx(s, 'Test persistence and both flows before describing a cloud deployment.', 702, 458, 435, 52, 16, C.muted);
  rule(s, 702, 532, 436, C.green, 2);
  tx(s, 'MVP boundary', 702, 554, 250, 26, 18, C.green, { bold: true });
  tx(s, 'Synthetic data. Simulated outcomes. No payment execution.', 702, 592, 442, 40, 15, C.ink);
  footer(s, 'Next step: confirm provider access and begin with fixtures  /  Live integrations remain unverified');
  s.speakerNotes.text = 'The schedule is a proposed delivery sequence, not a claim that implementation or deployment has completed. Cloud readiness requires integration checks against PostgreSQL and end-to-end flows. Optional invoice extraction is outside this first pitch scope. Source: approved design specification “Delivery sequence” and implementation plan “Presentation”.';
}

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}
for (const [i, s] of deck.slides.items.entries()) {
  const png = await deck.export({ slide: s, format: 'png', scale: 1 });
  await writeBlob(path.join(build, `slide-${String(i + 1).padStart(2, '0')}.png`), png);
  const layout = await s.export({ format: 'layout' });
  await fs.writeFile(path.join(build, `slide-${String(i + 1).padStart(2, '0')}.layout.json`), await layout.text());
}
const candidate = path.join(build, 'scamshield-candidate.pptx');
await (await PresentationFile.exportPptx(deck)).save(candidate);

const skill = '/Users/nikhil/.codex/plugins/cache/openai-primary-runtime/presentations/26.1009.11318/skills/presentations';
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
process.env.RUNTIME_NODE_MODULES = nodeModules;
const staging = path.join(build, 'finalizer');
await fs.mkdir(staging, { recursive: true });
const finalPptx = path.join(out, 'scamshield-pitch.pptx');
const finalizedRevision = path.join(out, `scamshield-pitch-${Date.now()}.pptx`);
const result = await finalizePresentation({
  explicitTotalSlideCount: 6,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  workspaceDir: root,
  candidatePath: candidate,
  finalPath: finalizedRevision,
  pythonExecutable: '/Users/nikhil/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-heading-fit'],
  fontPolicy: { basis: 'design', families: [FONT] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(staging, `scamshield-pitch-${Date.now()}.validation.json`),
});
await fs.copyFile(finalizedRevision, finalPptx);
await fs.rm(finalizedRevision);
await fs.rm(path.join(out, 'scamshield-pitch.pdf'), { force: true });
await promisify(execFile)('/Users/nikhil/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice', [
  '--headless', '--convert-to', 'pdf', '--outdir', out, finalPptx,
]);
console.log(JSON.stringify({ finalPptx, pdf: path.join(out, 'scamshield-pitch.pdf'), result }, null, 2));
