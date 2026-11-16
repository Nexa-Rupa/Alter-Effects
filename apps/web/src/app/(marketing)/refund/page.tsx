import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata = { title: "Refund Policy" };

export default function Refund() {
  return (
    <LegalPage
      title="Refund Policy"
      updated="29 September 2026"
      intro={<p>We want you to pay only for videos you are happy with. This policy covers plan payments and credit packs bought through Razorpay.</p>}
      sections={[
        { id: "failed", title: "Failed renders", body: <p>Credits are charged once, when you approve a render. If a render fails for any reason on our side, the credit is returned to your organisation automatically — no request needed. You can see every charge and refund in Billing → Credit history.</p> },
        { id: "plans", title: "Monthly plans", body: <ul><li>If you cancel within <strong>7 days</strong> of a plan payment and have used <strong>no credits</strong> from that payment, you get a full refund.</li><li>After credits have been used, or after 7 days, the plan runs to the end of its month and is not refunded; it simply does not renew.</li></ul> },
        { id: "packs", title: "Credit packs", body: <p>Unused credit packs can be refunded within <strong>14 days</strong> of purchase. Packs from which any credit has been used are not refundable.</p> },
        { id: "quality", title: "Quality issues", body: <p>If a delivered video has a defect caused by the Service (for example a broken frame, missing audio or a layout error our gates missed), tell us within 7 days. We will re-render it at no cost or return the credit.</p> },
        { id: "not", title: "What is not refundable", body: <ul><li>Charges from your own AI providers (billed by them, not us).</li><li>Videos that were rendered as approved but that you later decide not to use.</li><li>Accounts suspended for breaking our Terms.</li></ul> },
        { id: "how", title: "How to request a refund", body: <p>Email <strong>[billing email]</strong> from an owner’s address with your organisation name and the Razorpay payment ID shown in Billing. Approved refunds go back to the original payment method within <strong>5–7 business days</strong>, depending on your bank.</p> },
      ]}
    />
  );
}
