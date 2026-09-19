export const metadata = {
  title: "Privacy Policy — SafeCut",
  description: "Privacy policy for the SafeCut platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-24 px-6 sm:px-8 lg:px-12">
      <h1 className="text-4xl font-display font-semibold mb-8 tracking-tight">Privacy Policy</h1>
      
      <div className="prose prose-invert prose-p:text-muted-foreground prose-headings:font-display prose-headings:font-medium max-w-none space-y-6">
        <p>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        
        <section className="space-y-4">
          <h2 className="text-2xl border-b border-white/10 pb-2">1. Information We Collect</h2>
          <p>
            When you use the SafeCut platform, we collect information necessary to provide our cybersecurity services:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li><strong>Session and Incident Data:</strong> When utilizing the SafeCut console, we collect network topology models, security event logs, and computation results. This data is strictly scoped to your authenticated session.</li>
            <li><strong>Contact Information:</strong> Information submitted via our contact forms (name, email, company details).</li>
            <li><strong>Analytics:</strong> Anonymous usage data collected to improve platform performance.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl border-b border-white/10 pb-2">2. How We Use Your Data</h2>
          <p>Your data is used exclusively to:</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Provide the SafeCut runtime isolation service and compute safety-constrained min-cuts.</li>
            <li>Authenticate access to the defender console.</li>
            <li>Communicate incident alerts via email.</li>
            <li>Respond to your direct inquiries.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl border-b border-white/10 pb-2">3. Data Security and Access</h2>
          <p>
            We implement strict Row Level Security (RLS) to ensure that your session and incident data is visible only to authorized personnel within your organization. All data is encrypted at rest and in transit using industry-standard protocols.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl border-b border-white/10 pb-2">4. Contact Information</h2>
          <p>If you have any questions regarding this Privacy Policy, please contact us at:</p>
          <div className="bg-card p-6 border border-white/10 rounded-sm mt-4 font-mono text-sm text-primary-foreground space-y-2">
            <p><span className="text-muted-foreground w-24 inline-block">Entity:</span> [CONTACT_NAME]</p>
            <p><span className="text-muted-foreground w-24 inline-block">Reg Number:</span> [REGISTRATION_NUMBER]</p>
            <p><span className="text-muted-foreground w-24 inline-block">Email:</span> <a href="mailto:[EMAIL_ADDRESS]" className="text-primary hover:underline">[EMAIL_ADDRESS]</a></p>
            <p><span className="text-muted-foreground w-24 inline-block">Phone:</span> [PHONE_NUMBER]</p>
          </div>
        </section>
      </div>
    </div>
  );
}
