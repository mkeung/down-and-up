import { LoginForm } from '../components/login-form';
export default function Home() {
  return (
    <main className="login-grid">
      <section className="login-copy">
        <p className="eyebrow">Your daily record</p>
        <h1>
          A little space
          <br />
          for every day.
        </h1>
        <p>See your values and notes together. Your ID opens your history.</p>
        <div className="number-strip" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <p className="small">
          Record on your phone.
          <br />
          Look back here, whenever you like.
        </p>
      </section>
      <section className="login-card">
        <h2>Your history, here.</h2>
        <p className="muted small">Use the ID from Settings in the app.</p>
        <LoginForm />
        <p className="muted small" style={{ marginTop: 24, marginBottom: 0 }}>
          Keep your ID somewhere safe. Anyone with it can access your record.
        </p>
      </section>
    </main>
  );
}
