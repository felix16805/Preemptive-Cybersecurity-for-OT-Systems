export const metadata = {
  title: "Terms of Service — SafeCut",
  description: "Terms of service for the SafeCut platform.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-24 px-6 sm:px-8 lg:px-12">
      <h1 className="text-4xl font-display font-semibold mb-8 tracking-tight">Terms of Service</h1>
      
      <div className="prose prose-invert prose-p:text-muted-foreground prose-headings:font-display prose-headings:font-medium max-w-none space-y-6">
        <p>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        
        <section className="space-y-4">
          <h2 className="text-2xl border-b border-white/10 pb-2">1. Scope of Service</h2>
          <p>
            SafeCut provides a runtime cybersecurity isolation platform for Operational Technology (OT) networks. The service is provided as a decision-support and automated response tool, computing mathematical guarantees for safety-instrumented functions based strictly on the network topology models provided by the user.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl border-b border-white/10 pb-2">2. Liability and Limitations</h2>
          <p>
            While SafeCut utilizes independently verifiable reachability algorithms to ensure safety loops remain intact, the platform is not a substitute for physical safety mechanisms. We assume no liability for catastrophic failure, plant damage, or loss of life resulting from inaccurate topology data or circumvention of physical fail-safes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl border-b border-white/10 pb-2">3. User Responsibilities</h2>
          <p>You agree to:</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Provide accurate and complete representations of your OT network topology.</li>
            <li>Maintain the confidentiality of your session tokens and credentials.</li>
            <li>Use the SafeCut platform exclusively for defensive security purposes.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl border-b border-white/10 pb-2">4. Contact Information</h2>
          <p>For legal inquiries, contact us at:</p>
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
