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
  { n: 2, role: 'Template instructions', slideId: ids.instruction, construction: 'preserve source slide unchanged' },
  { n: 3, role: 'Idea overview', slideId: ids.idea, construction: 'edit existing template slide in place' },
  { n: 4, role: 'Opportunity and differentiation', slideId: ids.opportunity, construction: 'edit existing template slide in place' },
  { n: 5, role: 'Features', slideId: ids.features, construction: 'edit existing template slide in place' },
  { n: 6, role: 'Invoice flow', slideId: ids.flow, construction: 'edit existing template slide in place' },
  { n: 7, role: 'Optional invoice-review sketch', slideId: ids.wireframe, construction: 'edit existing template slide in place' },
  { n: 8, role: 'Target architecture', slideId: ids.architecture, construction: 'edit existing template slide in place' },
  { n: 9, role: 'Technology stack', slideId: ids.technologies, construction: 'edit existing template slide in place' },
  { n: 10, role: 'Cost and data-use limits', slideId: ids.cost, construction: 'edit existing template slide in place' },
  { n: 11, role: 'Prototype evidence', slideId: ids.snapshots, construction: 'edit existing template slide in place and insert a cropped real Cloud Run synthetic case capture' },
  { n: 12, role: 'Performance and verification', slideId: ids.performance, construction: 'edit existing template slide in place' },
  { n: 13, role: 'Future development', slideId: ids.future, construction: 'edit existing template slide in place' },
  { n: 14, role: 'Submission links', slideId: ids.links, construction: 'edit existing template slide in place' },
  { n: 15, role: 'Template blank slide', slideId: ids.blank, construction: 'preserve source slide unchanged until final review' },
  { n: 16, role: 'Closing', slideId: ids.thankYou, construction: 'preserve source slide unchanged' },
];

const titleReplacements = [
  ['Team Details', 'ScamShield'],
  ['Brief about the idea', 'ScamShield invoice intelligence'],
  ['Opportunities', 'Opportunities'],
  ['List of features offered by the solution', 'Solution features'],
  ['Process flow diagram or Use-case diagram', 'Invoice review flow'],
  ['Wireframes/Mock diagrams of the proposed solution (optional)', 'Invoice review flow (optional)'],
  ['Architecture diagram of the proposed solution', 'Target Google Cloud architecture'],
  ['Technologies to be used in the solution', 'Technology stack'],
  ['Estimated implementation cost (optional)', 'Implementation cost (optional)'],
  ['Prototype Performance report/Benchmarking', 'Prototype Performance report/Benchmarking'],
  ['Additional Details/Future Development (if any)', 'Future development'],
  ['Provide links to your:', 'Submission links'],
  ['Demo Video Link (3 Minutes)', 'Demo Video Link (3–4 Minutes)'],
  ['Snapshots of the prototype', 'Live synthetic case evidence'],
];

const teamReplacements = [
  ['Team name: ', 'Team name: pulse'],
  ['Team leader name: ', 'Team leader name: Nikhil Kumar'],
  ['Problem Statement: ', 'Problem Statement: Invoice bank-detail changes can redirect a payment.'],
];

const bodySlides = [
  {
    slideId: ids.idea, objectId: 'ssbody03', size: 14,
    text: `Invoice instructions can change the destination account while the rest of the invoice looks routine.\n\nScamShield extracts candidate fields for human review, then compares the confirmed destination with a known vendor record. Deterministic policy returns Continue, Verify or Review with evidence.\n\nLIVE PROTOTYPE  Two synthetic invoice flows ran on the public service. Gemini extracts fields and classifies context. On request, it ranks saved evidence; deterministic templates render the explanation. No payment is executed.`,
  },
  {
    slideId: ids.opportunity, objectId: 'ssbody04', size: 14, top: 120,
    text: `DIFFERENTIATION\nInvoice instructions are reviewed alongside the saved vendor destination before a simulated decision.\n\nHOW IT HELPS\nVertex Gemini extracts invoice fields and classifies request context. A person reviews and confirms invoice details. Deterministic rules compare the destination with vendor details and show anomalies or missing checks.\n\nUSP\nThe policy decision stays separate from model output. Requested explanations use Gemini-ranked saved evidence and deterministic templates.`,
  },
  {
    slideId: ids.features, objectId: 'ssbody05', size: 14,
    text: `CURRENT PROTOTYPE\nSynthetic consumer UPI and vendor-invoice assessments in INR\nShared FastAPI assessment engine with deterministic rules and context classification\nVertex Gemini extracts invoice fields and classifies request context\nCase history stores evidence, missing checks and provider status\n\nCLOUD SERVICES\nCloud Run, Firebase anonymous authentication and Firestore support the live demo. The prototype simulates decisions; no payment is executed.`,
  },
  {
    slideId: ids.flow, objectId: 'ssbody06', size: 14,
    text: `INVOICE REVIEW FLOW\n01  Upload → Gemini extraction → human confirmation.\n02  Rules and Gemini context classification support a deterministic Continue, Verify or Review decision.\n03  Firestore stores the case; no payment is executed.\n\nOptional, after the decision: Gemini ranks saved evidence and deterministic templates render a requested explanation.`,
  },
  {
    slideId: ids.wireframe, objectId: 'ssbody07', size: 14,
    text: `INVOICE REVIEW FLOW  Live synthetic cases shown on slide 11\n\nInput  Synthetic invoice PDF, PNG or JPEG\nExtraction  Vertex Gemini returns candidate fields\nHuman review  Confirm fields and select a vendor record\nVendor check  Compare requested destination with the saved account\nContext  Gemini classifies the payment request\nDecision  Continue, Verify or Review\n\nThe changed destination case recommends Review; the normal invoice returns Continue.`,
  },
  {
    slideId: ids.architecture, objectId: 'ssbody08', size: 13,
    text: `GOOGLE CLOUD ARCHITECTURE\n01  React client uses Firebase anonymous authentication.\n02  FastAPI serves the app and assessment API on Cloud Run.\n03  Vertex AI Gemini 2.5 Flash-Lite extracts fields, classifies context and ranks saved evidence on request.\n04  Human confirmation precedes deterministic vendor comparison.\n05  Firestore stores owner-scoped cases and model-request quotas.\n\nLIVE CHECK  Two synthetic invoice paths completed. Firestore readback, idempotency and cross-visitor access checks passed.`,
  },
  {
    slideId: ids.technologies, objectId: 'ssbody09', size: 13,
    text: `APPLICATION\nReact and TypeScript client, Python FastAPI service, deterministic policy and evidence-backed case records.\n\nGOOGLE CLOUD\nFirebase anonymous authentication, Firestore, Cloud Run and Vertex AI Gemini 2.5 Flash-Lite. Two live synthetic invoice paths returned Continue and Review.\n\nThe app is human reviewed. Requested explanations use Gemini-ranked recorded evidence rendered with deterministic templates. No real payment is initiated.`,
  },
  {
    slideId: ids.cost, objectId: 'ssbody10', size: 13,
    text: `CLOUD COST STATUS\nProject billing is enabled. No credit coverage is confirmed. Cloud Run, Firestore and Vertex AI calls may incur charges.\n\nA ₹100 project budget alert is configured through 6 November 2026. Budget alerts notify; they do not stop spending.\n\nAPPLICATION REQUEST LIMITS\n9 model attempts per visitor per day · 50 globally per day · 200 total. These limits restrict model calls and are not a billing cap.\n\nUse synthetic invoice data only.`,
  },
  {
    slideId: ids.snapshots, objectId: 'ssbody11', size: 14,
    text: `LIVE SYNTHETIC INVOICE CASE\nThe public app used Vertex Gemini to extract fields and classify request context. The person confirmed the vendor destination before assessment. Requested explanations use Gemini-ranked saved evidence and deterministic templates.\n\nOne invoice matched the saved account and returned Continue. The changed destination and bypass request returned Review. Firestore retained both cases across a deployment revision. No payment moved.`,
  },
  {
    slideId: ids.performance, objectId: 'ssbody12', size: 13,
    text: `SOFTWARE CHECKS\n59 backend tests pass in the release check.\n\nLIVE INTEGRATION CHECK\nTwo synthetic invoice flows completed with live Vertex Gemini extraction and classification. A requested explanation used Gemini-ranked evidence with deterministic templates. Firestore readback, retry idempotency, restart durability and visitor isolation were verified.\n\nLIMITS\nTests do not measure model accuracy or real-world fraud detection. No accuracy or latency benchmark is claimed.`,
  },
  {
    slideId: ids.future, objectId: 'ssbody13', size: 13,
    text: `NEXT STEPS\n01  Continue testing model failure, malformed files and quota exhaustion.\n02  Expand evaluation with reviewed synthetic cases before making performance claims.\n03  Monitor Cloud usage against the ₹100 budget alert through 6 November 2026.\n04  Keep a human in the review path; the app never initiates a payment.`,
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
    { createLine: { objectId: id, lineCategory: 'STRAIGHT', elementProperties: { pageObjectId: slideId, size: { width: { magnitude: Math.max(0.1, Math.abs(x2 - x1)), unit: 'PT' }, height: { magnitude: Math.max(0.1, Math.abs(y2 - y1)), unit: 'PT' } }, transform: { scaleX: x2 < x1 ? -1 : 1, scaleY: y2 < y1 ? -1 : 1, translateX: Math.min(x1, x2), translateY: Math.min(y1, y2), unit: 'PT' } } } },
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
  const requests = [{ deleteObject: { objectId: 'ssbody06' } }];
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
    ['ssarch04', 'Vertex AI\nGemini 2.5 Flash-Lite'],
  ];
  const startX = 30, width = 150, gap = 20, y = 138, height = 80;
  const requests = [{ deleteObject: { objectId: 'ssbody08' } }];
  for (let i = 0; i < nodes.length; i++) requests.push(...nodeRequests({ slideId, id: nodes[i][0], text: nodes[i][1], x: startX + i * (width + gap), y, width, height }));
  for (let i = 0; i < nodes.length - 1; i++) requests.push(...arrowRequests({ slideId, id: `ssarcharrow${i + 1}`, x1: startX + i * (width + gap) + width, y1: y + height / 2, x2: startX + (i + 1) * (width + gap), y2: y + height / 2 }));
  requests.push(...nodeRequests({ slideId, id: 'ssarch05', text: 'Firestore\nOwner-scoped cases + quotas', x: 360, y: 260, width: 180, height: 60, fill: { red: 0.96, green: 0.95, blue: 0.9 } }));
  requests.push(...arrowRequests({ slideId, id: 'ssarcharrow04', x1: 435, y1: 218, x2: 450, y2: 260 }));
  requests.push(...noteRequests({ slideId, id: 'ssarchfoot', text: 'Deterministic rules set the decision. On request, Gemini ranks saved evidence and templates render the explanation. No direct browser access to Firestore; no payment executes.', y: 337, height: 48 }));
  return requests;
}

export function buildRequests() {
  const requests = [];
  for (const [text, replaceTextValue] of titleReplacements) requests.push(replaceText(text, replaceTextValue));
  for (const [text, replaceTextValue] of teamReplacements) requests.push(replaceText(text, replaceTextValue));
  requests.push({ deleteText: { objectId: 'g3fb085bff3c_0_114', textRange: { type: 'FIXED_RANGE', startIndex: 15, endIndex: 145 } } });
  requests.push({ deleteText: { objectId: 'g3fb085bff3c_0_132', textRange: { type: 'FIXED_RANGE', startIndex: 18, endIndex: 92 } } });
  for (const body of bodySlides) {
    if ([ids.snapshots, ids.flow, ids.architecture].includes(body.slideId)) continue;
    requests.push({ deleteObject: { objectId: body.objectId } });
    requests.push(...createBodyRequests(body));
  }
  const demoLabel = 'Watch demo video (3:03)';
  const demoText = bodySlides.find(body => body.slideId === ids.links).text;
  const demoStart = demoText.indexOf(demoLabel);
  requests.push({ updateTextStyle: { objectId: 'ssbody14', textRange: { type: 'FIXED_RANGE', startIndex: demoStart, endIndex: demoStart + demoLabel.length }, style: { link: { url: VIDEO_URL }, underline: true, foregroundColor: { opaqueColor: { rgbColor: { red: 0.08, green: 0.26, blue: 0.55 } } } }, fields: 'link,underline,foregroundColor' } });

  requests.push(...processDiagramRequests(), ...architectureDiagramRequests());

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

  // Keep cost and verification context in the existing speaker-notes placeholder.
  requests.push({ deleteText: { objectId: 'g3fb085bff3c_0_45', textRange: { type: 'ALL' } } });
  requests.push({
    insertText: {
      objectId: 'g3fb085bff3c_0_45',
      insertionIndex: 0,
      text: 'ScamShield uses Vertex AI Gemini 2.5 Flash-Lite, Firebase Authentication, Firestore and Cloud Run. The ₹100 budget alert through 6 Nov 2026 is not a spending cap. 59 backend tests passed. Live synthetic invoice checks covered extraction, classification, explanation, Firestore reads, idempotency, restart durability and visitor isolation. Use synthetic data only.',
    },
  });
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
