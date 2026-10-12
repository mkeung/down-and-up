export default function Privacy() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <main className="policy">
      <p className="eyebrow">Down & Up</p>
      <h1>Your data, your choice.</h1>
      <p>
        Entries are saved on your phone. If you choose to sync, daily values,
        text notes, your ID, and reminder settings are sent to our server so you
        can view them on the web and restore them on another phone.
      </p>
      <h2>What we collect</h2>
      <p>
        We collect the content you record and the ID that links it together. We
        do not ask for a name, email, or password. We do not use third-party
        analytics, advertising, or tracking SDKs. Network addresses are used
        temporarily for rate limiting and are not stored with your entries.
      </p>
      <h2>Keeping entries on your phone</h2>
      <p>
        Choose “Keep on this phone only” on first launch or in Settings. Sync
        stops, pending network work is cancelled, and entries stay on the
        device. Entries work without a connection.
      </p>
      <h2>Storage and access</h2>
      <p>
        The web and API use Vercel. Server entries are stored in Neon PostgreSQL
        and temporary rate-limit counters in Upstash Redis. Traffic uses HTTPS.
        Anyone with your ID can access your entries; keep it private. You can
        replace your ID in the app, and a lost ID cannot be recovered.
      </p>
      <h2>Deletion and export</h2>
      <p>
        “Delete my data from the server” removes server entries and web sessions
        immediately. You can keep local entries with sync off or delete them
        too. You can export your entries as CSV in the app.
      </p>
      <h2>Backups and retention</h2>
      <p>
        The service is designed for encrypted storage and server database
        backups that expire within seven days. The operator must confirm the
        database provider and its encryption and backup settings before this
        service is released. We do not automatically remove inactive entries in
        this version.
      </p>
      <h2>Contact</h2>
      {contact ? (
        <p>
          For data and privacy requests, contact{' '}
          <a href={`mailto:${contact}`}>{contact}</a>.
        </p>
      ) : (
        <p>
          This service is awaiting release configuration. A privacy contact will
          be provided before public release.
        </p>
      )}
    </main>
  );
}
export const dynamic = 'force-dynamic';
