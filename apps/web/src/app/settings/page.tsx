import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessionProfile } from '../../server/auth';
import { loadReminder } from '../../server/dashboard-data';
import { ReminderForm } from '../../components/reminder-form';
import { SignOut } from '../../components/sign-out';
export const dynamic = 'force-dynamic';
export default async function SettingsPage() {
  const id = await sessionProfile();
  if (!id) redirect('/');
  const initial = await loadReminder(id);
  return (
    <main>
      <div className="page-top">
        <div>
          <p className="eyebrow">Set your own time</p>
          <h1>A daily reminder.</h1>
        </div>
        <nav className="nav-actions" aria-label="Settings">
          <Link href="/dashboard">History</Link>
          <SignOut />
        </nav>
      </div>
      <section className="chart-card settings-card">
        <ReminderForm initial={initial} />
        <p className="muted small">
          Reminders come from the app on your phone, in the phone’s local time.
          Changes apply the next time the app syncs.
        </p>
      </section>
    </main>
  );
}
