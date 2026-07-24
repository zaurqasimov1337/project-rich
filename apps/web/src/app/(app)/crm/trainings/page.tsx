import { redirect } from 'next/navigation';

// Trainings are merged into the Courses section (with lead/registration counts).
export default function SalesTrainingsRedirect() {
  redirect('/courses');
}
