import { redirect } from 'next/navigation';

// Payments are merged into the Leads section as a tab.
export default function LeadPaymentsRedirect() {
  redirect('/crm/leads?tab=payments');
}
