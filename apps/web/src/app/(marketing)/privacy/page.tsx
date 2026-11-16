import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="29 September 2026"
      intro={<p>This policy explains what personal data Alter Effects collects, why, and the choices you have. It is written to meet India’s Digital Personal Data Protection Act, 2023 and similar laws. The data fiduciary is <strong>[Company legal name]</strong>.</p>}
      sections={[
        { id: "collect", title: "What we collect", body: <ul><li><strong>Account data:</strong> name, email, password hash, organisation and role.</li><li><strong>Your Content:</strong> footage, images, logos, web pages and channel thumbnails you upload or import, including images and voices of people who appear in them.</li><li><strong>Derived data:</strong> shot boundaries, AI tags (for example whether a shot is real or stock, and where faces appear), transcripts and storyboards.</li><li><strong>Billing data:</strong> plan, credits and payment records. Card and bank details are handled by Razorpay; we do not store them.</li><li><strong>Technical data:</strong> logs, job metrics, device and browser information needed to run and secure the Service.</li></ul> },
        { id: "use", title: "How we use it", body: <><ul><li>To provide the Service: ingest, tag, write storyboards, render and deliver your videos.</li><li>To bill you, prevent abuse and keep the Service secure.</li><li>To support you and to send service messages.</li></ul><p>We do <strong>not</strong> use Your Content to train AI models, and we do not sell personal data.</p></> },
        { id: "ai", title: "AI providers", body: <p>When a stage runs on an AI provider, the frames, text and metadata that stage needs are sent to the provider you chose — your own key or our managed default — only to produce that result. Each provider processes data under its own terms and policies.</p> },
        { id: "people", title: "People who appear in your videos", body: <p>You are responsible for having consent from people who appear in Your Content. Face detection is used only to keep text from covering faces; we do not identify people or build biometric profiles. Names come only from text you or your pages supply, and can be removed from any asset.</p> },
        { id: "share", title: "Who we share data with", body: <ul><li>Infrastructure providers (hosting, object storage, databases, email).</li><li>The AI providers you route stages to.</li><li>Razorpay, for payments.</li><li>Authorities, where required by law.</li></ul> },
        { id: "retention", title: "Retention", body: <p>We keep Your Content and Outputs while your organisation is active. Renders on the Free plan may be deleted after 90 days. When you delete an asset, video or organisation, we delete the files within 30 days, except backups which expire on their normal cycle and records we must keep by law.</p> },
        { id: "security", title: "Security", body: <p>Data is encrypted in transit; AI provider keys are encrypted at rest with AES-256-GCM and are never shown again after saving. Access is role-based within each organisation.</p> },
        { id: "rights", title: "Your rights", body: <p>You may access, correct or delete your personal data, withdraw consent and nominate another person to exercise your rights. Write to <strong>[privacy email]</strong>; our grievance officer is <strong>[name, email]</strong>. You may also complain to the Data Protection Board of India.</p> },
        { id: "cookies", title: "Cookies", body: <p>We use essential cookies for sign-in and to remember your current organisation. We do not use advertising cookies.</p> },
        { id: "changes", title: "Changes", body: <p>We will post changes here and notify you of material changes before they take effect.</p> },
      ]}
    />
  );
}
