import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata = { title: "Terms & Conditions" };

export default function Terms() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="29 September 2026"
      intro={<p>These terms govern your use of Alter Effects (the “Service”), operated by <strong>[Company legal name]</strong>, <strong>[registered address]</strong> (“we”, “us”). By creating an account or using the Service you agree to them on behalf of yourself and the organisation you represent.</p>}
      sections={[
        { id: "accounts", title: "Accounts and organisations", body: <><p>You must provide accurate information and keep your credentials secure. An organisation’s owners control its members, roles, brands, AI provider keys and billing, and are responsible for activity in the organisation.</p><p>You must be at least 18 years old, or the age of majority where you live, to use the Service.</p></> },
        { id: "content", title: "Your content and rights", body: <><p>You keep all rights to the footage, images, logos, pages, text and voice recordings you upload or connect (“Your Content”) and to the videos produced from it (“Outputs”).</p><p>You grant us a limited licence to host, process, transcribe, analyse and render Your Content solely to provide the Service to you.</p><p>You confirm that you own Your Content or have every right, licence and consent needed — including the consent of people who appear in it — to use it this way. You will only import pages and channels that belong to you or that you are entitled to use.</p></> },
        { id: "ai", title: "AI providers and your keys", body: <><p>You may connect your own accounts with third-party AI providers (for example Anthropic, OpenAI, Google or OpenRouter). Your use of those providers is governed by their terms, and their charges are billed to you by them. We encrypt your keys, use them only to run your jobs, and apply the spend caps you set.</p><p>AI output can be inaccurate. You are responsible for reviewing storyboards, voice-over and claims before you approve a render. Our claims check is an aid, not a guarantee.</p></> },
        { id: "use", title: "Acceptable use", body: <><p>You will not use the Service to create content that is unlawful, defamatory, deceptive or infringing; that impersonates a person or organisation; that uses someone’s likeness without consent; or that makes false claims about products, results, placements or earnings.</p><p>You will not attempt to disrupt, reverse engineer or overload the Service, or access other customers’ data.</p></> },
        { id: "billing", title: "Plans, credits and payments", body: <><p>Paid plans are billed in advance for one month at a time; credits granted by a plan or bought as packs are consumed when you approve a render. Prices are shown in INR and exclude applicable taxes. Payments are processed by Razorpay.</p><p>Refunds are handled under our <a className="text-fg underline" href="/refund">Refund Policy</a>.</p></> },
        { id: "ip", title: "Our intellectual property", body: <p>The Service, its recipes, runtime, design and software are ours or our licensors’. You may use the Outputs for any lawful purpose. You may not resell the Service or its recipes as a competing product.</p> },
        { id: "availability", title: "Availability and changes", body: <p>We aim for a reliable Service but do not guarantee uninterrupted availability. We may change features, recipes or prices; material changes to these terms will be notified in advance by email or in the app.</p> },
        { id: "liability", title: "Disclaimers and liability", body: <p>The Service is provided “as is”. To the extent permitted by law, we are not liable for indirect or consequential losses, and our total liability for any claim is limited to the amount you paid us in the three months before the claim.</p> },
        { id: "termination", title: "Suspension and termination", body: <p>You may close your organisation at any time. We may suspend or terminate accounts that breach these terms. On termination we delete Your Content in line with our <a className="text-fg underline" href="/privacy">Privacy Policy</a>.</p> },
        { id: "law", title: "Governing law", body: <p>These terms are governed by the laws of India. Courts at <strong>[city, state]</strong> have exclusive jurisdiction, subject to any mandatory consumer protections that apply to you.</p> },
        { id: "contact", title: "Contact", body: <p>Questions about these terms: <strong>[support email]</strong>.</p> },
      ]}
    />
  );
}
