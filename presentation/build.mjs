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
  { n: 11, role: 'Prototype evidence', slideId: ids.snapshots, construction: 'edit existing template slide in place and insert verified local fixture-mode capture' },
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
];

const teamReplacements = [
  ['Team name: ', 'Team name: pulse'],
  ['Team leader name: ', 'Team leader name: Nikhil Kumar'],
  ['Problem Statement: ', 'Problem Statement: Invoice bank-detail changes can redirect a payment.'],
];

const bodySlides = [
  {
    slideId: ids.idea, objectId: 'ssbody03', size: 14,
    text: `Invoice instructions can change the payment destination while the invoice still looks routine.\n\nScamShield’s invoice workflow lets a person review candidate fields, confirm them, then compare the destination with the known vendor record before a simulated payment. The live path is intended to use Gemini extraction.\n\nCURRENT PROTOTYPE  Synthetic INR forms, a shared assessment API, deterministic rules, case evidence and a local fixture-mode invoice review. Live Gemini, hosted persistence and Cloud Run are unverified.`,
  },
  {
    slideId: ids.opportunity, objectId: 'ssbody04', size: 14, top: 156, scaleY: 0.92,
    text: `DIFFERENTIATION\nAssess invoice instructions alongside the saved vendor destination before payment approval.\n\nHOW IT HELPS\nGemini proposes structured fields. A person checks and confirms them. Deterministic rules compare the confirmed destination with vendor details and surface anomalies or missing checks.\n\nUSP\nEvidence stays visible. A separate policy recommends continue, verify or review. The simulator moves no money and never treats extracted identity as trusted by itself.`,
  },
  {
    slideId: ids.features, objectId: 'ssbody05', size: 14,
    text: `CURRENT PROTOTYPE\nSynthetic consumer UPI and vendor-invoice assessments in INR\nShared FastAPI assessment engine with deterministic rules and optional context classification\nCase history records evidence, missing checks and provider status\nLocal invoice review walkthrough uses a saved fixture\n\nLIVE SERVICES\nGemini extraction and hosted persistence have not been verified. Firebase Auth and Firestore code are implemented; Cloud Run deployment is pending credit coverage.`,
  },
  {
    slideId: ids.flow, objectId: 'ssbody06', size: 14,
    text: `INVOICE REVIEW FLOW\n01  Select a synthetic invoice fixture or upload a PDF, PNG or JPEG up to 5 MiB.\n02  The local demo loads saved fixture fields; no live Gemini extraction has been verified.\n03  A person reviews and edits the fields before assessment.\n04  Select a known vendor record and confirm the destination.\n05  Rules check changed details, transaction history and missing data.\n06  The policy returns continue, verify or review with visible evidence.\n07  The next step is simulated. No payment is executed.\n\nLive extraction and cloud deployment remain unverified.`,
  },
  {
    slideId: ids.wireframe, objectId: 'ssbody07', size: 14,
    text: `OPTIONAL FLOW SKETCH  Implemented local invoice review is shown on slide 11\n\nInvoice file  PDF / PNG / JPEG, maximum 5 MiB\nCandidate fields  Vendor, invoice ID, amount, currency, destination\nHuman review  Edit or confirm before assessment\nVendor match  Select a known synthetic vendor record\nEvidence  Changed bank details, anomalies and missing checks\nDecision  Continue, verify or review\n\nCandidate fields use a saved fixture in the local walkthrough.`,
  },
  {
    slideId: ids.architecture, objectId: 'ssbody08', size: 13,
    text: `TARGET GOOGLE CLOUD DESIGN  Cloud Run deployment not yet verified\n01  Web client uses Firebase anonymous authentication.\n02  FastAPI serves the app and API from Cloud Run.\n03  Gemini Developer API is the intended extraction provider.\n04  Human confirmation precedes deterministic comparison with vendor history.\n05  Firestore stores owner-scoped cases and daily usage quotas.\n\nSTATUS  Local React/FastAPI and fixture-mode invoice review work with SQLite. Firebase Auth and Firestore code are implemented; live credentials and persistence checks are unverified. Cloud Run deployment is pending credit coverage.`,
  },
  {
    slideId: ids.technologies, objectId: 'ssbody09', size: 13,
    text: `LOCAL PROTOTYPE\nReact and TypeScript interface, Python FastAPI service, SQLite, fixture-first providers and deterministic policy. Local invoice review uses a saved fixture.\n\nTARGET CLOUD STACK\nFirebase Authentication, Firestore, Cloud Run and Gemini Developer API for invoice extraction.\n\nSTATUS\nFirebase Auth and Firestore code are implemented. Live credentials and persistence are unverified; Cloud Run deployment awaits credit coverage. No live Gemini request has been verified.`,
  },
  {
    slideId: ids.cost, objectId: 'ssbody10', size: 13,
    text: `LOCAL PROTOTYPE  Runs on a developer machine with SQLite; no hosted database is needed.\n\nGEMINI  Google lists free input and output for selected models on its Free tier, subject to model eligibility and rate limits. Google may use free-tier content to improve products. Use synthetic invoices only.\n\nCLOUD  Firebase, Firestore and Cloud Run costs depend on project settings and usage. Billing may be required. No paid services are provisioned and no deployment cost estimate is available. Set quotas and a budget before launch.\n\nSource: ai.google.dev/gemini-api/docs/pricing (checked 18 Oct 2026).`,
  },
  {
    slideId: ids.snapshots, objectId: 'ssbody11', size: 14,
    text: `LOCAL FIXTURE-MODE DEMO\nA synthetic invoice walkthrough shows candidate fields awaiting human review, vendor comparison, recorded risk evidence and a simulated decision.\n\nThe screen uses a saved fixture. It does not show live Gemini extraction or a public GCP deployment. No payment moves.`,
  },
  {
    slideId: ids.performance, objectId: 'ssbody12', size: 13,
    text: `CURRENT LOCAL CHECKS\n52 backend tests pass in the current release check.\n\nHISTORICAL SYNTHETIC EVALUATION  Recorded 11 Oct 2026\n40 policy cases were split into 20 development and 20 held-out examples. Classifier outputs were curated fixtures.\n\nLIMITS\nThese checks do not measure Gemini extraction accuracy or real-world fraud detection. No live extraction accuracy, public deployment, or end-to-end latency benchmark is recorded.`,
  },
  {
    slideId: ids.future, objectId: 'ssbody13', size: 13,
    text: `NEXT STEPS\n01  Verify Gemini extraction with synthetic invoices and require human confirmation before assessment.\n02  Validate Firebase anonymous identity and Firestore owner-scoped cases and quotas with live credentials.\n03  Deploy the API and frontend to Cloud Run after credit coverage is confirmed.\n04  Test upload, extraction, confirmation, assessment, ownership and persistence end to end.\n05  Record measured timings, capture the deployed product and publish a 3–4 minute walkthrough.\n\nLive extraction and cloud deployment remain unverified.`,
  },
  {
    slideId: ids.links, objectId: 'ssbody14', size: 14, top: 170, scaleY: 0.9,
    text: `Public GitHub repository  Pending verified public URL\n\nDemo video  Pending recording; current form asks for 3–4 minutes\n\nPublic GCP / Cloud Run product  Pending deployment and anonymous-browser verification\n\nDo not submit this draft until all three links work without a signed-in session.`,
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
          transform: { scaleX: 2.8, scaleY: scaleY ?? 1, translateX: 30, translateY: top ?? 104, unit: 'PT' },
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

export function buildRequests() {
  const requests = [];
  for (const [text, replaceTextValue] of titleReplacements) requests.push(replaceText(text, replaceTextValue));
  for (const [text, replaceTextValue] of teamReplacements) requests.push(replaceText(text, replaceTextValue));
  for (const body of bodySlides) {
    if (body.slideId === ids.snapshots) continue;
    requests.push(...createBodyRequests(body));
  }

  const screenshotPath = path.resolve('artifacts/screenshots/invoice-review-local.jpg');
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

  // Source note is inserted in the existing speaker-notes placeholder on slide 10.
  requests.push({
    insertText: {
      objectId: 'g3fb085bff3c_0_45',
      insertionIndex: 0,
      text: 'Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing. Firebase pricing: https://firebase.google.com/pricing. Cloud Run pricing: https://cloud.google.com/run/pricing. Checked 18 Oct 2026. Free-tier content-use and rate-limit terms may change. Use synthetic invoices only.',
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
