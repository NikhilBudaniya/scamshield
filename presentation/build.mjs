/**
 * Content and request plan for the ScamShield Hack2skill submission copy.
 *
 * The user supplied a native Google Slides template. This script emits native
 * Slides batchUpdate requests that edit its copied slides in place, retaining
 * the original slide order, branding, and media. Run:
 *   node presentation/build.mjs presentation/.build/requests.json
 * Then apply that JSON to the copied presentation ID with the Google Drive
 * connector. The original template is never edited.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export const TEMPLATE_ID = '13rg7vW43mEH6DkpuusAE6fdoEylSFz8waNpE4RLzoUg';
export const COPY_ID = '1FPicCNALBcWR8fb2YpirQG655ZgGD-JJlxRr6I45Wfs';
export const VIDEO_URL = 'https://github.com/NikhilBudaniya/scamshield/releases/download/hackathon-prototype/scamshield-demo.mp4';

const ids = {
  cover: 'p',
  instruction: 'g3fb085bff3c_0_134',
  idea: 'g3fb085bff3c_0_4',
  opportunity: 'g3fb085bff3c_0_11',
  features: 'g3fb085bff3c_0_16',
  flow: 'g3fb085bff3c_0_21',
  wireframe: 'g3fb085bff3c_0_26',
  architecture: 'g3fb085bff3c_0_31',
  technologies: 'g3fb085bff3c_0_36',
  cost: 'g3fb085bff3c_0_41',
  snapshots: 'g3fb085bff3c_0_46',
  performance: 'g3fb085bff3c_0_51',
  future: 'g3fb085bff3c_0_56',
  links: 'g3fb085bff3c_0_61',
  blank: 'g3fb085bff3c_0_107',
  thankYou: 'g3fb085bff3c_0_66',
};

export const slidePlan = [
  { n: 1, role: 'Team and problem', slideId: ids.cover, construction: 'edit existing template slide in place' },
  { n: 2, role: 'Idea overview', slideId: ids.idea, construction: 'edit existing template slide in place' },
  { n: 3, role: 'Opportunity and differentiation', slideId: ids.opportunity, construction: 'edit existing template slide in place' },
  { n: 4, role: 'Features', slideId: ids.features, construction: 'edit existing template slide in place' },
  { n: 5, role: 'Invoice flow', slideId: ids.flow, construction: 'edit existing template slide in place' },
  { n: 6, role: 'Hybrid risk decision', slideId: ids.wireframe, construction: 'edit existing template slide in place' },
  { n: 7, role: 'Target architecture', slideId: ids.architecture, construction: 'edit existing template slide in place' },
  { n: 8, role: 'Technology stack', slideId: ids.technologies, construction: 'edit existing template slide in place' },
  { n: 9, role: 'Cost and data-use limits', slideId: ids.cost, construction: 'edit existing template slide in place' },
  { n: 10, role: 'Prototype evidence', slideId: ids.snapshots, construction: 'edit existing template slide in place and insert a cropped real Cloud Run synthetic case capture' },
  { n: 11, role: 'Prototype verification', slideId: ids.performance, construction: 'edit existing template slide in place' },
  { n: 12, role: 'Future development', slideId: ids.future, construction: 'edit existing template slide in place' },
  { n: 13, role: 'Submission links', slideId: ids.links, construction: 'edit existing template slide in place' },
  { n: 14, role: 'Closing', slideId: ids.thankYou, construction: 'preserve source slide unchanged' },
];

const titleReplacements = [
  ['Team Details', 'ScamShield'],
  ['Brief about the idea', 'ScamShield invoice intelligence'],
  ['Opportunities', 'Invoice fraud in numbers'],
  ['List of features offered by the solution', 'Solution features'],
  ['Process flow diagram or Use-case diagram', 'Invoice review flow'],
  ['Invoice review flow (optional)', 'Hybrid risk decision'],
  ['Target Google Cloud architecture', 'Live Google Cloud architecture'],
  ['Technologies to be used in the solution', 'Technology stack'],
  ['Implementation cost (optional)', 'Cost and data safeguards'],
  ['Prototype Performance report/Benchmarking', 'Prototype verification'],
  ['Additional Details/Future Development (if any)', 'Future development'],
  ['Provide links to your:', 'Submission links'],
  ['Demo Video Link (3 Minutes)', 'Demo Video Link (3–4 Minutes)'],
  ['Snapshots of the prototype', 'Live synthetic case evidence'],
];

const bodySlides = [
  {
    slideId: ids.idea, objectId: 'ssbody03', size: 14,
    text: `Invoice fraud hides in ordinary payment work: a familiar invoice can carry a changed bank account or a request to bypass checks.\n\nScamShield is an invoice-first fraud intervention that combines Gemini’s semantic reading of payment instructions with deterministic transaction checks. The same pattern can extend to other payment rails.\n\nLIVE PROTOTYPE  Two synthetic invoice paths ran on the public service. People confirm extracted fields; policy returns Continue, Verify or Review. No payment is executed.`,
  },
  {
    slideId: ids.opportunity, objectId: 'ssbody04', size: 14, top: 120,
    text: `£41.3m   UK invoice and mandate fraud losses · 2025\n2,305   reported UK cases · 2025\n68%   of loss value on business and other non-personal accounts\n\nSemantic context plus transaction checks can surface risky invoice instructions before payment.\nSource: UK Finance, Fraud Report 2026, p. 41.`,
  },
  {
    slideId: ids.features, objectId: 'ssbody05', size: 14,
    text: `MODEL-READ SEMANTIC SIGNALS\nGemini classifies impersonation, safe-account claims, urgency, secrecy, upfront fees and verification bypass. For invoices, it also extracts candidate fields for a person to confirm.\n\nDETERMINISTIC TRANSACTION CHECKS\nRules compare amount, payment history, vendor identity and destination account with available case and vendor records.\n\nPOLICY OUTCOMES\nA deterministic policy maps the combined evidence to Continue, Verify or Review. Evidence and missing checks are saved with the case.`,
  },
  {
    slideId: ids.flow, objectId: 'ssbody06', size: 14,
    text: `INVOICE REVIEW FLOW\n01  Upload → Gemini field extraction → human confirmation.\n02  Gemini classifies payment-request context; rules check amount, history and destination.\n03  Deterministic policy returns Continue, Verify or Review.\n04  Firestore stores the case.\n\nWhen requested, Gemini orders recorded evidence and deterministic templates render the explanation after the policy decision.`,
  },
  {
    slideId: ids.wireframe, objectId: 'ssbody07', size: 14,
    text: `MODEL CONTEXT + TRANSACTION FACTS\nGemini semantic classification\nImpersonation · safe-account claim · urgency\nSecrecy · upfront fee · verification bypass\n\nDETERMINISTIC CHECKS\nAmount · payment history · vendor identity\nDestination account against saved vendor record\n\nPOLICY DECISION\nThe policy combines available signals and checks into Continue, Verify or Review. Example: impersonation and secrecy scores each at least 0.8 map to Review.`,
  },
  {
    slideId: ids.architecture, objectId: 'ssbody08', size: 13,
    text: `LIVE GOOGLE CLOUD PATH\nFirebase anonymous authentication protects the React browser client. The client sends requests to FastAPI on Cloud Run.\n\nVertex AI Gemini 2.5 Flash-Lite extracts invoice fields and classifies six semantic signals. A person confirms fields before deterministic checks compare amount, history, vendor and destination evidence.\n\nThe policy returns Continue, Verify or Review. Firestore stores owner-scoped cases and model-request quotas. Gemini orders recorded evidence only when an explanation is requested; deterministic templates render it.`,
  },
  {
    slideId: ids.technologies, objectId: 'ssbody09', size: 13,
    text: `LIVE PROTOTYPE\nReact and TypeScript · Python FastAPI · deterministic policy\nFirebase anonymous authentication · Firestore · Cloud Run\nVertex AI Gemini 2.5 Flash-Lite for invoice extraction and semantic classification\n\nNEXT CLASSIFIER: JEV\nJev is a candidate structured decision model for a low-latency classification path. Its adapter passes fixture tests but is disabled on live GCP. Latency and quality remain unmeasured.`,
  },
  {
    slideId: ids.cost, objectId: 'ssbody10', size: 13,
    text: `CLOUD COST STATUS\nCloud Run, Firestore and Vertex AI calls may incur charges. Credit coverage is unconfirmed.\n\nA ₹100 project budget alert is configured through 6 November 2026. Alerts notify; they do not stop spending.\n\nMODEL REQUEST LIMITS\n9 attempts per visitor per day · 50 globally per day · 200 total. These restrict model calls and are not a billing cap.\n\nUse synthetic invoice data only.`,
  },
  {
    slideId: ids.snapshots, objectId: 'ssbody11', size: 14,
    text: `LIVE SYNTHETIC INVOICE CASE\nThe public app used Vertex Gemini to extract fields and classify request context. The person confirmed the vendor destination before assessment. The deterministic policy then assessed recorded evidence.\n\nOne invoice matched the saved account and returned Continue. The changed destination case returned Review. A requested explanation used Gemini-ranked saved evidence with deterministic templates. Firestore retained both cases across a deployment revision. No payment moved.`,
  },
  {
    slideId: ids.performance, objectId: 'ssbody12', size: 13,
    text: `SOFTWARE CHECKS\n59 backend tests pass in the release check.\n\nLIVE INTEGRATION CHECK\nTwo synthetic invoice paths completed with live Vertex Gemini extraction and classification. A requested explanation used Gemini-ranked evidence with deterministic templates. Firestore readback, retry idempotency, restart durability and visitor isolation were verified.\n\nEVIDENCE LIMIT\nThese checks establish integration behavior, not fraud-detection accuracy or model latency. No accuracy or latency benchmark is claimed.`,
  },
  {
    slideId: ids.future, objectId: 'ssbody13', size: 13,
    text: `NEXT STEPS\n01  Benchmark Jev against Gemini on a reviewed case set: p50/p95 latency, precision, recall, false-positive rate and calibration.\n02  Keep Jev disabled until quality and operational checks are complete.\n03  Add verified vendor feeds and extend beyond invoices to more payment rails.\n04  Preserve human review and deterministic policy control; the app never initiates a payment.`,
  },
  {
    slideId: ids.links, objectId: 'ssbody14', size: 14, top: 126,
    text: `Public repository\nhttps://github.com/NikhilBudaniya/scamshield\n\nLive Cloud Run app\nhttps://scamshield-304420617883.us-central1.run.app\n\n3:03 demo video\nWatch demo video (3:03)\n\nUse synthetic examples only. No payment is executed.`,
  },
];

function replaceText(text, replaceText) {
  return {
    replaceAllText: {
      containsText: { text, matchCase: true },
      replaceText,
    },
  };
}

function createBodyRequests({ slideId, objectId, text, size, top, scaleY }) {
  return [
    {
      createShape: {
        objectId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 660, unit: 'PT' }, height: { magnitude: 265, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: scaleY ?? 1, translateX: 30, translateY: top ?? 104, unit: 'PT' },
        },
      },
    },
    {
      updateShapeProperties: {
        objectId,
        shapeProperties: {
          shapeBackgroundFill: { propertyState: 'NOT_RENDERED' },
          outline: { propertyState: 'NOT_RENDERED' },
        },
        fields: 'shapeBackgroundFill,outline',
      },
    },
    { insertText: { objectId, insertionIndex: 0, text } },
    {
      updateTextStyle: {
        objectId,
        textRange: { type: 'ALL' },
        style: {
          fontFamily: 'Google Sans Flex',
          fontSize: { magnitude: size, unit: 'PT' },
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.12, green: 0.16, blue: 0.15 } } },
        },
        fields: 'fontFamily,fontSize,foregroundColor',
      },
    },
    {
      updateParagraphStyle: {
        objectId,
        textRange: { type: 'ALL' },
        style: {
          lineSpacing: 112,
          spaceAbove: { magnitude: 0, unit: 'PT' },
          spaceBelow: { magnitude: 6, unit: 'PT' },
        },
        fields: 'lineSpacing,spaceAbove,spaceBelow',
      },
    },
  ];
}

function nodeRequests({ slideId, id, text, x, y, width, height, fill = { red: 0.9, green: 0.95, blue: 0.93 } }) {
  return [
    {
      createShape: {
        objectId: id,
        shapeType: 'ROUND_RECTANGLE',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: width, unit: 'PT' }, height: { magnitude: height, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'PT' },
        },
      },
    },
    {
      updateShapeProperties: {
        objectId: id,
        shapeProperties: {
          shapeBackgroundFill: { solidFill: { color: { rgbColor: fill } } },
          outline: { outlineFill: { solidFill: { color: { rgbColor: { red: 0.16, green: 0.38, blue: 0.34 } } } } },
          contentAlignment: 'MIDDLE',
        },
        fields: 'shapeBackgroundFill,outline,contentAlignment',
      },
    },
    { insertText: { objectId: id, insertionIndex: 0, text } },
    { updateTextStyle: { objectId: id, textRange: { type: 'ALL' }, style: { fontFamily: 'Google Sans Flex', fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: { opaqueColor: { rgbColor: { red: 0.12, green: 0.16, blue: 0.15 } } } }, fields: 'fontFamily,fontSize,foregroundColor' } },
    { updateParagraphStyle: { objectId: id, textRange: { type: 'ALL' }, style: { alignment: 'CENTER', lineSpacing: 105, spaceAbove: { magnitude: 0, unit: 'PT' }, spaceBelow: { magnitude: 0, unit: 'PT' } }, fields: 'alignment,lineSpacing,spaceAbove,spaceBelow' } },
  ];
}

function arrowRequests({ slideId, id, x1, y1, x2, y2 }) {
  return [
    { createLine: { objectId: id, lineCategory: 'STRAIGHT', elementProperties: { pageObjectId: slideId, size: { width: { magnitude: Math.max(0.1, Math.abs(x2 - x1)), unit: 'PT' }, height: { magnitude: Math.max(0.1, Math.abs(y2 - y1)), unit: 'PT' } }, transform: { scaleX: x2 < x1 ? -1 : 1, scaleY: y2 < y1 ? -1 : 1, translateX: x1, translateY: y1, unit: 'PT' } } } },
    { updateLineProperties: { objectId: id, lineProperties: { lineFill: { solidFill: { color: { rgbColor: { red: 0.16, green: 0.38, blue: 0.34 } } } }, weight: { magnitude: 1.5, unit: 'PT' }, endArrow: 'FILL_ARROW' }, fields: 'lineFill,weight,endArrow' } },
  ];
}

function noteRequests({ slideId, id, text, y, height = 35 }) {
  return [
    { createShape: { objectId: id, shapeType: 'TEXT_BOX', elementProperties: { pageObjectId: slideId, size: { width: { magnitude: 660, unit: 'PT' }, height: { magnitude: height, unit: 'PT' } }, transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: y, unit: 'PT' } } } },
    { insertText: { objectId: id, insertionIndex: 0, text } },
    { updateTextStyle: { objectId: id, textRange: { type: 'ALL' }, style: { fontFamily: 'Google Sans Flex', fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: { opaqueColor: { rgbColor: { red: 0.12, green: 0.16, blue: 0.15 } } } }, fields: 'fontFamily,fontSize,foregroundColor' } },
  ];
}

function processDiagramRequests() {
  const slideId = ids.flow;
  const nodes = [
    ['ssflow01', 'Invoice upload'],
    ['ssflow02', 'Gemini field extraction'],
    ['ssflow03', 'Human review and confirmation'],
    ['ssflow04', 'Rules + Gemini context'],
    ['ssflow05', 'Policy decision\nContinue · Verify · Review'],
    ['ssflow06', 'Firestore case record'],
  ];
  const startX = 27, width = 106, gap = 6, y = 138, height = 78;
  const requests = [];
  for (let i = 0; i < nodes.length; i++) requests.push(...nodeRequests({ slideId, id: nodes[i][0], text: nodes[i][1], x: startX + i * (width + gap), y, width, height }));
  for (let i = 0; i < nodes.length - 1; i++) requests.push(...arrowRequests({ slideId, id: `ssflowarrow${i + 1}`, x1: startX + i * (width + gap) + width, y1: y + height / 2, x2: startX + (i + 1) * (width + gap), y2: y + height / 2 }));
  requests.push(...nodeRequests({ slideId, id: 'ssflowoptional01', text: 'On request: Gemini ranks saved evidence', x: 195, y: 250, width: 220, height: 56, fill: { red: 0.96, green: 0.95, blue: 0.9 } }));
  requests.push(...nodeRequests({ slideId, id: 'ssflowoptional02', text: 'Deterministic templates render the explanation', x: 460, y: 250, width: 220, height: 56, fill: { red: 0.96, green: 0.95, blue: 0.9 } }));
  requests.push(...arrowRequests({ slideId, id: 'ssflowoptionalarrow', x1: 415, y1: 278, x2: 460, y2: 278 }));
  requests.push(...noteRequests({ slideId, id: 'ssflowfoot', text: 'Synthetic demo only. The recommendation is simulated; no payment is executed.', y: 324 }));
  return requests;
}

function architectureDiagramRequests() {
  const slideId = ids.architecture;
  const nodes = [
    ['ssarch01', 'Firebase anonymous auth'],
    ['ssarch02', 'Browser client\nReact'],
    ['ssarch03', 'Cloud Run\nFastAPI'],
  ];
  const startX = 30, width = 150, gap = 44, y = 148, height = 76;
  const requests = [];
  for (let i = 0; i < nodes.length; i++) requests.push(...nodeRequests({ slideId, id: nodes[i][0], text: nodes[i][1], x: startX + i * (width + gap), y, width, height }));
  requests.push(...arrowRequests({ slideId, id: 'ssarcharrow1', x1: 180, y1: y + height / 2, x2: 224, y2: y + height / 2 }));
  requests.push(...arrowRequests({ slideId, id: 'ssarcharrow2', x1: 374, y1: y + height / 2, x2: 418, y2: y + height / 2 }));
  requests.push(...nodeRequests({ slideId, id: 'ssarch04', text: 'Vertex AI\nGemini 2.5 Flash-Lite', x: 142, y: 274, width: 194, height: 62, fill: { red: 0.96, green: 0.95, blue: 0.9 } }));
  requests.push(...nodeRequests({ slideId, id: 'ssarch05', text: 'Firestore\nOwner-scoped cases + quotas', x: 390, y: 274, width: 194, height: 62, fill: { red: 0.96, green: 0.95, blue: 0.9 } }));
  requests.push(...arrowRequests({ slideId, id: 'ssarcharrow3', x1: 493, y1: 224, x2: 290, y2: 274 }));
  requests.push(...arrowRequests({ slideId, id: 'ssarcharrow04', x1: 493, y1: 224, x2: 487, y2: 274 }));
  requests.push(...noteRequests({ slideId, id: 'ssarchfoot', text: 'Cloud Run owns deterministic policy and Firestore writes. Gemini classifies context and orders recorded evidence on request; templates render explanations. No payment executes.', y: 346, height: 36 }));
  return requests;
}

function hybridDecisionDiagramRequests() {
  const slideId = ids.wireframe;
  const requests = [{ deleteObject: { objectId: 'ssbody07' } }];
  // Clear the prior draft diagram before rebuilding it with the revised decision logic.
  requests.push(...nodeRequests({ slideId, id: 'sshybrid01', text: 'Gemini semantic context\n6 signals from payment language', x: 34, y: 136, width: 198, height: 76 }));
  requests.push(...nodeRequests({ slideId, id: 'sshybrid02', text: 'Transaction facts\nAmount · history · vendor · destination', x: 34, y: 244, width: 198, height: 76 }));
  requests.push(...nodeRequests({ slideId, id: 'sshybrid03', text: 'Deterministic policy\nCombine available evidence', x: 292, y: 190, width: 176, height: 82, fill: { red: 0.96, green: 0.95, blue: 0.9 } }));
  requests.push(...nodeRequests({ slideId, id: 'sshybrid04', text: 'Continue · Verify · Review', x: 526, y: 190, width: 158, height: 82 }));
  requests.push(...arrowRequests({ slideId, id: 'sshybridarrow01', x1: 232, y1: 174, x2: 292, y2: 213 }));
  requests.push(...arrowRequests({ slideId, id: 'sshybridarrow02', x1: 232, y1: 282, x2: 292, y2: 250 }));
  requests.push(...arrowRequests({ slideId, id: 'sshybridarrow03', x1: 468, y1: 231, x2: 526, y2: 231 }));
  requests.push(...nodeRequests({ slideId, id: 'sshybridcase', text: 'Policy example: impersonation + secrecy scores each ≥ 0.8 → Review', x: 92, y: 334, width: 536, height: 40, fill: { red: 0.96, green: 0.95, blue: 0.9 } }));
  requests.push(...noteRequests({ slideId, id: 'sshybridnote', text: 'Scores describe language signals, not fraud probability.', y: 377, height: 18 }));
  requests.push({ updateTextStyle: { objectId: 'sshybridnote', textRange: { type: 'ALL' }, style: { fontSize: { magnitude: 8, unit: 'PT' } }, fields: 'fontSize' } });
  return requests;
}

export function buildRequests() {
  const requests = [];
  for (const [text, replaceTextValue] of titleReplacements) requests.push(replaceText(text, replaceTextValue));
  requests.push({ deleteObject: { objectId: ids.instruction } });
  requests.push({ deleteObject: { objectId: ids.blank } });
  for (const body of bodySlides) {
    if ([ids.snapshots, ids.flow, ids.wireframe, ids.architecture].includes(body.slideId)) continue;
    requests.push({ deleteObject: { objectId: body.objectId } });
    requests.push(...createBodyRequests(body));
  }
  const demoLabel = 'Watch demo video (3:03)';
  const demoText = bodySlides.find(body => body.slideId === ids.links).text;
  const demoStart = demoText.indexOf(demoLabel);
  requests.push({ updateTextStyle: { objectId: 'ssbody14', textRange: { type: 'FIXED_RANGE', startIndex: demoStart, endIndex: demoStart + demoLabel.length }, style: { link: { url: VIDEO_URL }, underline: true, foregroundColor: { opaqueColor: { rgbColor: { red: 0.08, green: 0.26, blue: 0.55 } } } }, fields: 'link,underline,foregroundColor' } });

  // Rebuild existing editable diagrams and replace the former repetitive flow sketch.
  for (const id of ['ssflow01','ssflow02','ssflow03','ssflow04','ssflow05','ssflow06','ssflowoptional01','ssflowoptional02','ssflowfoot','ssflowarrow1','ssflowarrow2','ssflowarrow3','ssflowarrow4','ssflowarrow5','ssflowoptionalarrow']) requests.push({ deleteObject: { objectId: id } });
  for (const id of ['ssarch01','ssarch02','ssarch03','ssarch04','ssarch05','ssarcharrow1','ssarcharrow2','ssarcharrow3','ssarcharrow04','ssarchfoot']) requests.push({ deleteObject: { objectId: id } });
  requests.push(...processDiagramRequests(), ...architectureDiagramRequests(), ...hybridDecisionDiagramRequests());

  const researchSourceLabel = 'Source: UK Finance, Fraud Report 2026, p. 41.';
  const researchText = bodySlides.find(body => body.slideId === ids.opportunity).text;
  const researchStart = researchText.indexOf(researchSourceLabel);
  requests.push({ updateTextStyle: { objectId: 'ssbody04', textRange: { type: 'FIXED_RANGE', startIndex: 0, endIndex: '£41.3m'.length }, style: { fontSize: { magnitude: 26, unit: 'PT' }, bold: true }, fields: 'fontSize,bold' } });
  const casesIndex = researchText.indexOf('2,305');
  requests.push({ updateTextStyle: { objectId: 'ssbody04', textRange: { type: 'FIXED_RANGE', startIndex: casesIndex, endIndex: casesIndex + '2,305'.length }, style: { fontSize: { magnitude: 24, unit: 'PT' }, bold: true }, fields: 'fontSize,bold' } });
  const percentIndex = researchText.indexOf('68%');
  requests.push({ updateTextStyle: { objectId: 'ssbody04', textRange: { type: 'FIXED_RANGE', startIndex: percentIndex, endIndex: percentIndex + '68%'.length }, style: { fontSize: { magnitude: 24, unit: 'PT' }, bold: true }, fields: 'fontSize,bold' } });
  requests.push({ updateTextStyle: { objectId: 'ssbody04', textRange: { type: 'FIXED_RANGE', startIndex: researchStart, endIndex: researchStart + researchSourceLabel.length }, style: { fontSize: { magnitude: 9, unit: 'PT' }, link: { url: 'https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf' }, underline: true, foregroundColor: { opaqueColor: { rgbColor: { red: 0.08, green: 0.26, blue: 0.55 } } } }, fields: 'fontSize,link,underline,foregroundColor' } });
  requests.push({ insertText: { objectId: 'g3fb085bff3c_0_15', insertionIndex: 0, text: 'Source: UK Finance Fraud Report 2026, p. 41. For 2025 UK invoice and mandate fraud: £41.3m gross losses across 2,305 cases; 68% of lost value was on business and other non-personal accounts. Reported totals include value later recovered. https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf' } });
  const screenshotPath = path.resolve('artifacts/screenshots/live-05-slide-crop.jpg');
  requests.push({ deleteObject: { objectId: 'ssinvoiceimg11' } });
  requests.push({ deleteObject: { objectId: 'ssbody11new' } });
  requests.push({
    createImage: {
      objectId: 'ssinvoiceimg11',
      url: screenshotPath,
      elementProperties: {
        pageObjectId: ids.snapshots,
        size: { width: { magnitude: 174, unit: 'PT' }, height: { magnitude: 274, unit: 'PT' } },
        transform: { scaleX: 1, scaleY: 1, translateX: 42, translateY: 104, unit: 'PT' },
      },
    },
  });
  requests.push(...createBodyRequests({
    slideId: ids.snapshots,
    objectId: 'ssbody11new',
    size: 14,
    text: bodySlides.find(body => body.slideId === ids.snapshots).text,
  }).map(request => {
    if (request.createShape) {
      return {
        createShape: {
          ...request.createShape,
          elementProperties: {
            pageObjectId: ids.snapshots,
            size: { width: { magnitude: 410, unit: 'PT' }, height: { magnitude: 235, unit: 'PT' } },
            transform: { scaleX: 1, scaleY: 1, translateX: 265, translateY: 130, unit: 'PT' },
          },
        },
      };
    }
    return request;
  }));

  // Keep cost, verification and research source context in speaker notes.
  requests.push({ deleteText: { objectId: 'g3fb085bff3c_0_45', textRange: { type: 'ALL' } } });
  requests.push({
    insertText: {
      objectId: 'g3fb085bff3c_0_45',
      insertionIndex: 0,
      text: 'ScamShield uses Vertex AI Gemini 2.5 Flash-Lite, Firebase Authentication, Firestore and Cloud Run. The ₹100 budget alert through 6 Nov 2026 is not a spending cap. 59 backend tests passed. Live synthetic invoice checks covered extraction, classification, requested explanation, Firestore reads, idempotency, restart durability and visitor isolation. Use synthetic data only.',
    },
  });
  requests.push({ insertText: { objectId: 'g3fb085bff3c_0_40', insertionIndex: 0, text: 'TypeSafe describes Jev as a structured probabilistic decision model intended to emit actionable structured decisions. ScamShield’s adapter passes fixture tests but is disabled on live GCP. Jev has no measured latency or quality result in this project. https://typesafe.ai/blog/introducing-system-one-models-and-jev' } });
  return requests;
}

const destination = process.argv[2];
if (destination) {
  const outputPath = path.resolve(destination);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(buildRequests(), null, 2));
  console.log(JSON.stringify({
    copyId: COPY_ID,
    requestCount: buildRequests().length,
    slideCount: slidePlan.length,
    output: outputPath,
  }, null, 2));
}
