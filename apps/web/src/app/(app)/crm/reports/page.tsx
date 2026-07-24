import { redirect } from 'next/navigation';

// Reports are merged into the sales dashboard (/crm) per the MilliSec design.
export default function SalesReportsRedirect() {
  redirect('/crm');
}
